import { z } from "zod";
import { activeDiscounts, discountedPrice, type Discount, type PriceStep, priceForMonth } from "./billing";

/*
 * Coinlar (ADR 0061): bitta tur, faqat avtomatik. Toza qism — sozlama, sabab kalitlari va qoidalar shartlari;
 * bazaga yozish `lib/server/coins.ts` da. `settings` jadvalida kalit `coins`; standart — hamma qoida o'chiq.
 */

export const COINS_KEY = "coins";

export const COIN_AMOUNT_MAX = 1000;

const rule = z.object({
  enabled: z.boolean().default(false),
  amount: z.number().int().min(1).max(COIN_AMOUNT_MAX).default(1),
});

export const coinSettingsSchema = z.object({
  /** (a) oy boshlanishidan oldin shu oyning to'liq narxi to'langan */
  prepay: rule.default({ enabled: false, amount: 10 }),
  /** (b) darsga keldi ("Bor", eski "Kech" ham) */
  attendance: rule.default({ enabled: false, amount: 1 }),
  /** (c) uy vazifasini bajardi (baholash bo'limi bilan) */
  homework: rule.default({ enabled: false, amount: 1 }),
  /** Qo'lda (ADR 0062): o'qituvchi sabab bilan beradi; bir o'quvchiga kuniga ko'pi bilan `dailyLimit` coin */
  manual: z
    .object({
      enabled: z.boolean().default(false),
      dailyLimit: z.number().int().min(1).max(COIN_AMOUNT_MAX).default(5),
    })
    .default({ enabled: false, dailyLimit: 5 }),
});
export type CoinSettings = z.infer<typeof coinSettingsSchema>;
/** Avtomatik qoidalar (miqdori sozlamada) */
export type CoinRuleKey = "prepay" | "attendance" | "homework";
/** Daftardagi har qanday qoida, qo'lda berilgani ham */
export type CoinEntryRule = CoinRuleKey | "manual";

export const MANUAL_REASON_MAX = 300;

/** Qo'lda berish: shu o'quvchiga bugun berilganidan keyin qancha berish mumkin */
export const manualRemaining = (dailyLimit: number, givenToday: number) => Math.max(0, dailyLimit - givenToday);

export const coinSettingsInput = coinSettingsSchema.strict();
export const DEFAULT_COINS: CoinSettings = coinSettingsSchema.parse({});

export function parseCoinSettings(value: unknown): CoinSettings {
  const parsed = coinSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_COINS;
}

/* ---------- Sabab kalitlari (noyob: o'quvchi + qoida + kalit) ---------- */

export const prepayKey = (groupId: string, month: string) => `prepay:${groupId}:${month}`;
export const attendanceKey = (groupId: string, date: string) => `att:${groupId}:${date}`;
export const homeworkKey = (groupId: string, date: string) => `hw:${groupId}:${date}`;

/** Davomat belgisi coin beradimi: "Bor" va eski "Kech" — ha */
export const attendanceEarns = (status: string | null): boolean => status === "present" || status === "late";

/* ---------- Oldindan to'lov ---------- */

export interface PrepayEntry {
  kind: string;
  amount: number;
  date: string;
}

/**
 * Oy boshlanishidan oldin shu guruh-oy uchun to'langan pul va bir martalik chegirmalar oyning to'liq narxini
 * (o'quvchining doimiy chegirmalari bilan) yopadimi. Narxi 0 bo'lsa (bepul o'quvchi) — yo'q. Bekor qilingan
 * yozuvlar bu yerga kelmaydi.
 */
export function prepayQualifies(input: {
  month: string;
  groupId: string;
  prices: readonly PriceStep[];
  discounts: readonly Discount[];
  entries: readonly PrepayEntry[];
}): boolean {
  const full = discountedPrice(
    priceForMonth(input.prices, input.month),
    activeDiscounts(input.discounts, input.groupId, input.month),
  );
  if (full <= 0) return false;
  const start = `${input.month}-01`;
  const covered = input.entries
    .filter((e) => (e.kind === "payment" || e.kind === "discount") && e.date < start)
    .reduce((s, e) => s + e.amount, 0);
  return covered >= full;
}

/* ---------- Ko'rinish ---------- */

export interface CoinChange {
  rule: CoinEntryRule;
  action: "award" | "revoke";
  amount: number;
}

/** Audit yozuviga qo'shiladigan qism (o'zgarish bo'lmasa — bo'sh) */
export function coinMeta(changes: readonly (CoinChange | null)[]): { coins?: CoinChange[] } {
  const list = changes.filter((c): c is CoinChange => c !== null);
  return list.length ? { coins: list } : {};
}
