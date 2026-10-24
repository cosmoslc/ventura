import { describe, expect, it } from "vitest";
import {
  cubeToPiece,
  formatMoney,
  fromCm,
  parseMoney,
  pieceToCube,
  pieceVolumeM3,
  toCm,
} from "./units";

describe("units calculation module", () => {
  describe("toCm & fromCm (birlik aylantirish)", () => {
    it("millimetrni santimetrga to'g'ri o'tkazadi", () => {
      expect(toCm(50, "mm")).toBe(5);
      expect(toCm(150, "mm")).toBe(15);
      expect(toCm(6000, "mm")).toBe(600);
      expect(fromCm(5, "mm")).toBe(50);
    });

    it("santimetrni o'zgarmasdan qoldiradi", () => {
      expect(toCm(5, "sm")).toBe(5);
      expect(toCm(15, "sm")).toBe(15);
      expect(fromCm(15, "sm")).toBe(15);
    });

    it("metrni santimetrga to'g'ri o'tkazadi", () => {
      expect(toCm(6, "m")).toBe(600);
      expect(toCm(0.05, "m")).toBe(5);
      expect(fromCm(600, "m")).toBe(6);
    });

    it("manfiy yoki noto'g'ri qiymatlarni 0 qiladi", () => {
      expect(toCm(-5, "sm")).toBe(0);
      expect(toCm(NaN, "sm")).toBe(0);
    });
  });

  describe("pieceVolumeM3 (1 dona hajmi m³)", () => {
    it("5 × 15 × 600 sm yog'och hajmini to'g'ri hisoblaydi", () => {
      // 0.05m * 0.15m * 6m = 0.045 m³
      const vol = pieceVolumeM3({ thicknessCm: 5, widthCm: 15, lengthCm: 600 });
      expect(vol).toBe(0.045);
    });

    it("2.5 × 10 × 400 sm taxta hajmini to'g'ri hisoblaydi", () => {
      // 0.025m * 0.10m * 4m = 0.01 m³
      const vol = pieceVolumeM3({ thicknessCm: 2.5, widthCm: 10, lengthCm: 400 });
      expect(vol).toBe(0.01);
    });

    it("o'lchamlardan biri bo'lmasa yoki 0 bo'lsa null qaytaradi", () => {
      expect(pieceVolumeM3({ thicknessCm: null, widthCm: 10, lengthCm: 400 })).toBeNull();
      expect(pieceVolumeM3({ thicknessCm: 0, widthCm: 10, lengthCm: 400 })).toBeNull();
      expect(pieceVolumeM3({ thicknessCm: -5, widthCm: 10, lengthCm: 400 })).toBeNull();
    });
  });

  describe("dona ↔ kub aylantirish", () => {
    const vol = 0.045; // 1 dona = 0.045 m³

    it("dona sonidan kub metrni to'g'ri hisoblaydi", () => {
      // 100 dona * 0.045 = 4.5 m³
      expect(pieceToCube(100, vol)).toBe(4.5);
      // 10 dona * 0.045 = 0.45 m³
      expect(pieceToCube(10, vol)).toBe(0.45);
    });

    it("kub metrdan dona sonini to'g'ri hisoblaydi", () => {
      // 4.5 m³ / 0.045 = 100 dona
      expect(cubeToPiece(4.5, vol)).toBe(100);
      // 0.45 m³ / 0.045 = 10 dona
      expect(cubeToPiece(0.45, vol)).toBe(10);
    });

    it("kubga aylanmaydigan material uchun null qaytaradi", () => {
      expect(pieceToCube(100, null)).toBeNull();
      expect(cubeToPiece(4.5, null)).toBeNull();
    });
  });

  describe("formatMoney & parseMoney", () => {
    it("pulni minglik probellar bilan chiroyli formatlaydi", () => {
      expect(formatMoney(1000000)).toBe("1 000 000 so'm");
      expect(formatMoney(1250000n)).toBe("1 250 000 so'm");
      expect(formatMoney(0)).toBe("0 so'm");
      expect(formatMoney(-50000)).toBe("-50 000 so'm");
      expect(formatMoney(1000000, false)).toBe("1 000 000");
    });

    it("matndan so'm miqdorini to'g'ri ajratib oladi", () => {
      expect(parseMoney("1 250 000")).toBe(1250000n);
      expect(parseMoney("1,250,000 so'm")).toBe(1250000n);
      expect(parseMoney("  50000  ")).toBe(50000n);
      expect(parseMoney("")).toBe(0n);
      expect(parseMoney("-20000")).toBe(-20000n);
    });
  });
});
