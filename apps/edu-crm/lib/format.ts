import { formatMoney } from "@ventura/ui/lib/money";
import { uz } from "./uz";

/** 1500000 → "1 500 000" */
export const money = (n: number) => formatMoney(n);

/** "+998901234567" → "+998 90 123 45 67"; bo'sh bo'lsa — null */
export function displayPhone(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "").slice(-9);
  if (d.length !== 9) return null;
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/** Ism bosh harfi (avatar uchun) */
export const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

/** "1998-05-12" → "12.05.1998" */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** "2026-10" → "Oktabr 2026" */
export function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const name = m ? uz.months[m - 1] : undefined;
  return name && y ? `${name} ${y}` : month;
}

/** Ishorali summa: 150000 → "+150 000", −150000 → "−150 000" */
export function signedMoney(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(Math.abs(n))}`;
}

/** Joriy oydan `count − 1` oy orqaga, eng yangisi birinchi ("YYYY-MM"); yozuvlar bir yildan eski kiritilmaydi */
export function recentMonths(today: string, count = 13): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y!, m! - 1 - i, 1)).toISOString().slice(0, 7));
}
