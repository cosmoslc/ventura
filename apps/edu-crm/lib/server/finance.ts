import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import type { TenantDb } from "@ventura/db";
import {
  attendance,
  groupMemberships,
  groupPrices,
  groups,
  membershipPauses,
  paymentMethods,
  payments,
  settings,
  studentDiscounts,
} from "@ventura/db/schema/tenant";
import { holidayRanges } from "@/app/(crm)/(settings)/holidays/data";
import {
  type BillingGroup,
  type BillingMembership,
  type BillingSettings,
  type Discount,
  type Mark,
  type MonthCharge,
  OPENING_MONTH,
  billingMonths,
  monthCharge,
  monthOf,
} from "@/lib/billing";
import { type LedgerEntry, type LedgerSummary, summarize } from "@/lib/ledger";
import { monthRange } from "@/lib/lessons";
import type { Db } from "./memberships";

/*
 * O'quvchi hisobi ma'lumoti (ADR 0015): bazadan kirishlarni yig'ib, toza hisob funksiyalariga beradi.
 * Qarzdorlar, o'quvchi profili, to'lov formasi va (E3c) maosh shu yerdan oladi — boshqa joyda qarz hisoblanmaydi.
 */

/* ---------- Sozlamalar ---------- */

export const financeSettingsSchema = z.object({
  mode: z.enum(["monthly", "per_lesson"]).default("monthly"),
  excusedRefund: z.boolean().default(true),
  /** To'lov muddati — har oyning shu kuni (eski tizimda 10 qattiq yozilgan edi) */
  dueDay: z.number().int().min(1).max(28).default(10),
  /** Bir martalik chegirma shu foizdan oshsa ogohlantiriladi */
  maxDiscountPercent: z.number().int().min(0).max(100).default(25),
});
export type FinanceSettings = z.infer<typeof financeSettingsSchema>;
export const FINANCE_SETTINGS_KEY = "finance";

export async function getFinanceSettings(db: Db): Promise<FinanceSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, FINANCE_SETTINGS_KEY));
  const parsed = financeSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : financeSettingsSchema.parse({});
}

export const billingOf = (s: FinanceSettings): BillingSettings => ({ mode: s.mode, excusedRefund: s.excusedRefund });

/* ---------- To'lov turlari ---------- */

export const DEFAULT_PAYMENT_METHODS = ["Naqd pul", "Plastik karta", "Click", "Payme", "Bank o'tkazmasi"];

export interface PaymentMethodRow {
  id: string;
  name: string;
  active: boolean;
}

/** To'lov turlari; mijozda hali yo'q bo'lsa standartlari yaratiladi */
export async function ensurePaymentMethods(db: TenantDb): Promise<PaymentMethodRow[]> {
  const list = () =>
    db
      .select({ id: paymentMethods.id, name: paymentMethods.name, active: paymentMethods.active })
      .from(paymentMethods)
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.createdAt));
  const rows = await list();
  if (rows.length) return rows;
  await db
    .insert(paymentMethods)
    .values(DEFAULT_PAYMENT_METHODS.map((name, i) => ({ name, sortOrder: i })))
    .onConflictDoNothing();
  return list();
}

/* ---------- Hisob ---------- */

export interface StudentAccount {
  studentId: string;
  charges: MonthCharge[];
  /** Doimiy chegirmalar (o'qituvchi ulushi koeffitsienti uchun — lib/payroll.ts) */
  discounts: Discount[];
  entries: LedgerEntry[];
  summary: LedgerSummary;
}

function groupBy<T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const list = map.get(k);
    if (list) list.push(x);
    else map.set(k, [x]);
  }
  return map;
}

const CHUNK = 1000;
function chunks<T>(xs: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
}
async function inChunks<T, R>(xs: readonly T[], run: (part: T[]) => Promise<R[]>): Promise<R[]> {
  const parts = await Promise.all(chunks(xs).map(run));
  return parts.flat();
}

/** Bir guruhning hisob kirishi: narx tarixi bo'lmasa guruhning joriy narxi (eski guruhlar) */
export function billingGroupOf(
  g: { id: string; branchId: string; days: readonly string[]; startDate: string; price: number },
  steps: readonly { fromMonth: string; price: number }[],
): BillingGroup {
  return {
    id: g.id,
    branchId: g.branchId,
    days: g.days,
    startDate: g.startDate,
    prices: steps.length ? steps : [{ fromMonth: OPENING_MONTH, price: g.price }],
  };
}

/** A'zolik kirishi: muzlatilgan, lekin oraliq yozuvi yo'q (E3 dan oldingi) bo'lsa — paused_at dan ochiq oraliq */
export function billingMembershipOf(
  m: {
    id: string;
    groupId: string;
    status: string;
    activatedAt: string | null;
    pausedAt: string | null;
    leftAt: string | null;
  },
  pauses: readonly { startDate: string; endDate: string | null }[],
): BillingMembership {
  const list = pauses.map((p) => ({ from: p.startDate, to: p.endDate }));
  if (m.status === "paused" && m.pausedAt && !list.some((p) => p.to === null))
    list.push({ from: m.pausedAt, to: null });
  return { id: m.id, groupId: m.groupId, activatedAt: m.activatedAt, leftAt: m.leftAt, pauses: list };
}

