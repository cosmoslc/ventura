import { type HolidayRange, eachDay, isHoliday, monthRange, weekdayOf } from "./lessons";

/*
 * O'quvchi oylik hisobi (EDU-CRM-PLAN E3, ADR 0015). Toza funksiyalar — server (qarz, to'lov, maosh) va
 * Vitest bir xil koddan foydalanadi. Eski tizimda bir xil qarz 12 joyda turlicha hisoblanar edi; bu yerda
 * bitta formula. Pul — butun so'm (number, xavfsiz butun son chegarasida).
 *
 * Oylik rejim:  summa = round(chegirmali narx × (hisobdagi darslar − sababli) / oydagi darslar)
 * Dars rejimi:  summa = round(chegirmali narx × to'lanadigan darslar / oydagi darslar)
 *  - oydagi darslar — guruh kunlari bo'yicha oyning barcha dars sanalari (bayramlar ham);
 *  - hisobdagi darslar — guruh boshlangan, a'zo faollashtirilgan kundan, chiqqan kungacha, muzlatilgan
 *    oraliqlar va "darslarga ta'sir qiladigan" bayramlarsiz;
 *  - bitta yaxlitlash (eski tizimda dars narxi alohida yaxlitlanib, xato yig'ilar edi).
 */

export type BillingMode = "monthly" | "per_lesson";

export interface BillingSettings {
  mode: BillingMode;
  /** Sababli qoldirilgan dars to'lovdan chiqariladi */
  excusedRefund: boolean;
}

export const DEFAULT_BILLING: BillingSettings = { mode: "monthly", excusedRefund: true };

/** Narx tarixidagi "boshidan" qadami (birinchi narx o'zgarishidan oldingi narx) */
export const OPENING_MONTH = "0000-01";

/** Guruh narxi tarixi: `fromMonth` dan boshlab amal qiladi */
export interface PriceStep {
  fromMonth: string;
  price: number;
}

export interface Discount {
  id: string;
  /** null — o'quvchining barcha guruhlariga */
  groupId: string | null;
  kind: "fixed" | "percent";
  value: number;
  fromMonth: string;
  /** null — muddatsiz */
  toMonth: string | null;
  /** false — o'qituvchi ulushi chegirmasiz narxdan hisoblanadi */
  affectsTeacher: boolean;
}

/** Muzlatilgan oraliq [from, to) — `to` kuni dars yana hisoblanadi */
export interface Pause {
  from: string;
  to: string | null;
}

export interface BillingMembership {
  id: string;
  groupId: string;
  /** null — sinovda (to'lov yo'q) */
  activatedAt: string | null;
  /** Chiqqan kun (shu kundan dars hisoblanmaydi) */
  leftAt: string | null;
  pauses: readonly Pause[];
}

export interface BillingGroup {
  id: string;
  branchId: string;
  days: readonly string[];
  startDate: string;
  prices: readonly PriceStep[];
}

export type Mark = "present" | "late" | "excused" | "absent";

export interface ChargeContext {
  holidays: readonly HolidayRange[];
  /** Shu o'quvchining shu guruhdagi davomati: sana → holat */
  marks: ReadonlyMap<string, Mark>;
  discounts: readonly Discount[];
  settings: BillingSettings;
}

export interface MonthCharge {
  membershipId: string;
  groupId: string;
  month: string;
  /** Guruhning shu oydagi narxi */
  basePrice: number;
  /** Chegirmalardan keyingi to'liq oy narxi */
  fullPrice: number;
  /** Oydagi barcha dars sanalari soni */
  lessons: number;
  /** Hisobdagi darslar */
  billable: number;
  /** To'lovdan chiqarilgan sababli darslar (oylik rejim) */
  excused: number;
  /** To'lanadigan darslar (dars rejimi: belgilangan; oylik: billable − excused) */
  charged: number;
  amount: number;
}

/* ---------- Oylar ---------- */

export const monthOf = (date: string) => date.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** [from, to] oylari (ikkalasi ham kiradi) */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 600; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/* ---------- Narx va chegirma ---------- */

/** Oy narxi: `fromMonth` ≤ oy bo'lgan oxirgi qadam; birinchi qadamdan oldingi oylar — birinchi narx */
export function priceForMonth(prices: readonly PriceStep[], month: string): number {
  if (!prices.length) return 0;
  const sorted = [...prices].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  let price = sorted[0]!.price;
  for (const p of sorted) if (p.fromMonth <= month) price = p.price;
  return price;
}

export function activeDiscounts(discounts: readonly Discount[], groupId: string, month: string): Discount[] {
  return discounts.filter(
    (d) =>
      d.value > 0 &&
      (d.groupId === null || d.groupId === groupId) &&
      d.fromMonth <= month &&
      (d.toMonth === null || month <= d.toMonth),
  );
}

