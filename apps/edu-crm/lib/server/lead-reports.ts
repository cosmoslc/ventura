import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  courses,
  groupMemberships,
  leadEvents,
  leadStages,
  leads,
  payments,
  students,
  users,
} from "@ventura/db/schema/tenant";
import { addMonths } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import {
  type FunnelLead,
  type LeadKind,
  bestSource,
  biggestDrop,
  countShare,
  funnelSteps,
  monthAdvice,
  seasonMonths,
  sourceRows,
  stageDays,
} from "@/lib/lead-reports";
import type { ReportData, ReportRow } from "@/lib/reports";
import { uz } from "@/lib/uz";
import type { LoadArgs, ReportPeriod } from "./reports";

/*
 * Lid hisobotlari (E5c, ADR 0032). Hisob — lib/lead-reports.ts. Voronka bosqichlar tarixidan (lead_events)
 * aniq hisoblanadi; eski tizim yo'qotilgan lidning bosqichini taxmin qilar edi.
 */

const t = uz.reports;
const pctLabel = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
const day = (col: typeof leads.createdAt | typeof leads.stageChangedAt) =>
  sql<string>`to_char(${col} at time zone 'Asia/Tashkent', 'YYYY-MM-DD')`;
const inPeriod = (d: string, r: ReportPeriod["range"]) => !r || (d >= r.from && d < r.to);

/** Oldingi xuddi shunday davr (oy → oldingi oy, yil → oldingi yil); barcha davr — yo'q */
function prevRange(period: ReportPeriod): { from: string; to: string } | null {
  if (!period.range || period.year === null) return null;
  if (period.month === null) return { from: `${period.year - 1}-01-01`, to: `${period.year}-01-01` };
  const m = period.range.from.slice(0, 7);
  return { from: `${addMonths(m, -1)}-01`, to: period.range.from };
}

interface LeadRow {
  id: string;
  name: string;
  phone: string;
  source: string | null;
  courseName: string | null;
  staffId: string | null;
  staffName: string | null;
  stageId: string;
  kind: LeadKind;
  created: string;
  changed: string;
  lostReason: string | null;
  lostNote: string | null;
  lostFromStageId: string | null;
  studentId: string | null;
}

async function loadLeads(db: LoadArgs["db"], filter: LoadArgs["filter"]): Promise<LeadRow[]> {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      source: leads.source,
      courseName: courses.name,
      staffId: leads.assignedTo,
      staffName: users.name,
      stageId: leads.stageId,
      kind: leadStages.kind,
      created: day(leads.createdAt),
      changed: day(leads.stageChangedAt),
      lostReason: leads.lostReason,
      lostNote: leads.lostNote,
      lostFromStageId: leads.lostFromStageId,
      studentId: leads.studentId,
    })
    .from(leads)
    .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
    .leftJoin(courses, eq(courses.id, leads.courseId))
    .leftJoin(users, eq(users.id, leads.assignedTo))
    .where(and(isNull(leads.archivedAt), filter ? inArray(leads.branchId, [...filter]) : undefined));
  return rows as LeadRow[];
}

const openStagesOf = (db: LoadArgs["db"]) =>
  db
    .select({ id: leadStages.id, name: leadStages.name, kind: leadStages.kind })
    .from(leadStages)
    .orderBy(asc(leadStages.position), asc(leadStages.name));

/* ---------- CRM voronka ---------- */

