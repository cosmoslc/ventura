import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { attendance, groupMemberships, groups, leadStages, leads, payments, students } from "@ventura/db/schema/tenant";
import { type OperationalMonth, operationalMonths } from "@/lib/operational";

/*
 * Pul oqimi sahifasining "Operatsion ko'rsatkichlar" bo'limi uchun ma'lumot (eski tizimdagi hisobotning ikkinchi
 * jadvali). Hisob — lib/operational.ts; bu yerda faqat bazadan yig'iladi. Filial filtri — tepadagi umumiy tanlov.
 */

type Filter = readonly string[] | null;

export async function loadOperational(
  db: TenantDb,
  filter: Filter,
  year: number,
  today: string,
): Promise<OperationalMonth[]> {
  const ids = filter ? [...filter] : null;
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const [leadRows, payRows, stintRows, groupRows, attRows] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${leads.createdAt} at time zone 'Asia/Tashkent', 'YYYY-MM')`,
        n: sql<number>`count(*)::int`,
        won: sql<number>`count(*) filter (where ${leadStages.kind} = 'won')::int`,
      })
      .from(leads)
      .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
      .where(and(isNull(leads.archivedAt), ids ? inArray(leads.branchId, ids) : undefined))
      .groupBy(sql`1`),
    // Birinchi (bekor qilinmagan) to'lov oyi — har o'quvchi uchun bitta
    db
      .select({ month: sql<string>`to_char(min(${payments.date}), 'YYYY-MM')` })
      .from(payments)
      .innerJoin(students, eq(students.id, payments.studentId))
      .where(
        and(eq(payments.kind, "payment"), isNull(payments.voidedAt), ids ? inArray(students.branchId, ids) : undefined),
      )
      .groupBy(payments.studentId),
    db
      .select({
        studentId: groupMemberships.studentId,
        from: groupMemberships.activatedAt,
        to: groupMemberships.leftAt,
      })
      .from(groupMemberships)
      .innerJoin(students, eq(students.id, groupMemberships.studentId))
      .where(and(isNotNull(groupMemberships.activatedAt), ids ? inArray(students.branchId, ids) : undefined)),
    db
      .select({
        start: groups.startDate,
        end: sql<string | null>`to_char(${groups.archivedAt} at time zone 'Asia/Tashkent', 'YYYY-MM-DD')`,
      })
      .from(groups)
      .where(ids ? inArray(groups.branchId, ids) : undefined),
    db
      .select({
        month: sql<string>`to_char(${attendance.date}, 'YYYY-MM')`,
        present: sql<number>`count(*) filter (where ${attendance.status} in ('present', 'late'))::int`,
        marked: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .innerJoin(groups, eq(groups.id, attendance.groupId))
      .where(and(gte(attendance.date, from), lt(attendance.date, to), ids ? inArray(groups.branchId, ids) : undefined))
      .groupBy(sql`1`),
  ]);

  const firstPayers = new Map<string, number>();
  for (const r of payRows) firstPayers.set(r.month, (firstPayers.get(r.month) ?? 0) + 1);

  return operationalMonths(
    {
      leads: new Map(leadRows.map((r) => [r.month, r.n])),
      won: new Map(leadRows.map((r) => [r.month, r.won])),
      firstPayers,
      stints: stintRows.map((r) => ({ studentId: r.studentId, from: r.from!, to: r.to })),
      groups: groupRows,
      attendance: new Map(attRows.map((r) => [r.month, { present: r.present, marked: r.marked }])),
    },
    year,
    today,
  );
}
