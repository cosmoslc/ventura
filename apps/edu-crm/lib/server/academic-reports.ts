import "server-only";
import { and, count, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { attendance, courses, groupMemberships, groups, students, teachers } from "@ventura/db/schema/tenant";
import {
  type LeaveRecord,
  type StudentSpan,
  churnStats,
  cohorts,
  daysBetween,
  leaveSummary,
  riskOf,
} from "@/lib/academic-reports";
import { formatDate, formatMonth } from "@/lib/format";
import type { ReportData, ReportRow } from "@/lib/reports";
import { uz } from "@/lib/uz";
import { attendanceReport } from "./attendance-report";
import { loadAccounts } from "./finance";
import type { LoadArgs } from "./reports";

/*
 * O'quv hisobotlari (E5b, ADR 0031). Hisob — lib/academic-reports.ts; bu yerda faqat ma'lumot yig'iladi.
 * Davomat ko'rsatkichlari davomat hisoboti bilan bir xil funksiyadan (ADR 0014), qarz — o'quvchi hisobidan.
 */

const t = uz.reports;
const pctLabel = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

/* ---------- Guruhdan chiqish sabablari ---------- */

export async function leavesReport({ db, filter, period }: LoadArgs): Promise<ReportData> {
  const k = t.leaves;
  const rows = await db
    .select({
      id: groupMemberships.id,
      studentId: groupMemberships.studentId,
      groupId: groupMemberships.groupId,
      enrolledAt: groupMemberships.enrolledAt,
      activatedAt: groupMemberships.activatedAt,
      leftAt: groupMemberships.leftAt,
      reason: groupMemberships.leftReason,
      note: groupMemberships.leftNote,
      studentName: students.name,
      groupName: groups.name,
      courseName: courses.name,
      teacherName: teachers.name,
      attended: sql<number>`count(*) filter (where ${attendance.status} in ('present', 'late'))`.mapWith(Number),
      marked: count(attendance.id),
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .innerJoin(students, eq(students.id, groupMemberships.studentId))
    .innerJoin(courses, eq(courses.id, groups.courseId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    // Faqat a'zolik davridagi belgilar
    .leftJoin(
      attendance,
      and(
        eq(attendance.studentId, groupMemberships.studentId),
        eq(attendance.groupId, groupMemberships.groupId),
        gte(attendance.date, groupMemberships.enrolledAt),
        lte(attendance.date, groupMemberships.leftAt),
      ),
    )
    .where(
      and(
        isNotNull(groupMemberships.leftAt),
        filter ? inArray(groups.branchId, [...filter]) : undefined,
        period.range ? gte(groupMemberships.leftAt, period.range.from) : undefined,
        period.range ? lt(groupMemberships.leftAt, period.range.to) : undefined,
      ),
    )
    .groupBy(groupMemberships.id, students.id, groups.id, courses.id, teachers.id);

  const records: LeaveRecord[] = rows.map((r) => ({
    membershipId: r.id,
    studentId: r.studentId,
    groupId: r.groupId,
    enrolledAt: r.enrolledAt,
    leftAt: r.leftAt!,
    trial: r.activatedAt === null,
    reason: r.reason,
    attended: r.attended,
    marked: r.marked,
  }));
  const sum = leaveSummary(records, k.noReason);
  const groupInfo = new Map(rows.map((r) => [r.groupId, { name: r.groupName, teacher: r.teacherName }]));
  const sorted = [...rows].sort(
    (a, b) => b.leftAt!.localeCompare(a.leftAt!) || a.studentName.localeCompare(b.studentName),
  );

  return {
    metrics: [
      { label: k.total, value: sum.total, kind: "number", tone: "danger" },
      { label: k.students, value: sum.students, kind: "number" },
      {
        label: k.trial,
        value: sum.trial,
        kind: "number",
        foot: sum.total ? k.trialFoot(pctLabel((sum.trial / sum.total) * 100)) : undefined,
      },
      {
        label: k.avgDays,
        value: sum.avgDays === null ? null : Math.round(sum.avgDays),
        kind: "number",
        foot: sum.avgDays === null ? undefined : k.daysUnit,
      },
    ],
    table: {
      columns: [
        { key: "reason", label: k.reason, kind: "text" },
        { key: "count", label: k.count, kind: "number" },
        { key: "share", label: k.share, kind: "percent" },
        { key: "trial", label: k.trialCol, kind: "number" },
        { key: "active", label: k.activeCol, kind: "number" },
        { key: "avgDays", label: k.avgDaysCol, kind: "number" },
        { key: "rate", label: k.rate, kind: "percent" },
      ],
      rows: [
        ...sum.byReason.map((r): ReportRow => ({
          cells: {
            reason: r.reason,
            count: r.count,
            share: r.share,
            trial: r.trial,
            active: r.active,
            avgDays: r.avgDays === null ? null : Math.round(r.avgDays),
            rate: r.rate,
          },
        })),
        {
          kind: "total",
          cells: {
            reason: t.total,
            count: sum.total,
            share: sum.total ? 100 : null,
            trial: sum.trial,
            active: sum.total - sum.trial,
            avgDays: sum.avgDays === null ? null : Math.round(sum.avgDays),
            rate: null,
          },
        },
      ],
    },
    note: k.footnote,
    extra: [
      {
        title: k.byGroup,
        table: {
          columns: [
            { key: "group", label: k.group, kind: "text" },
            { key: "teacher", label: k.teacher, kind: "text" },
            { key: "count", label: k.count, kind: "number" },
            { key: "trial", label: k.trialCol, kind: "number" },
            { key: "share", label: k.share, kind: "percent" },
          ],
          rows: sum.byGroup.map((g) => ({
            href: `/groups/${g.groupId}`,
            cells: {
              group: groupInfo.get(g.groupId)?.name ?? "—",
              teacher: groupInfo.get(g.groupId)?.teacher ?? "—",
              count: g.count,
              trial: g.trial,
              share: g.share,
            },
          })),
        },
      },
      {
        title: k.list,
        table: {
          columns: [
            { key: "student", label: k.student, kind: "text" },
            { key: "group", label: k.group, kind: "text" },
            { key: "course", label: k.course, kind: "text" },
            { key: "teacher", label: k.teacher, kind: "text" },
            { key: "enrolled", label: k.enrolled, kind: "text" },
            { key: "left", label: k.left, kind: "text" },
            { key: "days", label: k.days, kind: "number" },
            { key: "status", label: k.status, kind: "text" },
            { key: "reason", label: k.reason, kind: "text" },
            { key: "note", label: k.note, kind: "text" },
            { key: "rate", label: k.rate, kind: "percent" },
          ],
          rows: sorted.map((r) => ({
            href: `/students/${r.studentId}`,
            cells: {
              student: r.studentName,
              group: r.groupName,
              course: r.courseName,
              teacher: r.teacherName,
              enrolled: formatDate(r.enrolledAt),
              left: formatDate(r.leftAt!),
              days: daysBetween(r.enrolledAt, r.leftAt!),
              status: r.activatedAt === null ? k.statusTrial : k.statusActive,
              reason: r.reason?.trim() || k.noReason,
              note: r.note,
              rate: r.marked ? (r.attended / r.marked) * 100 : null,
            },
          })),
        },
      },
    ],
  };
}

/* ---------- Xavfli o'quvchilar ---------- */

const LEVEL_ORDER = { critical: 0, high: 1, medium: 2 } as const;

const minusDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd! - n)).toISOString().slice(0, 10);
};

export async function riskReport({ db, filter, today }: LoadArgs): Promise<ReportData> {
  const k = t.risk;
  const all = await attendanceReport(db, filter, { from: minusDays(today, 29), to: today, today });
  const current = all.filter((r) => r.memberStatus === "trial" || r.memberStatus === "active");
  const accounts = await loadAccounts(db, [...new Set(current.map((r) => r.studentId))], today);
  const debtOf = (id: string) => accounts.get(id)?.summary.debt ?? 0;

  const rows = current
    .map((r) => {
      const risk = riskOf({
        consecutive: r.consecutive,
        missedThisMonth: r.missedThisMonth,
        rate: r.rate,
        marked: r.present + r.late + r.missed,
        contacted: r.contacted,
        debt: debtOf(r.studentId),
      });
      return risk ? { ...r, risk } : null;
    })
    .filter((r) => r !== null)
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.risk.level] - LEVEL_ORDER[b.risk.level] ||
        b.risk.score - a.risk.score ||
        a.name.localeCompare(b.name),
    );

  const students = (pick: (r: (typeof rows)[number]) => boolean) =>
    new Set(rows.filter(pick).map((r) => r.studentId)).size;
  const activeStudents = new Set(current.map((r) => r.studentId)).size;
  const atRisk = students(() => true);

  return {
    metrics: [
      {
        label: k.total,
        value: atRisk,
        kind: "number",
        tone: "danger",
        foot: activeStudents ? k.totalFoot(pctLabel((atRisk / activeStudents) * 100)) : undefined,
      },
      { label: k.critical, value: students((r) => r.risk.level === "critical"), kind: "number", tone: "danger" },
      {
        label: k.uncontacted,
        value: students((r) => r.risk.factors.includes("uncontacted")),
        kind: "number",
        tone: "warning",
      },
      { label: k.debtors, value: students((r) => r.risk.factors.includes("debt")), kind: "number" },
    ],
    table: {
      columns: [
        { key: "student", label: k.student, kind: "text" },
        { key: "group", label: k.group, kind: "text" },
        { key: "teacher", label: k.teacher, kind: "text" },
        { key: "level", label: k.level, kind: "text" },
        { key: "score", label: k.score, kind: "number" },
        { key: "consecutive", label: k.consecutive, kind: "number" },
        { key: "monthMissed", label: k.monthMissed, kind: "number" },
        { key: "rate", label: k.rate, kind: "percent" },
        { key: "factors", label: k.factors, kind: "text" },
      ],
      rows: rows.map((r) => ({
        href: `/students/${r.studentId}`,
        cells: {
          student: r.name,
          group: r.groupName,
          teacher: r.teacherName,
          level: k.levels[r.risk.level]!,
          score: r.risk.score,
          consecutive: r.consecutive,
          monthMissed: r.missedThisMonth,
          rate: r.rate,
          factors: r.risk.factors.map((f) => k.factorLabels[f]).join(", "),
        },
      })),
    },
    note: k.footnote,
  };
}

