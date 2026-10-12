/** 1500000 → "1 500 000" (bo'shliq bilan, so'm uchun). Server va client kodida ishlaydi. */
export function formatMoney(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
