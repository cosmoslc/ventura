import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { auditEvents, branches, courses, groups, leads, students, teachers, users } from "@ventura/db/schema/tenant";
import {
  type ActivitySection,
  type DetailItem,
  MIRROR_ACTIONS,
  deviceLabel,
  describeAction,
  safeMetadata,
  sectionActionIds,
  sectionOf,
} from "@/lib/activity-log";

/*
 * Faoliyat jurnali ko'rinishi (E6c, ADR 0037): `audit_events` (xesh zanjiri, ADR 0002) dan o'qish. Yozuvlar o'zgarmaydi,
 * bu yerda faqat o'qiladi. Sahifalash — sahifa raqami bo'yicha, 50 tadan. Pul amallari tarixi (money-audit) shu
 * jurnalning tayyor filtri bo'lib qoladi.
 */

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityQuery {
  /** Toshkent kunlari [from, to], ikkalasi ham kiradi */
  from: string;
  to: string;
  actorId: string | null;
  section: ActivitySection | null;
  q: string;
  page: number;
}

export interface ActivityRow {
  id: string;
  seq: number;
  at: string;
  actorName: string | null;
  section: ActivitySection;
  sentence: string;
  ip: string | null;
  device: string | null;
  action: string;
  details: DetailItem[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** [from, to] Toshkent kunlari → vaqt oralig'i */
function bounds(from: string, to: string) {
  return {
    start: new Date(`${from}T00:00:00+05:00`),
    end: new Date(new Date(`${to}T00:00:00+05:00`).getTime() + 86_400_000),
  };
}

/** Aks yozuvlar ro'yxatda ikki marta chiqmasin (student.enroll — group.enroll bilan bir amal) */
const notMirror = () => notInArray(auditEvents.action, [...MIRROR_ACTIONS]);

function sectionCondition(section: ActivitySection): SQL | undefined {
  const { ids, negate } = sectionActionIds(section);
  if (!ids.length) return negate ? undefined : sql`false`;
  return negate ? notInArray(auditEvents.action, ids) : inArray(auditEvents.action, ids);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function where(query: Pick<ActivityQuery, "from" | "to"> & Partial<ActivityQuery>) {
  const { start, end } = bounds(query.from, query.to);
  const q = query.q?.trim();
  return and(
    gte(auditEvents.at, start),
    lt(auditEvents.at, end),
    notMirror(),
    query.actorId ? eq(auditEvents.actorId, query.actorId) : undefined,
    query.section ? sectionCondition(query.section) : undefined,
    q
      ? or(
          ilike(auditEvents.actorName, `%${escapeLike(q)}%`),
          ilike(auditEvents.action, `%${escapeLike(q)}%`),
          ilike(sql`${auditEvents.metadata}::text`, `%${escapeLike(q)}%`),
        )
      : undefined,
  );
}

/** Nishon nomlari: "tur:id" → nom (faqat ko'rsatiladigan sahifa yozuvlari uchun) */
async function targetNames(
  db: TenantDb,
  rows: { targetType: string | null; targetId: string | null }[],
): Promise<Map<string, string>> {
  const ids = (type: string) => [
    ...new Set(rows.flatMap((r) => (r.targetType === type && r.targetId && UUID.test(r.targetId) ? [r.targetId] : []))),
  ];
  const names = new Map<string, string>();
  const add = (type: string, list: { id: string; name: string }[]) => {
    for (const r of list) names.set(`${type}:${r.id}`, r.name);
  };
  const [st, gr, te, us, le, co, br] = [
    ids("student"),
    ids("group"),
    ids("teacher"),
    ids("user"),
    ids("lead"),
    ids("course"),
    ids("branch"),
  ];
  await Promise.all([
    st.length
      ? db
          .select({ id: students.id, name: students.name })
          .from(students)
          .where(inArray(students.id, st))
          .then((r) => add("student", r))
      : null,
    gr.length
      ? db
          .select({ id: groups.id, name: groups.name })
          .from(groups)
          .where(inArray(groups.id, gr))
          .then((r) => add("group", r))
      : null,
    te.length
      ? db
          .select({ id: teachers.id, name: teachers.name })
          .from(teachers)
          .where(inArray(teachers.id, te))
          .then((r) => add("teacher", r))
      : null,
    us.length
      ? db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, us))
          .then((r) => add("user", r))
      : null,
    le.length
      ? db
          .select({ id: leads.id, name: leads.name })
          .from(leads)
          .where(inArray(leads.id, le))
          .then((r) => add("lead", r))
      : null,
    co.length
      ? db
          .select({ id: courses.id, name: courses.name })
          .from(courses)
          .where(inArray(courses.id, co))
          .then((r) => add("course", r))
      : null,
    br.length
      ? db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .where(inArray(branches.id, br))
          .then((r) => add("branch", r))
      : null,
  ]);
  return names;
}

export async function listActivity(
  db: TenantDb,
  query: ActivityQuery,
): Promise<{ rows: ActivityRow[]; total: number; page: number }> {
  const cond = where(query);
  const [{ n = 0 } = {}] = await db.select({ n: count() }).from(auditEvents).where(cond);
  const pageCount = Math.max(1, Math.ceil(n / ACTIVITY_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const raw = await db
    .select()
    .from(auditEvents)
    .where(cond)
    .orderBy(desc(auditEvents.seq))
    .limit(ACTIVITY_PAGE_SIZE)
    .offset((page - 1) * ACTIVITY_PAGE_SIZE);
  const names = await targetNames(db, raw);
  const rows = raw.map((r): ActivityRow => {
    const targetName = r.targetType && r.targetId ? (names.get(`${r.targetType}:${r.targetId}`) ?? null) : null;
    return {
      id: r.id,
      seq: r.seq,
      at: r.at.toISOString(),
      actorName: r.actorName,
      section: sectionOf(r.action),
      sentence: describeAction(r.action, r.actorName, { metadata: r.metadata, targetName, targetId: r.targetId }),
      ip: r.ip,
      device: deviceLabel(r.userAgent),
      action: r.action,
      details: safeMetadata(r.metadata),
    };
  });
  return { rows, total: n, page };
}

export interface ActorOption {
  id: string;
  name: string;
}

/** Jurnalda amali bor xodimlar (hozir yo'qlari ham — tarix saqlanadi) */
export async function activityActors(db: TenantDb): Promise<ActorOption[]> {
  const rows = await db
    .select({ id: auditEvents.actorId, name: sql<string>`max(${auditEvents.actorName})` })
    .from(auditEvents)
    .where(eq(auditEvents.actorType, "user"))
    .groupBy(auditEvents.actorId)
    .orderBy(asc(sql`max(${auditEvents.actorName})`));
  return rows.flatMap((r) => (r.id ? [{ id: r.id, name: r.name ?? "—" }] : []));
}

export interface StaffActivity {
  actorId: string;
  actorName: string;
  total: number;
  /** Bo'limlar bo'yicha amallar soni, ko'pdan kamga */
  sections: { section: ActivitySection; count: number }[];
}

/** Xodimlar bo'yicha amallar soni va turlari (davr bo'yicha) — eski "Xodimlar faolligi" hisoboti */
export async function staffActivity(db: TenantDb, range: { from: string; to: string }): Promise<StaffActivity[]> {
  const { start, end } = bounds(range.from, range.to);
  const rows = await db
    .select({
      actorId: auditEvents.actorId,
      actorName: sql<string>`max(${auditEvents.actorName})`,
      action: auditEvents.action,
      n: count(),
    })
    .from(auditEvents)
    .where(and(gte(auditEvents.at, start), lt(auditEvents.at, end), eq(auditEvents.actorType, "user"), notMirror()))
    .groupBy(auditEvents.actorId, auditEvents.action);
  const byActor = new Map<string, StaffActivity>();
  const bySection = new Map<string, Map<ActivitySection, number>>();
  for (const r of rows) {
    if (!r.actorId) continue;
    const a = byActor.get(r.actorId) ?? { actorId: r.actorId, actorName: r.actorName ?? "—", total: 0, sections: [] };
    a.total += r.n;
    byActor.set(r.actorId, a);
    const s = bySection.get(r.actorId) ?? new Map<ActivitySection, number>();
    const sec = sectionOf(r.action);
    s.set(sec, (s.get(sec) ?? 0) + r.n);
    bySection.set(r.actorId, s);
  }
  for (const [id, a] of byActor) {
    a.sections = [...(bySection.get(id) ?? [])]
      .map(([section, n]) => ({ section, count: n }))
      .sort((x, y) => y.count - x.count);
  }
  return [...byActor.values()].sort((a, b) => b.total - a.total || a.actorName.localeCompare(b.actorName));
}