/* ---------- O'quvchini ushlab turish ---------- */

export async function retentionReport({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const k = t.retention;
  const rows = await db
    .select({
      studentId: groupMemberships.studentId,
      enrolledAt: groupMemberships.enrolledAt,
      activatedAt: groupMemberships.activatedAt,
      leftAt: groupMemberships.leftAt,
      reason: groupMemberships.leftReason,
      courseId: groups.courseId,
      archived: sql<boolean>`${students.archivedAt} is not null`,
    })
    .from(groupMemberships)
    .innerJoin(students, eq(students.id, groupMemberships.studentId))
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(and(isNotNull(groupMemberships.activatedAt), filter ? inArray(students.branchId, [...filter]) : undefined));
  const courseRows = await db.select({ id: courses.id, name: courses.name }).from(courses);
  const courseName = new Map(courseRows.map((c) => [c.id, c.name]));

  const byStudent = new Map<string, typeof rows>();
  for (const r of rows) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
  const spans: StudentSpan[] = [...byStudent].map(([studentId, list]) => {
    const churned = list[0]!.archived || list.every((m) => m.leftAt !== null);
    const firstJoin = list.map((m) => m.activatedAt!).sort()[0]!;
    // Ketgan bo'lsa — oxirgi chiqqan a'zoligi; aks holda eng so'nggi ochiq a'zoligi
    const last = churned
      ? [...list].sort((a, b) => (b.leftAt ?? "").localeCompare(a.leftAt ?? ""))[0]!
      : [...list].filter((m) => m.leftAt === null).sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))[0]!;
    return {
      studentId,
      firstJoin,
      churned,
      lastLeft: churned ? (last.leftAt ?? null) : null,
      lastReason: churned ? last.reason : null,
      courseId: last.courseId,
    };
  });

  const stats = churnStats(spans, period.range);
  const months = stats.churned.filter((s) => s.lastLeft).map((s) => daysBetween(s.firstJoin, s.lastLeft!) / 30.4);
  const avgMonths = months.length ? months.reduce((a, b) => a + b, 0) / months.length : null;

  const byCourse = new Map<string, { base: number; churned: number }>();
  const churnedIds = new Set(stats.churned.map((s) => s.studentId));
  for (const s of stats.base) {
    const key = s.courseId ?? "";
    const c = byCourse.get(key) ?? { base: 0, churned: 0 };
    c.base++;
    if (churnedIds.has(s.studentId)) c.churned++;
    byCourse.set(key, c);
  }
  const reasons = new Map<string, number>();
  for (const s of stats.churned) {
    const key = s.lastReason?.trim() || k.noReason;
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  const cohortRows = cohorts(spans, today);
  const n = cohortRows.length;

  return {
    metrics: [
      {
        label: k.rate,
        value: stats.retentionRate,
        kind: "percent",
        tone: "success",
        foot: k.rateFoot(stats.base.length, stats.base.length - stats.churned.length),
      },
      { label: k.churned, value: stats.churned.length, kind: "number", tone: "danger" },
      { label: k.churnRate, value: stats.churnRate, kind: "percent" },
      {
        label: k.avgMonths,
        value: avgMonths === null ? null : Math.round(avgMonths * 10) / 10,
        kind: "number",
        foot: avgMonths === null ? undefined : k.monthsUnit,
      },
    ],
    table: {
      columns: [
        { key: "course", label: k.course, kind: "text" },
        { key: "base", label: k.base, kind: "number" },
        { key: "churned", label: k.churnedCol, kind: "number" },
        { key: "churn", label: k.churnCol, kind: "percent" },
        { key: "kept", label: k.keptCol, kind: "percent" },
      ],
      rows: [
        ...[...byCourse]
          .sort((a, b) => b[1].churned - a[1].churned || b[1].base - a[1].base)
          .map(([id, c]) => {
            const churn = c.base ? (c.churned / c.base) * 100 : null;
            return {
              cells: {
                course: courseName.get(id) ?? k.noCourse,
                base: c.base,
                churned: c.churned,
                churn,
                kept: churn === null ? null : 100 - churn,
              },
            };
          }),
        {
          kind: "total" as const,
          cells: {
            course: t.total,
            base: stats.base.length,
            churned: stats.churned.length,
            churn: stats.churnRate,
            kept: stats.retentionRate,
          },
        },
      ],
    },
    note: k.footnote,
    extra: [
      {
        title: k.reasons,
        table: {
          columns: [
            { key: "reason", label: k.reason, kind: "text" },
            { key: "count", label: k.count, kind: "number" },
            { key: "share", label: k.share, kind: "percent" },
          ],
          rows: [...reasons]
            .sort((a, b) => b[1] - a[1])
            .map(([reason, count]) => ({
              cells: { reason, count, share: (count / stats.churned.length) * 100 },
            })),
        },
      },
      {
        title: k.cohorts,
        table: {
          columns: [
            { key: "month", label: k.cohortMonth, kind: "text" },
            { key: "size", label: k.cohortSize, kind: "number" },
            ...Array.from({ length: n }, (_, i) => ({ key: `m${i}`, label: k.cohortK(i), kind: "percent" as const })),
          ],
          rows: cohortRows.map((c) => ({
            cells: {
              month: formatMonth(c.month),
              size: c.size,
              ...Object.fromEntries(c.cells.map((v, i) => [`m${i}`, v])),
            },
          })),
        },
      },
    ],
  };
}