export async function funnelReport({ db, filter, period }: LoadArgs): Promise<ReportData> {
  const k = t.funnel;
  const [all, stageRows] = await Promise.all([loadLeads(db, filter), openStagesOf(db)]);
  const list = all.filter((l) => inPeriod(l.created, period.range));
  const open = stageRows.filter((s) => s.kind === "open");
  const lostStageIds = new Set(stageRows.filter((s) => s.kind === "lost").map((s) => s.id));
  const index = new Map(open.map((s, i) => [s.id, i]));

  const events = list.length
    ? await db
        .select({ leadId: leadEvents.leadId, toStageId: leadEvents.toStageId, at: leadEvents.at })
        .from(leadEvents)
        .where(
          inArray(
            leadEvents.leadId,
            list.map((l) => l.id),
          ),
        )
    : [];
  const visited = new Map<string, string[]>();
  for (const e of events) visited.set(e.leadId, [...(visited.get(e.leadId) ?? []), e.toStageId]);

  const funnel: (FunnelLead & { row: LeadRow })[] = list.map((l) => {
    if (l.kind === "won") return { staffId: l.staffId, kind: l.kind, reached: open.length, row: l };
    const seen = [l.stageId, l.lostFromStageId, ...(visited.get(l.id) ?? [])]
      .map((id) => (id ? index.get(id) : undefined))
      .filter((i) => i !== undefined);
    return { staffId: l.staffId, kind: l.kind, reached: seen.length ? Math.max(...seen) : 0, row: l };
  });
  const steps = funnelSteps(funnel, open.length);
  const stepName = (i: number) => (i < open.length ? open[i]!.name : k.won);
  // Yo'qotish bosqichidagi turish hisobga kirmaydi (u yerdan chiqilmaydi)
  const days = stageDays(
    events.filter((e) => !lostStageIds.has(e.toStageId)).map((e) => ({ ...e, at: e.at.getTime() })),
  );
  const drop = biggestDrop(steps);
  const won = funnel.filter((f) => f.kind === "won").length;

  const staff = new Map<string, { name: string; leads: (typeof funnel)[number][] }>();
  for (const f of funnel) {
    const key = f.staffId ?? "";
    const s = staff.get(key) ?? { name: f.row.staffName ?? k.unassigned, leads: [] };
    s.leads.push(f);
    staff.set(key, s);
  }

  return {
    metrics: [
      { label: k.leads, value: list.length, kind: "number", tone: "primary" },
      {
        label: k.won,
        value: won,
        kind: "number",
        tone: "success",
        foot: list.length ? k.convFoot(pctLabel((won / list.length) * 100)) : undefined,
      },
      { label: k.lost, value: funnel.filter((f) => f.kind === "lost").length, kind: "number", tone: "danger" },
      {
        label: k.biggestDrop,
        value: drop?.rate ?? null,
        kind: "percent",
        tone: drop ? "warning" : "neutral",
        foot: drop ? k.dropFoot(stepName(drop.index - 1), stepName(drop.index)) : undefined,
      },
    ],
    table: {
      columns: [
        { key: "stage", label: k.stage, kind: "text" },
        { key: "count", label: k.reached, kind: "number" },
        { key: "share", label: k.share, kind: "percent" },
        { key: "conv", label: k.conv, kind: "percent" },
        { key: "drop", label: k.drop, kind: "number" },
        { key: "days", label: k.days, kind: "number" },
      ],
      rows: steps.map((s): ReportRow => ({
        kind: s.index === open.length ? "total" : "row",
        cells: {
          stage: stepName(s.index),
          count: s.count,
          share: s.share,
          conv: s.conv,
          drop: s.index ? s.drop : null,
          days:
            s.index < open.length && days.has(open[s.index]!.id)
              ? Math.round(days.get(open[s.index]!.id)! * 10) / 10
              : null,
        },
      })),
    },
    note: k.footnote,
    extra: [
      {
        title: k.byStaff,
        table: {
          columns: [
            { key: "staff", label: k.staff, kind: "text" },
            { key: "total", label: k.leads, kind: "number" },
            ...steps.slice(1).map((s) => ({ key: `s${s.index}`, label: stepName(s.index), kind: "number" as const })),
            { key: "conv", label: k.convCol, kind: "percent" },
          ],
          rows: [...staff.values()]
            .sort((a, b) => b.leads.length - a.leads.length || a.name.localeCompare(b.name))
            .map((s) => {
              const st = funnelSteps(s.leads, open.length);
              return {
                cells: {
                  staff: s.name,
                  total: s.leads.length,
                  ...Object.fromEntries(st.slice(1).map((x) => [`s${x.index}`, x.count])),
                  conv: st.at(-1)!.share,
                },
              };
            }),
        },
      },
    ],
  };
}

/* ---------- Yo'qotilgan lidlar ---------- */

