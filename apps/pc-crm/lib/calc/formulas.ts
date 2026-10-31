/**
 * PC-CRM sof hisob-kitob formulalari (PC-CRM.md 5-qism).
 * Pul qiymatlari har doim butun son (bigint) — so'mda saqlanadi.
 */

/** Optom kirimda dona tannarxini hisoblash */
export function calcUnitCost(totalCost: bigint, qty: number): bigint {
  if (qty <= 0) return 0n;
  return totalCost / BigInt(qty);
}

/** Marja foizi bo'yicha sotuv narxini hisoblash */
export function calcSellPriceFromMargin(costPrice: bigint, marginPercent: number): bigint {
  if (marginPercent <= 0) return costPrice;
  const factor = 100 + marginPercent;
  return (costPrice * BigInt(factor)) / 100n;
}

/** Chegirmadan keyingi yakuniy narx */
export function calcFinalPrice(price: bigint, discountPercent = 0): bigint {
  if (discountPercent <= 0) return price;
  if (discountPercent >= 100) return 0n;
  const discountAmount = (price * BigInt(discountPercent)) / 100n;
  return price - discountAmount;
}

export interface ComponentCostInput {
  costSnapshot: bigint;
  qty: number;
}

/** PC komponentlari yig'indisidan PC tannarxini hisoblash */
export function calcPcCostPrice(components: ComponentCostInput[]): bigint {
  return components.reduce((sum, item) => sum + item.costSnapshot * BigInt(item.qty), 0n);
}

/** Bitta sotuvdagi sof daromad */
export function calcItemProfit(soldPrice: bigint, costSnapshot: bigint, qty = 1): bigint {
  const perItemProfit = soldPrice - costSnapshot;
  return perItemProfit * BigInt(qty);
}

/** Marja foizini hisoblash (sof foyda / tushum * 100) */
export function calcMarginPercent(totalProfit: bigint, totalRevenue: bigint): number {
  if (totalRevenue <= 0n) return 0;
  const percentScaled = Number((totalProfit * 10000n) / totalRevenue);
  return Number((percentScaled / 100).toFixed(2));
}

export interface OrderTotalInput {
  subtotal: bigint;
  discount?: bigint;
  tax?: bigint;
  shipping?: bigint;
}

/** Buyurtmaning umumiy summasi: subtotal - discount + tax + shipping */
export function calcOrderTotal(input: OrderTotalInput): bigint {
  const discount = input.discount ?? 0n;
  const tax = input.tax ?? 0n;
  const shipping = input.shipping ?? 0n;
  const base = input.subtotal > discount ? input.subtotal - discount : 0n;
  return base + tax + shipping;
}

/** Mavjud qoldiq: stock - reserved */
export function calcAvailableStock(stock: number, reserved: number): number {
  return Math.max(0, stock - reserved);
}
