import { z } from "zod";
import type { DayFlow } from "./dashboard";
import { yearMonths } from "./reports";
import { uz } from "./uz";

/*
 * Boshlang'ich qoldiq (E6j, ADR 0038): filial uchun "shu sanadagi kassa qoldig'i". Pul oqimi hisobotidagi yig'ma
 * qoldiq shundan boshlanadi: qoldiq + shu sanadan keyingi sof oqim. Toza funksiyalar — Vitest bilan tekshiriladi.
 */

/** `settings` kaliti; qiymat: { [filialId]: { amount, date } } */
export const OPENING_BALANCE_KEY = "finance.opening_balance";

const dateStr = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, uz.reports.cashflow.opening.dateInvalid);

export const openingEntry = z.object({
  /** Kassadagi qoldiq (so'm), manfiy emas */
  amount: z
    .number({ error: uz.reports.cashflow.opening.amountInvalid })
    .int(uz.reports.cashflow.opening.amountInvalid)
    .min(0, uz.reports.cashflow.opening.amountInvalid)
    .max(10_000_000_000_000, uz.reports.cashflow.opening.amountInvalid),
  date: dateStr,
});
export type OpeningEntry = z.infer<typeof openingEntry>;

/** Saqlangan qiymat: filial id → qoldiq */
export const openingBalances = z.record(z.uuid(), openingEntry);
export type OpeningBalances = z.infer<typeof openingBalances>;

/** Forma: har filial uchun summa (null — qoldiq yo'q, o'chiriladi) va sana */
export const openingBalanceInput = z.object({
  entries: z
    .array(
      z.object({
        branchId: z.uuid(),
        amount: openingEntry.shape.amount.nullable(),
        date: z.string(),
      }),
    )
    .min(1)
    .max(200),
});
export type OpeningBalanceInput = z.input<typeof openingBalanceInput>;

/** Saqlangan qiymatni o'qish: buzilgan yozuvlar tashlanadi (hisobot yiqilmasin) */
export function parseOpeningBalances(value: unknown): OpeningBalances {
  if (!value || typeof value !== "object") return {};
  const out: OpeningBalances = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    const idOk = z.uuid().safeParse(id).success;
    const e = openingEntry.safeParse(raw);
    if (idOk && e.success) out[id] = e.data;
  }
  return out;
}

/** Filial qoldiqlari yig'indisi va eng erta sana (izoh uchun); qoldiq yo'q bo'lsa null */
export function openingSummary(
  openings: OpeningBalances,
  ids: readonly string[],
): { amount: number; date: string; count: number } | null {
  const list = ids.map((id) => openings[id]).filter((e): e is OpeningEntry => !!e);
  if (!list.length) return null;
  return {
    amount: list.reduce((s, e) => s + e.amount, 0),
    date: list.map((e) => e.date).sort()[0]!,
    count: list.length,
  };
}

/** Bir "oqim": filial (yoki qoldiqsiz filiallar to'plami) pul harakatlari va qoldig'i */
export interface BalanceStream {
  opening: OpeningEntry | null;
  flows: readonly DayFlow[];
}

const signed = (f: DayFlow) => (f.kind === "pay" || f.kind === "income" ? f.amount : -f.amount);

/**
 * Yil bo'yicha 12 oy oxiridagi yig'ma qoldiq. Qoldig'i bor oqim: qoldiq (sanasi kelgan oydan boshlab) + shu sanadan
 * keyingi sof oqim — oldingi yillar ham hisobga olinadi. Qoldig'i yo'q oqim: yil boshidan sof oqim (oldingidek).
 * Hali kelmagan oylar — null.
 */
export function cumulativeBalance(streams: readonly BalanceStream[], year: number, today: string): (number | null)[] {
  const thisMonth = today.slice(0, 7);
  return yearMonths(year).map((m) => {
    if (m > thisMonth) return null;
    const end = `${m}-31`;
    let total = 0;
    for (const s of streams) {
      const from = s.opening ? s.opening.date : `${year}-01-01`;
      if (s.opening && s.opening.date > end) continue;
      if (s.opening) total += s.opening.amount;
      for (const f of s.flows) if (f.date >= from && f.date <= end) total += signed(f);
    }
    return total;
  });
}
