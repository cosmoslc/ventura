import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  coinEntries,
  groupPrices,
  groups,
  payments,
  settings,
  studentDiscounts,
  students,
} from "@ventura/db/schema/tenant";
import { type Tenant, hasFeature } from "@ventura/tenants";
import {
  COINS_KEY,
  type CoinChange,
  type CoinRuleKey,
  type CoinSettings,
  attendanceEarns,
  attendanceKey,
  homeworkKey,
  parseCoinSettings,
  prepayKey,
  prepayQualifies,
} from "@/lib/coins";
import { billingGroupOf } from "./finance";
import type { Db } from "./memberships";

/*
 * Coin daftariga yozish (ADR 0061). Manba amal (to'lov, davomat, uy vazifasi) bilan bir tranzaksiyada chaqiriladi.
 * Hammasi idempotent: berish — `on conflict` bilan faqat yo'q yoki bekor qilingan yozuvni faollashtiradi,
 * olish — faqat faol yozuvni bekor qiladi. Bir xil chaqiruv qayta bajarilsa natija o'zgarmaydi va `null` qaytadi.
 */

export interface CoinRuntime {
  /** `coins` bo'limi yoqilgan */
  active: boolean;
  settings: CoinSettings;
}

export async function getCoinSettings(db: Db): Promise<CoinSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, COINS_KEY));
  return parseCoinSettings(row?.value);
}

export async function coinRuntime(tenant: Pick<Tenant, "features">, db: Db): Promise<CoinRuntime> {
  const active = await hasFeature(tenant, "coins");
  return { active, settings: await getCoinSettings(db) };
}

const earning = (rt: CoinRuntime, rule: CoinRuleKey) => rt.active && rt.settings[rule].enabled;

export interface CoinSource {
  studentId: string;
  groupId: string | null;
  rule: CoinRuleKey;
  sourceKey: string;
  refDate: string;
}

async function award(db: Db, rt: CoinRuntime, src: CoinSource): Promise<CoinChange | null> {
  if (!earning(rt, src.rule)) return null;
  const amount = rt.settings[src.rule].amount;
  const rows = await db
    .insert(coinEntries)
    .values({ ...src, amount })
    .onConflictDoUpdate({
      target: [coinEntries.tenantId, coinEntries.studentId, coinEntries.rule, coinEntries.sourceKey],
      set: { amount, revokedAt: null, updatedAt: new Date() },
      setWhere: sql`${coinEntries.revokedAt} is not null`,
    })
    .returning({ id: coinEntries.id });
  return rows.length ? { rule: src.rule, action: "award", amount } : null;
}

async function revoke(db: Db, src: Pick<CoinSource, "studentId" | "rule" | "sourceKey">): Promise<CoinChange | null> {
  const [row] = await db
    .update(coinEntries)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(coinEntries.studentId, src.studentId),
        eq(coinEntries.rule, src.rule),
        eq(coinEntries.sourceKey, src.sourceKey),
        isNull(coinEntries.revokedAt),
      ),
    )
    .returning({ amount: coinEntries.amount });
  return row ? { rule: src.rule, action: "revoke", amount: row.amount } : null;
}

/** Sabab bor — berish (qoida yoqilgan bo'lsa), yo'q — olish (doim) */
export async function applyCoin(db: Db, rt: CoinRuntime, src: CoinSource, earned: boolean) {
  return earned ? award(db, rt, src) : revoke(db, src);
}

/* ---------- Davomat ---------- */

export function syncAttendanceCoin(
  db: Db,
  rt: CoinRuntime,
  mark: { studentId: string; groupId: string; date: string; status: string | null },
) {
  return applyCoin(
    db,
    rt,
    {
      studentId: mark.studentId,
      groupId: mark.groupId,
      rule: "attendance",
      sourceKey: attendanceKey(mark.groupId, mark.date),
      refDate: mark.date,
    },
    attendanceEarns(mark.status),
  );
}

/** "Hammasi bor": bir nechta o'quvchiga birdan; berilganlar soni va jami */
export async function awardAttendanceMany(
  db: Db,
  rt: CoinRuntime,
  groupId: string,
  date: string,
  studentIds: readonly string[],
): Promise<{ count: number; amount: number }> {
  if (!earning(rt, "attendance") || !studentIds.length) return { count: 0, amount: 0 };
  const amount = rt.settings.attendance.amount;
  const rows = await db
    .insert(coinEntries)
    .values(
      studentIds.map((studentId) => ({
        studentId,
        groupId,
        rule: "attendance" as const,
        sourceKey: attendanceKey(groupId, date),
        refDate: date,
        amount,
      })),
    )
    .onConflictDoUpdate({
      target: [coinEntries.tenantId, coinEntries.studentId, coinEntries.rule, coinEntries.sourceKey],
      set: { amount, revokedAt: null, updatedAt: new Date() },
      setWhere: sql`${coinEntries.revokedAt} is not null`,
    })
    .returning({ id: coinEntries.id });
  return { count: rows.length, amount: rows.length * amount };
}

/* ---------- Uy vazifasi ---------- */

/** Baholashdagi "bajardi" belgisi; "bajarmadi" yoki belgisiz — coin olinadi */
export function syncHomeworkCoin(
  db: Db,
  rt: CoinRuntime,
  mark: { studentId: string; groupId: string; date: string; homework: boolean | null },
) {
  return applyCoin(
    db,
    rt,
    {
      studentId: mark.studentId,
      groupId: mark.groupId,
      rule: "homework",
      sourceKey: homeworkKey(mark.groupId, mark.date),
      refDate: mark.date,
    },
    mark.homework === true,
  );
}

/* ---------- Oldindan to'lov ---------- */

