import { describe, expect, it } from "vitest";
import {
  convertDispatchPrice,
  EPSILON,
  validateAndCalculateDispatch,
} from "./dispatch";

describe("dispatch calculation module (SAWMILL-TAHLIL 9-qism)", () => {
  describe("validateAndCalculateDispatch - dona (piece)", () => {
    it("to'g'ri dona hisob-kitobi va qoldiqdan ayirish", () => {
      // 50 dona x 12 000 so'm = 600 000 so'm, omborda 100 dona bor
      const res = validateAndCalculateDispatch({
        unit: "piece",
        quantityInput: 50,
        priceInput: 12000,
        currentStock: 100,
      });

      expect(res.valid).toBe(true);
      expect(res.quantityPiece).toBe(50);
      expect(res.totalAmount).toBe(600000);
      expect(res.unitPricePiece).toBe(12000);
    });

    it("omborda material yo'q bo'lsa OUT_OF_STOCK qaytaradi", () => {
      const res = validateAndCalculateDispatch({
        unit: "piece",
        quantityInput: 10,
        priceInput: 12000,
        currentStock: 0,
      });

      expect(res.valid).toBe(false);
      expect(res.error).toBe("OUT_OF_STOCK");
    });

    it("omborda yetarli qoldiq bo'lmasa INSUFFICIENT_STOCK qaytaradi", () => {
      const res = validateAndCalculateDispatch({
        unit: "piece",
        quantityInput: 100,
        priceInput: 12000,
        currentStock: 90,
      });

      expect(res.valid).toBe(false);
      expect(res.error).toBe("INSUFFICIENT_STOCK");
    });

    it("qoldiq bilan aynan teng bo'lsa to'liq chiqarishga ruxsat beradi", () => {
      const res = validateAndCalculateDispatch({
        unit: "piece",
        quantityInput: 80,
        priceInput: 10000,
        currentStock: 80,
      });

      expect(res.valid).toBe(true);
      expect(res.quantityPiece).toBe(80);
      expect(res.totalAmount).toBe(800000);
    });
  });

  describe("validateAndCalculateDispatch - kub (cube)", () => {
    // Masalan: 1 dona vassa = 0.016 m³
    const volumeM3 = 0.016;

    it("kub miqdorini donaga to'g'ri aylantiradi va 1 dona narxini hisoblaydi", () => {
      // 1.6 m³ x 1 000 000 so'm/m³ = 1 600 000 so'm
      // dona = 1.6 / 0.016 = 100 dona
      // unitPricePiece = 1 600 000 / 100 = 16 000 so'm
      const res = validateAndCalculateDispatch({
        unit: "cube",
        quantityInput: 1.6,
        priceInput: 1000000,
        volumeM3,
        currentStock: 120,
      });

      expect(res.valid).toBe(true);
      expect(res.quantityPiece).toBe(100);
      expect(res.totalAmount).toBe(1600000);
      expect(res.unitPricePiece).toBe(16000);
    });

    it("kub kiritilganda volumeM3 bo'lmasa MISSING_VOLUME xatosini beradi", () => {
      const res = validateAndCalculateDispatch({
        unit: "cube",
        quantityInput: 1,
        priceInput: 1000000,
        volumeM3: null,
        currentStock: 100,
      });

      expect(res.valid).toBe(false);
      expect(res.error).toBe("MISSING_VOLUME");
    });

    it("kasrli kub qoldiq bilan epsilon doirasida farq qilsa, qoldiqqa tenglashtiradi", () => {
      // Masalan qoldiq 99.999999 dona, kiritilgan kubdan chiqqan dona 100
      const currentStock = 100;
      const res = validateAndCalculateDispatch({
        unit: "cube",
        quantityInput: 1.6 + EPSILON / 2 * volumeM3,
        priceInput: 1000000,
        volumeM3,
        currentStock,
      });

      expect(res.valid).toBe(true);
      expect(res.quantityPiece).toBe(currentStock);
    });

    it("kub kiritilganda ombordagi qoldiq yetarli bo'lmasa xato beradi", () => {
      const res = validateAndCalculateDispatch({
        unit: "cube",
        quantityInput: 2.0, // 2.0 / 0.016 = 125 dona
        priceInput: 1000000,
        volumeM3,
        currentStock: 100,
      });

      expect(res.valid).toBe(false);
      expect(res.error).toBe("INSUFFICIENT_STOCK");
    });
  });

  describe("noto'g'ri kiritmalar", () => {
    it("manfiy yoki nol miqdorda INVALID_QUANTITY xatosi", () => {
      expect(
        validateAndCalculateDispatch({
          unit: "piece",
          quantityInput: 0,
          priceInput: 10000,
          currentStock: 100,
        }).error,
      ).toBe("INVALID_QUANTITY");

      expect(
        validateAndCalculateDispatch({
          unit: "piece",
          quantityInput: -5,
          priceInput: 10000,
          currentStock: 100,
        }).error,
      ).toBe("INVALID_QUANTITY");
    });

    it("manfiy narxda INVALID_PRICE xatosi", () => {
      expect(
        validateAndCalculateDispatch({
          unit: "piece",
          quantityInput: 10,
          priceInput: -100,
          currentStock: 100,
        }).error,
      ).toBe("INVALID_PRICE");
    });
  });

  describe("convertDispatchPrice", () => {
    const volumeM3 = 0.02; // 1 dona = 0.02 m³ (50 dona = 1 m³)

    it("bir xil birlikda narx o'zgarmaydi", () => {
      expect(
        convertDispatchPrice({
          fromUnit: "piece",
          toUnit: "piece",
          currentPrice: 15000,
          volumeM3,
        }),
      ).toBe(15000);
    });

    it("donadan kubga o'tganda materialCubePrice bo'lsa uni oladi", () => {
      const price = convertDispatchPrice({
        fromUnit: "piece",
        toUnit: "cube",
        currentPrice: 20000,
        volumeM3,
        materialCubePrice: 900000,
      });
      expect(price).toBe(900000);
    });

    it("donadan kubga o'tganda materialCubePrice bo'lmasa formuladan hisoblaydi: price / V", () => {
      // 20 000 / 0.02 = 1 000 000 so'm
      const price = convertDispatchPrice({
        fromUnit: "piece",
        toUnit: "cube",
        currentPrice: 20000,
        volumeM3,
        materialCubePrice: 0,
      });
      expect(price).toBe(1000000);
    });

    it("kubdan donaga o'tganda materialSellingPrice bo'lsa uni oladi", () => {
      const price = convertDispatchPrice({
        fromUnit: "cube",
        toUnit: "piece",
        currentPrice: 1000000,
        volumeM3,
        materialSellingPrice: 25000,
      });
      expect(price).toBe(25000);
    });

    it("kubdan donaga o'tganda materialSellingPrice bo'lmasa formuladan hisoblaydi: price * V", () => {
      // 1 000 000 * 0.02 = 20 000 so'm
      const price = convertDispatchPrice({
        fromUnit: "cube",
        toUnit: "piece",
        currentPrice: 1000000,
        volumeM3,
        materialSellingPrice: null,
      });
      expect(price).toBe(20000);
    });
  });
});
