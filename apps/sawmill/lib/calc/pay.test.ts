import { describe, expect, it } from "vitest";
import {
  calculateGroupWork,
  calculateSingleWork,
  resolveWorkerCubePrice,
  resolveWorkerPrice,
} from "./pay";

describe("pay calculation module", () => {
  describe("resolveWorkerPrice", () => {
    it("maoshli ishchi uchun har doim 0 qaytaradi", () => {
      expect(resolveWorkerPrice({ salaryType: "monthly", baseWorkerPrice: 5000, specialPrice: 6000 })).toBe(0);
      expect(resolveWorkerPrice({ salaryType: "daily", baseWorkerPrice: 5000 })).toBe(0);
      expect(resolveWorkerPrice({ salaryType: "weekly", baseWorkerPrice: 5000 })).toBe(0);
    });

    it("ishiga qarab ishchi uchun maxsus narx bo'lsa uni oladi", () => {
      expect(resolveWorkerPrice({ salaryType: "piecework", baseWorkerPrice: 5000, specialPrice: 6000 })).toBe(6000);
    });

    it("maxsus narx bo'lmasa terakdagi bazaviy narxni oladi", () => {
      expect(resolveWorkerPrice({ salaryType: "piecework", baseWorkerPrice: 5000 })).toBe(5000);
      expect(resolveWorkerPrice({ salaryType: "piecework", baseWorkerPrice: 5000, specialPrice: null })).toBe(5000);
    });
  });

  describe("resolveWorkerCubePrice", () => {
    it("ishiga qarab ishchi uchun kub narxini beradi, maoshli uchun 0", () => {
      expect(resolveWorkerCubePrice({ salaryType: "piecework", baseCubeWorkerPrice: 80000 })).toBe(80000);
      expect(resolveWorkerCubePrice({ salaryType: "monthly", baseCubeWorkerPrice: 80000 })).toBe(0);
    });
  });

  describe("calculateSingleWork", () => {
    it("oddiy ish turida kiritilgan summani oladi, omborga 0 qo'shadi", () => {
      const res = calculateSingleWork({
        kind: "regular",
        manualAmount: 250000,
        workerPrice: 0,
        workerCubePrice: 0,
      });
      expect(res.amount).toBe(250000);
      expect(res.stockDelta).toBe(0);
    });

    it("dona bo'yicha material ishini to'g'ri hisoblaydi", () => {
      // 100 dona x 1500 so'm = 150 000 so'm
      const res = calculateSingleWork({
        kind: "material",
        payUnit: "piece",
        quantity: 100,
        workerPrice: 1500,
        workerCubePrice: 0,
      });
      expect(res.amount).toBe(150000);
      expect(res.stockDelta).toBe(100);
    });

    it("qator bo'yicha material ishini to'g'ri hisoblaydi", () => {
      // 10 qator x 20 000 so'm = 200 000 so'm
      const res = calculateSingleWork({
        kind: "material",
        payUnit: "row",
        rows: 10,
        workerPrice: 20000,
        workerCubePrice: 0,
      });
      expect(res.amount).toBe(200000);
      expect(res.stockDelta).toBe(10);
    });

    it("kub 'direct' usulida m³ dan dona hisoblaydi va summaga ko'paytiradi", () => {
      // 1 dona = 0.05 m³; 2 m³ kiritildi -> 2 / 0.05 = 40 dona; 2 m³ x 100 000 = 200 000 so'm
      const res = calculateSingleWork({
        kind: "material",
        payUnit: "cube",
        cubeMode: "direct",
        cubeM3: 2,
        volumeM3: 0.05,
        workerPrice: 0,
        workerCubePrice: 100000,
      });
      expect(res.amount).toBe(200000);
      expect(res.stockDelta).toBe(40);
    });

    it("kub 'calculated' usulida donadan m³ hisoblaydi", () => {
      // 40 dona x 0.05 m³ = 2 m³; 2 m³ x 100 000 = 200 000 so'm
      const res = calculateSingleWork({
        kind: "material",
        payUnit: "cube",
        cubeMode: "calculated",
        quantity: 40,
        volumeM3: 0.05,
        workerPrice: 0,
        workerCubePrice: 100000,
      });
      expect(res.amount).toBe(200000);
      expect(res.stockDelta).toBe(40);
    });
  });

  describe("calculateGroupWork", () => {
    const workers = [
      { workerId: "w1", salaryType: "piecework" as const },
      { workerId: "w2", salaryType: "piecework" as const },
      { workerId: "w3", salaryType: "piecework" as const },
    ];

    it("har biriga to'liq rejimida har bir ishchi jami summani oladi", () => {
      const res = calculateGroupWork({
        kind: "material",
        payUnit: "piece",
        quantity: 100,
        baseWorkerPrice: 1000,
        baseCubeWorkerPrice: 0,
        payFullToEach: true,
        workers,
      });

      expect(res.totalAmount).toBe(100000);
      expect(res.stockDelta).toBe(100);
      expect(res.distributions).toEqual([
        { workerId: "w1", amount: 100000 },
        { workerId: "w2", amount: 100000 },
        { workerId: "w3", amount: 100000 },
      ]);
    });

    it("teng bo'linish rejimida qoldiq so'm birinchi ishchiga beriladi (K15)", () => {
      // 100 000 so'm / 3 kishi = 33 333 so'm, qoldiq 1 so'm w1 ga
      const res = calculateGroupWork({
        kind: "material",
        payUnit: "piece",
        quantity: 100,
        baseWorkerPrice: 1000,
        baseCubeWorkerPrice: 0,
        payFullToEach: false,
        workers,
      });

      expect(res.totalAmount).toBe(100000);
      expect(res.distributions[0]?.amount).toBe(33334);
      expect(res.distributions[1]?.amount).toBe(33333);
      expect(res.distributions[2]?.amount).toBe(33333);
      const sum = res.distributions.reduce((acc, d) => acc + d.amount, 0);
      expect(sum).toBe(100000);
    });

    it("guruhda maoshli ishchi bo'lsa unga 0 beriladi va bo'linish qolganlarga tushadi", () => {
      const mixedWorkers = [
        { workerId: "w1", salaryType: "piecework" as const },
        { workerId: "w2", salaryType: "monthly" as const },
      ];

      const res = calculateGroupWork({
        kind: "regular",
        totalAmountInput: 100000,
        baseWorkerPrice: 0,
        baseCubeWorkerPrice: 0,
        payFullToEach: false,
        workers: mixedWorkers,
      });

      expect(res.totalAmount).toBe(100000);
      expect(res.distributions).toEqual([
        { workerId: "w1", amount: 100000 },
        { workerId: "w2", amount: 0 },
      ]);
    });
  });
});