export async function lostReport({ db, filter, period }: LoadArgs): Promise<ReportData> {
  const k = t.lost;
  const [all, stageRows] = await Promise.all([loadLeads(db, filter), openStagesOf(db)]);
  const stageName = new Map(stageRows.map((s) => [s.id, s.name]));
  const lostAll = all.filter((l) => l.kind === "lost");
  // Yo'qotilgan sana — "Yo'qotildi" bosqichiga o'tgan kun
  const lost = lostAll.filter((l) => inPeriod(l.changed, period.range));
  const prev = prevRange(period);
  const prevCount = prev ? lostAll.filter((l) => inPeriod(l.changed, prev)).length : null;
  const created = all.filter((l) => inPeriod(l.created, period.range));
  const createdLost = created.filter((l) => l.kind === "lost").length;

  const reasons = countShare(lost.map((l) => l.lostReason?.trim() || k.noReason));
  const stages = countShare(
    lost.map((l) => (l.lostFromStageId ? (stageName.get(l.lostFromStageId) ?? "—") : k.noStage)),
  );
  const staff = countShare(lost.map((l) => l.staffName ?? k.unassigned));
  const top = reasons[0];

  return {
    metrics: [
      {
        label: k.total,
        value: lost.length,
        kind: "number",
        tone: "danger",
        foot:
          prevCount === null
            ? undefined
            : prevCount
              ? k.vsPrev(pctLabel(((lost.length - prevCount) / prevCount) * 100), prevCount)
              : k.prevNone,
      },
      {
        label: k.share,
        value: created.length ? (createdLost / created.length) * 100 : null,
        kind: "percent",
        foot: k.shareFoot(created.length),
      },
      { label: k.topReason, value: top?.count ?? null, kind: "number", foot: top?.key },
      { label: k.topStage, value: stages[0]?.count ?? null, kind: "number", foot: stages[0]?.key },
    ],
    table: {
      columns: [
        { key: "reason", label: k.reason, kind: "text" },
        { key: "count", label: k.count, kind: "number" },
        { key: "share", label: k.shareCol, kind: "percent" },
      ],
      rows: [
        ...reasons.map((r): ReportRow => ({ cells: { reason: r.key, count: r.count, share: r.share } })),
        { kind: "total", cells: { reason: t.total, count: lost.length, share: lost.length ? 100 : null } },
      ],
    },
    note: k.footnote,
    extra: [
      {
        title: k.byStage,
        table: {
          columns: [
            { key: "stage", label: k.stage, kind: "text" },
            { key: "count", label: k.count, kind: "number" },
            { key: "share", label: k.shareCol, kind: "percent" },
          ],
          rows: stages.map((r) => ({ cells: { stage: r.key, count: r.count, share: r.share } })),
        },
      },
      {
        title: k.byStaff,
        table: {
          columns: [
            { key: "staff", label: k.staff, kind: "text" },
            { key: "count", label: k.count, kind: "number" },
            { key: "share", label: k.shareCol, kind: "percent" },
          ],
          rows: staff.map((r) => ({ cells: { staff: r.key, count: r.count, share: r.share } })),
        },
      },
      {
        title: k.list,
        table: {
          columns: [
            { key: "lead", label: k.lead, kind: "text" },
            { key: "source", label: k.source, kind: "text" },
            { key: "course", label: k.course, kind: "text" },
            { key: "staff", label: k.staff, kind: "text" },
            { key: "stage", label: k.stage, kind: "text" },
            { key: "reason", label: k.reason, kind: "text" },
            { key: "note", label: k.note, kind: "text" },
            { key: "created", label: k.created, kind: "text" },
            { key: "lostAt", label: k.lostAt, kind: "text" },
          ],
          rows: [...lost]
            .sort((a, b) => b.changed.localeCompare(a.changed) || a.name.localeCompare(b.name))
            .map((l) => ({
              href: `/leads/${l.id}`,
              cells: {
                lead: l.name,
                source: l.source ?? k.noSource,
                course: l.courseName,
                staff: l.staffName ?? k.unassigned,
                stage: l.lostFromStageId ? (stageName.get(l.lostFromStageId) ?? "—") : k.noStage,
                reason: l.lostReason?.trim() || k.noReason,
                note: l.lostNote,
                created: formatDate(l.created),
                lostAt: formatDate(l.changed),
              },
            })),
        },
      },
    ],
  };
}

