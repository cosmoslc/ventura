import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { type StudentStatus, groupMemberships, membershipPauses, students } from "@ventura/db/schema/tenant";

/*
 * A'zolik davrlari qoidalari (ADR 0012). Bitta joyda: guruh profili, o'quvchi profili va o'quvchi holati
 * o'zgarishi shu funksiyalardan foydalanadi.
 *  - qo'shilganda: sinovda (to'lov yo'q);
 *  - faollashtirish: sana — to'lov shu kundan (E3); muzlatishdan chiqarishda asl faollashtirish sanasi saqlanadi;
 *  - chiqish: davr yopiladi (sana va sabab), yangi qo'shilish — yangi davr.
 */

export type Tx = Parameters<Parameters<TenantDb["transaction"]>[0]>[0];
export type Db = TenantDb | Tx;

/** Mahalliy (Toshkent) sana YYYY-MM-DD */
export function todayTashkent(): string {
  return tashkentDate(new Date());
}

/** Vaqt belgisining Toshkentdagi sanasi YYYY-MM-DD */
export function tashkentDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(at);
}

/** Sana oy boshi: "2026-10-12" → "2026-10-01" */
export const monthStart = (d: string) => `${d.slice(0, 7)}-01`;

/**
 * Muzlatish oraliqlari (ADR 0015): oylik hisob muzlatilgan kunlarni chiqaradi, shuning uchun muzlatishdan
 * chiqqanda oraliq yopiladi, o'chirilmaydi (eski tizimda muzlatish tarixi yo'qolib, o'tgan oylar qayta hisoblanar edi).
 */
export async function openPauses(db: Db, membershipIds: readonly string[], date: string) {
  if (!membershipIds.length) return;
  await db
    .insert(membershipPauses)
    .values(membershipIds.map((membershipId) => ({ membershipId, startDate: date })))
    .onConflictDoNothing();
}

/**
 * Ochiq oraliqlarni `date` bilan yopadi. E3 dan oldin muzlatilgan (oraliq yozuvi yo'q) a'zoliklar uchun
 * paused_at dan yopiq oraliq yoziladi.
 */
export async function closePauses(db: Db, rows: readonly { id: string; pausedAt: string | null }[], date: string) {
  if (!rows.length) return;
  const closed = await db
    .update(membershipPauses)
    .set({ endDate: sql`greatest(${membershipPauses.startDate}, ${date}::date)` })
    .where(
      and(
        inArray(
          membershipPauses.membershipId,
          rows.map((r) => r.id),
        ),
        isNull(membershipPauses.endDate),
      ),
    )
    .returning({ membershipId: membershipPauses.membershipId });
  const done = new Set(closed.map((c) => c.membershipId));
  const legacy = rows.filter((r) => !done.has(r.id) && r.pausedAt);
  if (legacy.length) {
    await db.insert(membershipPauses).values(
      legacy.map((r) => ({
        membershipId: r.id,
        startDate: r.pausedAt!,
        endDate: r.pausedAt! > date ? r.pausedAt! : date,
      })),
    );
  }
}

/**
 * O'quvchi holati o'zgarganda a'zoliklar ham mos o'zgaradi (eski tizimda muzlatish hisobni to'xtatmas edi):
 *  - muzlatilgan → faol a'zoliklar muzlatiladi;
 *  - muzlatilgandan faol/qaytib kelgan → muzlatilgan a'zoliklar qayta faol;
 *  - ketgan/bitirgan → ochiq a'zoliklar yopiladi.
 * Qaytaradi: o'zgargan a'zoliklar soni.
 */
export async function syncMembershipsWithStatus(
  db: Db,
  studentId: string,
  from: StudentStatus,
  to: StudentStatus,
  reason: string | null,
): Promise<number> {
  const today = todayTashkent();
  if (to === "paused") {
    const r = await db
      .update(groupMemberships)
      .set({ status: "paused", pausedAt: today })
      .where(and(eq(groupMemberships.studentId, studentId), eq(groupMemberships.status, "active")))
      .returning({ id: groupMemberships.id });
    await openPauses(
      db,
      r.map((x) => x.id),
      today,
    );
    return r.length;
  }
  if (from === "paused" && (to === "active" || to === "returned")) {
    // Faollashtirilgan a'zoliklar qayta faol; sinovdan to'g'ri muzlatilganlar sinovga qaytadi
    const base = and(eq(groupMemberships.studentId, studentId), eq(groupMemberships.status, "paused"));
    const before = await db
      .select({ id: groupMemberships.id, pausedAt: groupMemberships.pausedAt })
      .from(groupMemberships)
      .where(base);
    await closePauses(db, before, today);
    const a = await db
      .update(groupMemberships)
      .set({ status: "active", pausedAt: null })
      .where(and(base, isNotNull(groupMemberships.activatedAt)))
      .returning({ id: groupMemberships.id });
    const t = await db
      .update(groupMemberships)
      .set({ status: "trial", pausedAt: null })
      .where(and(base, isNull(groupMemberships.activatedAt)))
      .returning({ id: groupMemberships.id });
    return a.length + t.length;
  }
  if (to === "left" || to === "graduated") {
    const open = await db
      .select({ id: groupMemberships.id, pausedAt: groupMemberships.pausedAt })
      .from(groupMemberships)
      .where(and(eq(groupMemberships.studentId, studentId), eq(groupMemberships.status, "paused")));
    await closePauses(db, open, today);
    const r = await db
      .update(groupMemberships)
      .set({ status: "left", leftAt: today, leftReason: reason })
      .where(and(eq(groupMemberships.studentId, studentId), isNull(groupMemberships.leftAt)))
      .returning({ id: groupMemberships.id });
    return r.length;
  }
  return 0;
}

/** Guruhda faollashtirilsa, sinovdagi o'quvchi faol bo'ladi (eski tizimdagi "Faollashtirish" oqimi) */
export async function promoteTrialStudent(db: Db, studentId: string): Promise<boolean> {
  const r = await db
    .update(students)
    .set({ status: "active", statusChangedAt: new Date() })
    .where(and(eq(students.id, studentId), eq(students.status, "trial")))
    .returning({ id: students.id });
  return r.length > 0;
}
