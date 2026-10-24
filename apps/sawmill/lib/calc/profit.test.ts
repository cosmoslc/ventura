import { describe, expect, it } from "vitest";
import {
  calculateOverallProfit,
  calculateTerakProfit,
  calculateWeeklyChart,
} from "./profit";

describe("profit calculation and dashboard metrics (SAWMILL-TAHLIL 8-qism, K11, K14)", () => {
  describe("calculateTerakProfit", () => {
    it("terak bo'yicha taxminiy va haqiqiy foydani to'g'ri hisoblaydi", () => {
      // Xarid: 10 000 000 so'm
      // Qo'shimcha xarajatlar (transport, res, mashina): 2 000 000 so'm
      // Ish haqi: 3 000 000 so'm
      // Jami xarajat = 15 000 000 so'm
      // Yuk chiqarish tushumi = 12 000 000 so'm
      // Ombordagi qoldiq qiymati = 8 000 000 so'm
      const res = calculateTerakProfit({
        purchasePrice: 10000000,
        additionalCosts: 2000000,
        workCosts: 3000000,
        dispatchRevenue: 12000000,
        stockValue: 8000000,
      });

      expect(res.totalCosts).toBe(15000000);
      expect(res.dispatchRevenue).toBe(12000000);
      expect(res.stockValue).toBe(8000000);

      // Taxminiy foyda = 12M + 8M - 15M = 5 000 000 so'm
      expect(res.profitEstimated).toBe(5000000);
      // Haqiqiy foyda = 12M - 15M = -3 000 000 so'm (hali to'liq qoplamagan)
      expect(res.profitReal).toBe(-3000000);

      // Rentabellik (margin)
      // Taxminiy: 5M / 20M = 25%
      expect(res.marginEstimated).toBe(25);
      // Haqiqiy: -3M / 12M = -25%
      expect(res.marginReal).toBe(-25);
    });

    it("daromad va ombor qiymati nol bo'lsa xatoliksiz ishlaydi", () => {
      const res = calculateTerakProfit({
        purchasePrice: 5000000,
        additionalCosts: 500000,
        workCosts: 0,
        dispatchRevenue: 0,
        stockValue: 0,
      });

      expect(res.totalCosts).toBe(5500000);
      expect(res.profitEstimated).toBe(-5500000);
      expect(res.profitReal).toBe(-5500000);
      expect(res.marginEstimated).toBe(0);
      expect(res.marginReal).toBe(0);
    });
  });

  describe("calculateOverallProfit (K14: umumiy xarajatlar hisobi)", () => {
    it("barcha teraklar foydasidan umumiy xarajatlarni ayiradi", () => {
      const terak1 = calculateTerakProfit({
        purchasePrice: 10000000,
        additionalCosts: 1000000,
        workCosts: 2000000,
        dispatchRevenue: 18000000,
        stockValue: 2000000,
      }); // totalCosts=13M, est=7M, real=5M

      const terak2 = calculateTerakProfit({
        purchasePrice: 8000000,
        additionalCosts: 1000000,
        workCosts: 1000000,
        dispatchRevenue: 9000000,
        stockValue: 5000000,
      }); // totalCosts=10M, est=4M, real=-1M

      // Umumiy xarajatlar (ijara, elektr, va h.k.): 3 000 000 so'm
      const overall = calculateOverallProfit({
        terakProfits: [terak1, terak2],
        generalExpenses: 3000000,
        profitMethod: "estimated",
      });

      expect(overall.terakCostsTotal).toBe(23000000); // 13M + 10M
      expect(overall.dispatchRevenueTotal).toBe(27000000); // 18M + 9M
      expect(overall.stockValueTotal).toBe(7000000); // 2M + 5M
      expect(overall.generalExpensesTotal).toBe(3000000);
      expect(overall.allCostsTotal).toBe(26000000); // 23M + 3M

      // Taxminiy foyda = (7M + 4M) - 3M = 8 000 000 so'm
      expect(overall.profitEstimated).toBe(8000000);
      // Haqiqiy foyda = (5M - 1M) - 3M = 1 000 000 so'm
      expect(overall.profitReal).toBe(1000000);

      // profitMethod = "estimated" bo'lsa
      expect(overall.effectiveProfit).toBe(8000000);

      // profitMethod = "real" bo'lsa
      const overallReal = calculateOverallProfit({
        terakProfits: [terak1, terak2],
        generalExpenses: 3000000,
        profitMethod: "real",
      });
      expect(overallReal.effectiveProfit).toBe(1000000);
    });
  });

  describe("calculateWeeklyChart (K11: oxirgi 7 kunlik grafik)", () => {
    it("oxirgi 7 kunni ketma-ket to'g'ri shakllantiradi va bugunni ajratadi", () => {
      const today = new Date("2026-10-24T12:00:00Z"); // Shanba

      const dispatches = [
        { date: "2026-10-24", quantity: 50, totalAmount: 1000000 },
        { date: "2026-10-24", quantity: 30, totalAmount: 600000 },
        { date: "2026-10-23", quantity: 40, totalAmount: 800000 },
        { date: "2026-10-20", quantity: 100, totalAmount: 2000000 },
        { date: "2026-10-10", quantity: 200, totalAmount: 4000000 }, // 7 kundan tashqarida
      ];

      const chart = calculateWeeklyChart(dispatches, today);

      expect(chart).toHaveLength(7);

      // Eng oxirgi element bugungi kun bo'lishi kerak
      const todayBar = chart[6];
      expect(todayBar?.date).toBe("2026-10-24");
      expect(todayBar?.isToday).toBe(true);
      expect(todayBar?.quantityPiece).toBe(80); // 50 + 30
      expect(todayBar?.totalAmount).toBe(1600000); // 1M + 600k

      // Kechagi kun
      const yesterdayBar = chart[5];
      expect(yesterdayBar?.date).toBe("2026-10-23");
      expect(yesterdayBar?.isToday).toBe(false);
      expect(yesterdayBar?.quantityPiece).toBe(40);

      // Yuk chiqarilmagan kunlarda nol bo'lishi kerak
      const emptyDayBar = chart[4];
      expect(emptyDayBar?.date).toBe("2026-10-22");
      expect(emptyDayBar?.quantityPiece).toBe(0);
      expect(emptyDayBar?.totalAmount).toBe(0);
    });
  });
});