/* ---------- Manbalar samaradorligi ---------- */

export async function sourcesReport({ db, filter, period, finance }: LoadArgs): Promise<ReportData> {
  const k = t.sources;
  const all = await loadLeads(db, filter);
  const list = all.filter((l) => inPeriod(l.created, period.range));
  const studentIds = [...new Set(list.filter((l) => l.kind === "won" && l.studentId).map((l) => l.studentId!))];
  const paid =
    finance && studentIds.length
      ? await db
          .select({
            studentId: payments.studentId,
            amount:
              sql<number>`sum(case when ${payments.kind} = 'refund' then -${payments.amount} else ${payments.amount} end)`.mapWith(
                Number,
              ),
          })
          .from(payments)
          .where(
            and(
              inArray(payments.studentId, studentIds),
              inArray(payments.kind, ["payment", "refund"]),
              isNull(payments.voidedAt),
            ),
          )
          .groupBy(payments.studentId)
      : [];
  const revenue = new Map(paid.map((p) => [p.studentId, p.amount]));
  const rows = sourceRows(
    list.map((l) => ({
      source: l.source?.trim() || k.noSource,
      kind: l.kind,
      revenue: l.kind === "won" && l.studentId ? (revenue.get(l.studentId) ?? 0) : 0,
    })),
  );
  const best = bestSource(rows);
  const sum = (key: "leads" | "won" | "lost" | "open" | "revenue") => rows.reduce((s, r) => s + r[key], 0);
  const prev = prevRange(period);
  const prevLeads = prev ? all.filter((l) => inPeriod(l.created, prev)).length : null;
  const total = sum("leads");

  return {
    metrics: [
      {
        label: k.leads,
        value: total,
        kind: "number",
        tone: "primary",
        foot:
          prevLeads === null
            ? undefined
            : prevLeads
              ? k.vsPrev(pctLabel(((total - prevLeads) / prevLeads) * 100), prevLeads)
              : k.prevNone,
      },
      { label: k.conv, value: total ? (sum("won") / total) * 100 : null, kind: "percent", tone: "success" },
      { label: k.best, value: best?.conv ?? null, kind: "percent", foot: best ? best.source : k.bestNone },
      { label: k.lostShare, value: total ? (sum("lost") / total) * 100 : null, kind: "percent", tone: "danger" },
    ],
    table: {
      columns: [
        { key: "source", label: k.source, kind: "text" },
        { key: "leads", label: k.leads, kind: "number" },
        { key: "open", label: k.open, kind: "number" },
        { key: "won", label: k.won, kind: "number" },
        { key: "lost", label: k.lost, kind: "number" },
        { key: "conv", label: k.convCol, kind: "percent" },
        ...(finance ? [{ key: "revenue", label: k.revenue, kind: "money" as const }] : []),
      ],
      rows: [
        ...rows.map((r): ReportRow => ({
          cells: {
            source: r.source,
            leads: r.leads,
            open: r.open,
            won: r.won,
            lost: r.lost,
            conv: r.conv,
            ...(finance ? { revenue: r.revenue } : {}),
          },
        })),
        {
          kind: "total",
          cells: {
            source: t.total,
            leads: total,
            open: sum("open"),
            won: sum("won"),
            lost: sum("lost"),
            conv: total ? (sum("won") / total) * 100 : null,
            ...(finance ? { revenue: sum("revenue") } : {}),
          },
        },
      ],
    },
    note: finance ? `${k.footnote} ${k.revenueNote}` : k.footnote,
  };
}

/* ---------- Mavsumiy oqim ---------- */