/**
 * Chegirmali narx: chegirmalar asosiy narxdan qo'shilib ayiriladi (ketma-ket emas), keyin yaxlitlanadi, 0 dan
 * past tushmaydi — eski tizimdagidek. `teacherOnly` — o'qituvchi ulushiga ta'sir qilmaydiganlar hisobga olinmaydi.
 */
export function discountedPrice(base: number, discounts: readonly Discount[], opts: { teacherOnly?: boolean } = {}) {
  if (base <= 0) return 0;
  let off = 0;
  for (const d of discounts) {
    if (opts.teacherOnly && !d.affectsTeacher) continue;
    off += d.kind === "percent" ? (base * d.value) / 100 : d.value;
  }
  return Math.max(0, Math.round(base - off));
}

/* ---------- Oylik hisob ---------- */

function paused(pauses: readonly Pause[], date: string) {
  return pauses.some((p) => p.from <= date && (p.to === null || date < p.to));
}

/*
 * Oy sanalari faqat (dars kunlari, oy) ga bog'liq, lekin hisobda har a'zolik-oy uchun ikki marta so'raladi:
 * 170 o'quvchi × 18 oyda ~7 000 marta, har biri 31 ta Date. Natija keshlanadi (ADR 0060); kesh hajmi cheklangan.
 */
const SCHEDULE_CACHE_LIMIT = 5_000;
const scheduleCache = new Map<string, readonly string[]>();

/** Oyning guruh kunlariga tushgan barcha sanalari (bayramlar ham). Qaytgan ro'yxat o'zgartirilmaydi. */
export function scheduledDates(days: readonly string[], month: string): readonly string[] {
  const key = `${month}|${days.join(",")}`;
  const hit = scheduleCache.get(key);
  if (hit) return hit;
  const [from, to] = monthRange(month);
  const dates = Object.freeze(eachDay(from, to).filter((d) => days.includes(weekdayOf(d))));
  if (scheduleCache.size >= SCHEDULE_CACHE_LIMIT) scheduleCache.clear();
  scheduleCache.set(key, dates);
  return dates;
}

/** Shu oy hisobga olinadigan dars sanalari */
export function billableDates(m: BillingMembership, g: BillingGroup, month: string, holidays: readonly HolidayRange[]) {
  if (!m.activatedAt) return [];
  const activatedAt = m.activatedAt;
  return scheduledDates(g.days, month).filter(
    (d) =>
      d >= g.startDate &&
      d >= activatedAt &&
      (m.leftAt === null || d < m.leftAt) &&
      !paused(m.pauses, d) &&
      !isHoliday(d, g.branchId, holidays),
  );
}

export function monthCharge(m: BillingMembership, g: BillingGroup, month: string, ctx: ChargeContext): MonthCharge {
  const basePrice = priceForMonth(g.prices, month);
  const fullPrice = discountedPrice(basePrice, activeDiscounts(ctx.discounts, g.id, month));
  const lessons = scheduledDates(g.days, month).length;
  const dates = billableDates(m, g, month, ctx.holidays);
  const billable = dates.length;
  let excused = 0;
  let charged: number;
  if (ctx.settings.mode === "monthly") {
    if (ctx.settings.excusedRefund) excused = dates.filter((d) => ctx.marks.get(d) === "excused").length;
    charged = billable - excused;
  } else {
    charged = dates.filter((d) => {
      const mark = ctx.marks.get(d);
      if (!mark) return false;
      return mark !== "excused" || !ctx.settings.excusedRefund;
    }).length;
  }
  const amount = lessons > 0 && charged > 0 ? Math.round((fullPrice * charged) / lessons) : 0;
  return {
    membershipId: m.id,
    groupId: g.id,
    month,
    basePrice,
    fullPrice,
    lessons,
    billable,
    excused,
    charged,
    amount,
  };
}

/**
 * A'zolik qaysi oylar uchun hisoblanadi: faollashtirilgan oydan chiqqan kunning oldingi kuni oyigacha, ko'pi bilan
 * joriy oygacha (oylik rejimda joriy oy to'liq — oy boshida to'lanadi).
 */
export function billingMonths(m: BillingMembership, g: BillingGroup, currentMonth: string): string[] {
  if (!m.activatedAt) return [];
  const start = monthOf(m.activatedAt > g.startDate ? m.activatedAt : g.startDate);
  let end = currentMonth;
  if (m.leftAt !== null) {
    const last = monthOf(addDays(m.leftAt, -1));
    if (last < end) end = last;
  }
  return monthsBetween(start, end);
}

/** A'zolikning barcha oylik hisoblari (summasi 0 bo'lgan oylar ham — ko'rsatish uchun) */
export function membershipCharges(
  m: BillingMembership,
  g: BillingGroup,
  currentMonth: string,
  ctx: ChargeContext,
): MonthCharge[] {
  return billingMonths(m, g, currentMonth).map((month) => monthCharge(m, g, month, ctx));
}
