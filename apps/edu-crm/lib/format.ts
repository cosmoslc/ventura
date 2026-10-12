import { formatMoney } from "@ventura/ui/money-input";

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