export async function seasonalReport({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const k = t.seasonal;
  const year = period.year ?? Number(today.slice(0, 4));
  const [all, firsts] = await Promise.all([
    loadLeads(db, filter),
    db
      .select({ month: sql<string>`to_char(min(${groupMemberships.activatedAt}), 'YYYY-MM')` })
      .from(groupMemberships)
      .innerJoin(students, eq(students.id, groupMemberships.studentId))
      .where(and(isNotNull(groupMemberships.activatedAt), filter ? inArray(students.branchId, [...filter]) : undefined))
      .groupBy(groupMemberships.studentId),
  ]);
  const months = seasonMonths(
    all.map((l) => ({ month: l.created.slice(0, 7), won: l.kind === "won" })),
    firsts.map((f) => f.month),
    year,
    today,
  );
  const passed = months.filter((m) => !m.future);
  const leadsSum = passed.reduce((s, m) => s + m.leads, 0);
  const prevSum = passed.reduce((s, m) => s + m.prevLeads, 0);
  const wonSum = passed.reduce((s, m) => s + m.won, 0);
  const withLeads = passed.filter((m) => m.leads > 0);
  const busiest = [...withLeads].sort((a, b) => b.leads - a.leads)[0];
  // "Eng sokin" — lid kelgan oylar ichidan va kamida ikki oy solishtirilganda
  const quietest = withLeads.length >= 2 ? [...withLeads].sort((a, b) => a.leads - b.leads)[0] : undefined;
  const monthName = (m: string) => uz.months[Number(m.slice(5, 7)) - 1]!;
  const advice = monthAdvice(all.map((l) => l.created.slice(0, 7)));

  return {
    metrics: [
      {
        label: k.leads,
        value: leadsSum,
        kind: "number",
        tone: "primary",
        foot: prevSum ? k.vsLastYear(pctLabel(((leadsSum - prevSum) / prevSum) * 100)) : undefined,
      },
      { label: k.conv, value: leadsSum ? (wonSum / leadsSum) * 100 : null, kind: "percent", tone: "success" },
      { label: k.busiest, value: busiest?.leads ?? null, kind: "number", foot: busiest && monthName(busiest.month) },
      {
        label: k.quietest,
        value: quietest?.leads ?? null,
        kind: "number",
        foot: quietest && monthName(quietest.month),
      },
    ],
    table: {
      columns: [
        { key: "month", label: k.month, kind: "text" },
        { key: "leads", label: k.leads, kind: "number" },
        { key: "prev", label: k.prevYear(year - 1), kind: "number" },
        { key: "change", label: k.change, kind: "percent" },
        { key: "won", label: k.won, kind: "number" },
        { key: "conv", label: k.convCol, kind: "percent" },
        { key: "newStudents", label: k.newStudents, kind: "number" },
      ],
      rows: [
        ...months.map((m): ReportRow => ({
          cells: {
            month: monthName(m.month),
            leads: m.future ? null : m.leads,
            prev: m.prevLeads,
            change: !m.future && m.prevLeads ? ((m.leads - m.prevLeads) / m.prevLeads) * 100 : null,
            won: m.future ? null : m.won,
            conv: m.future ? null : m.conv,
            newStudents: m.future ? null : m.newStudents,
          },
        })),
        {
          kind: "total",
          cells: {
            month: t.total,
            leads: leadsSum,
            prev: months.reduce((s, m) => s + m.prevLeads, 0),
            change: prevSum ? ((leadsSum - prevSum) / prevSum) * 100 : null,
            won: wonSum,
            conv: leadsSum ? (wonSum / leadsSum) * 100 : null,
            newStudents: passed.reduce((s, m) => s + m.newStudents, 0),
          },
        },
      ],
    },
    note: advice ? k.footnote : `${k.footnote} ${k.adviceLater}`,
    extra: advice
      ? [
          {
            title: k.adviceTitle,
            table: {
              columns: [
                { key: "month", label: k.month, kind: "text" },
                { key: "avg", label: k.avg, kind: "number" },
                { key: "years", label: k.years, kind: "number" },
                { key: "tag", label: k.tag, kind: "text" },
              ],
              rows: advice.map((a) => ({
                cells: {
                  month: uz.months[a.month - 1]!,
                  avg: Math.round(a.avg * 10) / 10,
                  years: a.years,
                  tag: a.tag ? k.tags[a.tag]! : null,
                },
              })),
            },
          },
        ]
      : undefined,
  };
}
