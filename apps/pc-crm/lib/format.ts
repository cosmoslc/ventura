/**
 * Raqamlarni so'm formati bo'yicha chiroyli ko'rsatish (masalan: 1 250 000 so'm).
 * SSR va Client hydration bir xil bo'lishi uchun deterministik formatlash ishlatiladi.
 */
export function formatMoney(
  amount: bigint | number,
  currency: "UZS" | "USD" = "UZS",
  usdRate = 12800
): string {
  const value = typeof amount === "bigint" ? Number(amount) : amount;
  if (currency === "USD") {
    const inUsd = value / usdRate;
    const formatted = Math.round(inUsd)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `$${formatted}`;
  }
  const formatted = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${formatted} so'm`;
}

/** Sana formati */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
