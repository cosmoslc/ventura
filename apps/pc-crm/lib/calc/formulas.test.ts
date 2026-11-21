import { describe, expect, it } from "vitest";
import {
  calcAvailableStock,
  calcFinalPrice,
  calcItemProfit,
  calcMarginPercent,
  calcOrderTotal,
  calcPcCostPrice,
  calcSellPriceFromMargin,
  calcUnitCost,
} from "./formulas";

describe("PC-CRM hisob-kitob formulalari", () => {
  it("optom kirimda dona tannarxini to'g'ri hisoblaydi", () => {
    // 10 000 000 so'mga 20 ta operativka (RAM) olindi -> dona tannarxi 500 000 so'm
    expect(calcUnitCost(10_000_000n, 20)).toBe(500_000n);
  });

  it("marja foizi bo'yicha sotuv narxini to'g'ri hisoblaydi", () => {
    // Tannarx 1 000 000 so'm + 20% ustama -> 1 200 000 so'm
    expect(calcSellPriceFromMargin(1_000_000n, 20)).toBe(1_200_000n);
  });

  it("chegirmani to'g'ri chiqaradi", () => {
    // 2 000 000 so'mlik mahsulotga 15% chegirma -> 1 700 000 so'm
    expect(calcFinalPrice(2_000_000n, 15)).toBe(1_700_000n);
  });

  it("PC komponentlari tannarxini jamlaydi", () => {
    const components = [
      { costSnapshot: 2_500_000n, qty: 1 }, // CPU
      { costSnapshot: 4_000_000n, qty: 1 }, // GPU
      { costSnapshot: 400_000n, qty: 2 }, // 2x RAM
      { costSnapshot: 600_000n, qty: 1 }, // SSD
    ];
    // 2.5m + 4m + 0.8m + 0.6m = 7.9m
    expect(calcPcCostPrice(components)).toBe(7_900_000n);
  });

  it("sof daromad va marja foizini aniq hisoblaydi", () => {
    // Sotilgan narx 1 500 000, tannarx 1 000 000, 2 dona
    const profit = calcItemProfit(1_500_000n, 1_000_000n, 2);
    expect(profit).toBe(1_000_000n);

    // Tushum: 3 000 000, foyda: 1 000 000 -> 33.33%
    expect(calcMarginPercent(profit, 3_000_000n)).toBe(33.33);
  });

  it("buyurtma umumiy summasini to'g'ri jamlaydi", () => {
    const total = calcOrderTotal({
      subtotal: 5_000_000n,
      discount: 500_000n,
      tax: 0n,
      shipping: 50_000n,
    });
    // 5 000 000 - 500 000 + 50 000 = 4 550 000
    expect(total).toBe(4_550_000n);
  });

  it("zaxira chiqarilgandan keyingi mavjud qoldiqni to'g'ri beradi", () => {
    expect(calcAvailableStock(10, 3)).toBe(7);
    expect(calcAvailableStock(2, 5)).toBe(0); // Manfiy bo'lmaydi
  });
});
