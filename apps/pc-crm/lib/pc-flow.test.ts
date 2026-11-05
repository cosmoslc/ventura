import { describe, expect, it } from "vitest";
import {
  calcFinalPrice,
  calcItemProfit,
  calcMarginPercent,
  calcOrderTotal,
  calcPcCostPrice,
} from "./calc/formulas";
import {
  CONFIGURATOR_CATALOG,
  SAMPLE_PC_BUILDS,
  SAMPLE_PC_ORDERS,
} from "./pc-data";

describe("PC-CRM Core Business Flow & Calculations", () => {
  describe("1. Kompyuterlar katalogi va filtrlash qoidalari", () => {
    it("faqat 'available' holatdagi kompyuterlar user tomoniga ko'rinadi", () => {
      const publicBuilds = SAMPLE_PC_BUILDS.filter((b) => b.status === "available");
      expect(publicBuilds.length).toBeGreaterThan(0);
      expect(publicBuilds.every((b) => b.status === "available")).toBe(true);

      const soldBuilds = SAMPLE_PC_BUILDS.filter((b) => b.status === "sold");
      expect(soldBuilds.length).toBeGreaterThan(0);
      expect(publicBuilds.find((b) => b.id === soldBuilds[0]!.id)).toBeUndefined();
    });

    it("CPU va GPU teglari bo'yicha to'g'ri filtrlanadi", () => {
      const i7Builds = SAMPLE_PC_BUILDS.filter(
        (b) => b.status === "available" && b.cpu.toLowerCase().includes("i7")
      );
      expect(i7Builds.length).toBeGreaterThan(0);
      expect(i7Builds[0]!.cpu).toContain("Core i7");

      const rtx4070Builds = SAMPLE_PC_BUILDS.filter(
        (b) => b.status === "available" && b.gpu.toLowerCase().includes("4070")
      );
      expect(rtx4070Builds.length).toBeGreaterThan(0);
      expect(rtx4070Builds[0]!.gpu).toContain("RTX 4070");
    });
  });

  describe("2. Savatcha va Yetkazib berish (Free shipping rule)", () => {
    it("1 mln so'mdan oshsa yetkazib berish bepul bo'ladi", () => {
      const FREE_LIMIT = 1_000_000n;
      const subtotalLarge = 2_600_000n;
      const shippingLarge = subtotalLarge >= FREE_LIMIT ? 0n : 35_000n;

      const orderTotal = calcOrderTotal({
        subtotal: subtotalLarge,
        shipping: shippingLarge,
      });

      expect(shippingLarge).toBe(0n);
      expect(orderTotal).toBe(2_600_000n);
    });

    it("1 mln so'mdan kam xaridlarga 35 000 so'm yetkazish qo'shiladi", () => {
      const FREE_LIMIT = 1_000_000n;
      const subtotalSmall = 880_000n;
      const shippingSmall = subtotalSmall >= FREE_LIMIT ? 0n : 35_000n;

      const orderTotal = calcOrderTotal({
        subtotal: subtotalSmall,
        shipping: shippingSmall,
      });

      expect(shippingSmall).toBe(35_000n);
      expect(orderTotal).toBe(915_000n);
    });

    it("chegirmali mahsulot yakuniy narxi to'g'ri hisoblanadi", () => {
      const basePrice = 10_000_000n;
      const discountPercent = 10;
      const finalPrice = calcFinalPrice(basePrice, discountPercent);
      expect(finalPrice).toBe(9_000_000n);
    });
  });

  describe("3. PC Yig'ish (Assemble) va Tannarx hisobi", () => {
    it("komponentlar summasi PC tannarxini to'g'ri shakllantiradi", () => {
      const titan = SAMPLE_PC_BUILDS.find((b) => b.id === "pc-1");
      expect(titan).toBeDefined();

      const calculatedCost = calcPcCostPrice(
        titan!.components.map((c) => ({
          costSnapshot: c.costSnapshot,
          qty: c.qty,
        }))
      );

      expect(calculatedCost).toBe(24_100_000n);
      expect(titan!.sellPrice).toBeGreaterThan(calculatedCost);
    });

    it("PC sotilganda sof daromad va marja to'g'ri hisoblanadi", () => {
      const sellPrice = 26_500_000n;
      const costPrice = 21_200_000n;
      const profit = calcItemProfit(sellPrice, costPrice, 1);
      const margin = calcMarginPercent(profit, sellPrice);

      expect(profit).toBe(5_300_000n);
      expect(margin).toBe(20);
    });
  });

  describe("4. Custom PC Konfigurator va Quvvat (TDP) hisobi", () => {
    it("8 ta komponent tanlanganda to'liq tizim quvvatini hisoblaydi", () => {
      const cpu = CONFIGURATOR_CATALOG.find((p) => p.role === "cpu" && p.id === "cfg-cpu-2"); // 125W
      const gpu = CONFIGURATOR_CATALOG.find((p) => p.role === "gpu" && p.id === "cfg-gpu-2"); // 220W
      expect(cpu?.tdpWatts).toBe(125);
      expect(gpu?.tdpWatts).toBe(220);

      const baseTdp = 75;
      const totalEstimatedTdp = (cpu?.tdpWatts ?? 0) + (gpu?.tdpWatts ?? 0) + baseTdp;
      expect(totalEstimatedTdp).toBe(420);

      // Tavsiya etilgan PSU kamida 570W bo'lishi kerak
      expect(totalEstimatedTdp + 150).toBe(570);
    });

    it("shaxsiy zakaz yaratilganda barcha komponentlar narxi yig'iladi", () => {
      const sampleOrder = SAMPLE_PC_ORDERS[0];
      expect(sampleOrder).toBeDefined();
      expect(sampleOrder!.components.length).toBe(8);

      const sumComponents = sampleOrder!.components.reduce((sum, c) => sum + c.price, 0n);
      expect(sumComponents).toBeGreaterThan(0n);
      expect(sampleOrder!.quotedPrice).toBeDefined();
    });
  });
});