/**
 * Guruh-oy uchun oldindan to'lov shartini qayta ko'radi (to'lov yozilganda, bekor qilinganda, tiklanganda,
 * tahrirlanganda). Qoida o'chiq va faol coin yo'q bo'lsa — hech narsa o'qilmaydi.
 */
export async function syncPrepayCoin(
  db: Db,
  rt: CoinRuntime,
  target: { studentId: string; groupId: string; month: string },
): Promise<CoinChange | null> {
  const src: CoinSource = {
    studentId: target.studentId,
    groupId: target.groupId,
    rule: "prepay",
    sourceKey: prepayKey(target.groupId, target.month),
    refDate: `${target.month}-01`,
  };
  if (!earning(rt, "prepay")) {
    const [has] = await db
      .select({ id: coinEntries.id })
      .from(coinEntries)
      .where(
        and(
          eq(coinEntries.studentId, src.studentId),
          eq(coinEntries.rule, "prepay"),
          eq(coinEntries.sourceKey, src.sourceKey),
          isNull(coinEntries.revokedAt),
        ),
      );
    if (!has) return null;
  }
  const [[g], prices, discounts, entries] = await Promise.all([
    db
      .select({
        id: groups.id,
        branchId: groups.branchId,
        days: groups.days,
        startDate: groups.startDate,
        price: groups.price,
      })
      .from(groups)
      .where(eq(groups.id, target.groupId)),
    db
      .select({ fromMonth: groupPrices.fromMonth, price: groupPrices.price })
      .from(groupPrices)
      .where(eq(groupPrices.groupId, target.groupId)),
    db
      .select({
        id: studentDiscounts.id,
        groupId: studentDiscounts.groupId,
        kind: studentDiscounts.kind,
        value: studentDiscounts.value,
        fromMonth: studentDiscounts.fromMonth,
        toMonth: studentDiscounts.toMonth,
        affectsTeacher: studentDiscounts.affectsTeacher,
      })
      .from(studentDiscounts)
      .where(eq(studentDiscounts.studentId, target.studentId)),
    db
      .select({ kind: payments.kind, amount: payments.amount, date: payments.date })
      .from(payments)
      .where(
        and(
          eq(payments.studentId, target.studentId),
          eq(payments.groupId, target.groupId),
          eq(payments.month, target.month),
          isNull(payments.voidedAt),
        ),
      ),
  ]);
  if (!g) return null;
  const ok = prepayQualifies({
    month: target.month,
    groupId: target.groupId,
    prices: billingGroupOf(g, prices).prices,
    discounts,
    entries,
  });
  return applyCoin(db, rt, src, ok);
}

/* ---------- O'qish ---------- */

/** O'quvchi balansi (bekor qilinmagan yozuvlar yig'indisi) */
export async function coinBalance(db: Db, studentId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${coinEntries.amount}), 0)::int` })
    .from(coinEntries)
    .where(and(eq(coinEntries.studentId, studentId), isNull(coinEntries.revokedAt)));
  return row?.total ?? 0;
}

export interface CoinLeader {
  studentId: string;
  name: string;
  branchId: string;
  archived: boolean;
  balance: number;
  /** Shu oy berilgan */
  month: number;
}

/** Reyting: coini bor o'quvchilar, ko'pdan kamga. `branchIds` null — cheklovsiz (direktor, barcha filiallar) */
export async function coinLeaders(
  db: Db,
  opts: { branchIds: readonly string[] | null; month: string },
): Promise<CoinLeader[]> {
  if (opts.branchIds?.length === 0) return [];
  const start = `${opts.month}-01`;
  const rows = await db
    .select({
      studentId: coinEntries.studentId,
      name: students.name,
      branchId: students.branchId,
      archivedAt: students.archivedAt,
      balance: sql<number>`sum(${coinEntries.amount})::int`,
      month: sql<number>`coalesce(sum(${coinEntries.amount}) filter (where ${coinEntries.refDate} >= ${start}::date
        and ${coinEntries.refDate} < (${start}::date + interval '1 month')), 0)::int`,
    })
    .from(coinEntries)
    .innerJoin(students, eq(students.id, coinEntries.studentId))
    .where(
      and(isNull(coinEntries.revokedAt), opts.branchIds ? inArray(students.branchId, [...opts.branchIds]) : undefined),
    )
    .groupBy(coinEntries.studentId, students.name, students.branchId, students.archivedAt)
    .orderBy(desc(sql`sum(${coinEntries.amount})`), students.name);
  return rows.map((r) => ({
    studentId: r.studentId,
    name: r.name,
    branchId: r.branchId,
    archived: r.archivedAt !== null,
    balance: r.balance,
    month: r.month,
  }));
}

export interface CoinHistoryRow {
  id: string;
  rule: CoinRuleKey;
  amount: number;
  refDate: string;
  groupId: string | null;
  groupName: string | null;
  revoked: boolean;
  createdAt: Date;
}

/** O'quvchi coin tarixi (bekor qilinganlari ham — ustidan chizilgan holda ko'rsatiladi) */
export async function coinHistory(db: Db, studentId: string, limit = 200): Promise<CoinHistoryRow[]> {
  const rows = await db
    .select({
      id: coinEntries.id,
      rule: coinEntries.rule,
      amount: coinEntries.amount,
      refDate: coinEntries.refDate,
      groupId: coinEntries.groupId,
      groupName: groups.name,
      revokedAt: coinEntries.revokedAt,
      createdAt: coinEntries.createdAt,
    })
    .from(coinEntries)
    .leftJoin(groups, eq(groups.id, coinEntries.groupId))
    .where(eq(coinEntries.studentId, studentId))
    .orderBy(desc(coinEntries.refDate), desc(coinEntries.createdAt))
    .limit(limit);
  return rows.map(({ revokedAt, ...r }) => ({ ...r, revoked: revokedAt !== null }));
}