export async function loadAccounts(
  db: Db,
  studentIds: readonly string[],
  today: string,
  fs?: FinanceSettings,
  /** Taxminiy hisob uchun: a'zolik shu sanada chiqqan deb hisoblansin (guruhdan chiqarish oynasi) */
  leaveOverride?: { membershipId: string; leftAt: string },
): Promise<Map<string, StudentAccount>> {
  const result = new Map<string, StudentAccount>();
  const ids = [...new Set(studentIds)];
  if (!ids.length) return result;
  const conf = fs ?? (await getFinanceSettings(db));
  const billing = billingOf(conf);
  const currentMonth = monthOf(today);

  const [memberships, entryRows, discountRows] = await Promise.all([
    inChunks(ids, (part) => db.select().from(groupMemberships).where(inArray(groupMemberships.studentId, part))),
    inChunks(ids, (part) =>
      db
        .select()
        .from(payments)
        .where(and(inArray(payments.studentId, part), isNull(payments.voidedAt))),
    ),
    inChunks(ids, (part) => db.select().from(studentDiscounts).where(inArray(studentDiscounts.studentId, part))),
  ]);

  const billed = memberships
    .filter((m) => m.activatedAt !== null)
    .map((m) => (leaveOverride && m.id === leaveOverride.membershipId ? { ...m, leftAt: leaveOverride.leftAt } : m));
  const groupIds = [...new Set(billed.map((m) => m.groupId))];
  const membershipIds = billed.map((m) => m.id);
  const [groupRows, priceRows, pauseRows] = await Promise.all([
    inChunks(groupIds, (part) => db.select().from(groups).where(inArray(groups.id, part))),
    inChunks(groupIds, (part) => db.select().from(groupPrices).where(inArray(groupPrices.groupId, part))),
    inChunks(membershipIds, (part) =>
      db.select().from(membershipPauses).where(inArray(membershipPauses.membershipId, part)),
    ),
  ]);

  const pricesOf = groupBy(priceRows, (p) => p.groupId);
  const pausesOf = groupBy(pauseRows, (p) => p.membershipId);
  const groupById = new Map(groupRows.map((g) => [g.id, billingGroupOf(g, pricesOf.get(g.id) ?? [])]));

  // Davomat faqat kerak bo'lganda: oylik rejimda — sababli belgilar, dars rejimida — hammasi
  const firstMonth = billed.reduce<string | null>((min, m) => {
    const mo = monthOf(m.activatedAt!);
    return min === null || mo < min ? mo : min;
  }, null);
  const from = firstMonth ? monthRange(firstMonth)[0] : today;
  const to = monthRange(currentMonth)[1];
  const needMarks = billing.mode === "per_lesson" || billing.excusedRefund;
  const [holidays, markRows] = await Promise.all([
    firstMonth ? holidayRanges(db, from, to) : Promise.resolve([]),
    needMarks && billed.length
      ? inChunks(ids, (part) =>
          db
            .select({
              studentId: attendance.studentId,
              groupId: attendance.groupId,
              date: attendance.date,
              status: attendance.status,
            })
            .from(attendance)
            .where(
              and(
                inArray(attendance.studentId, part),
                gte(attendance.date, from),
                lte(attendance.date, to),
                billing.mode === "monthly" ? eq(attendance.status, "excused") : undefined,
              ),
            ),
        )
      : Promise.resolve([]),
  ]);

  const marksOf = new Map<string, Map<string, Mark>>();
  for (const a of markRows) {
    const key = `${a.studentId}|${a.groupId}`;
    const map = marksOf.get(key) ?? new Map<string, Mark>();
    map.set(a.date, a.status);
    marksOf.set(key, map);
  }

  const membershipsOf = groupBy(billed, (m) => m.studentId);
  const entriesOf = groupBy(entryRows, (e) => e.studentId);
  const discountsOf = groupBy(discountRows, (d) => d.studentId);
  for (const studentId of ids) {
    const discounts: Discount[] = (discountsOf.get(studentId) ?? []).map((d) => ({
      id: d.id,
      groupId: d.groupId,
      kind: d.kind,
      value: d.value,
      fromMonth: d.fromMonth,
      toMonth: d.toMonth,
      affectsTeacher: d.affectsTeacher,
    }));
    const charges: MonthCharge[] = [];
    for (const m of membershipsOf.get(studentId) ?? []) {
      const g = groupById.get(m.groupId);
      if (!g) continue;
      const bm = billingMembershipOf(m, pausesOf.get(m.id) ?? []);
      const ctx = {
        holidays,
        marks: marksOf.get(`${studentId}|${m.groupId}`) ?? new Map<string, Mark>(),
        discounts,
        settings: billing,
      };
      for (const month of billingMonths(bm, g, currentMonth)) charges.push(monthCharge(bm, g, month, ctx));
    }
    const entries: LedgerEntry[] = (entriesOf.get(studentId) ?? []).map((e) => ({
      id: e.id,
      kind: e.kind,
      amount: e.amount,
      groupId: e.groupId,
      month: e.month,
      date: e.date,
    }));
    result.set(studentId, { studentId, charges, discounts, entries, summary: summarize(charges, entries) });
  }
  return result;
}

export async function loadAccount(db: Db, studentId: string, today: string, fs?: FinanceSettings) {
  return (await loadAccounts(db, [studentId], today, fs)).get(studentId)!;
}
