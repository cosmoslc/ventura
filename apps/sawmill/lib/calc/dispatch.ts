/**
 * Sawmill yuk chiqarish (sotuv) hisob-kitoblari moduli.
 * SAWMILL-TAHLIL 9-bo'limi asosida.
 */

export const EPSILON = 0.000001;

export type DispatchUnit = "piece" | "cube";

export interface CalculateDispatchParams {
  unit: DispatchUnit;
  quantityInput: number;
  priceInput: number; // Kiritilgan birlikdagi narx (so'm)
  volumeM3?: number | null; // 1 dona hajmi (m³)
  currentStock: number; // Ombordagi qoldiq (donada)
}

export type DispatchValidationError =
  "INVALID_QUANTITY" | "INVALID_PRICE" | "MISSING_VOLUME" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK";

export interface DispatchCalculationResult {
  valid: boolean;
  error?: DispatchValidationError;
  quantityPiece: number; // Bazada saqlanadigan miqdor (donada)
  unitPricePiece: number; // 1 dona uchun narx (so'm)
  totalAmount: number; // Jami summa (so'm)
}

/**
 * Yuk chiqarish parametrlarini tekshiradi va saqlanadigan qiymatlarni hisoblaydi.
 */
export function validateAndCalculateDispatch(params: CalculateDispatchParams): DispatchCalculationResult {
  const { unit, quantityInput, priceInput, volumeM3, currentStock } = params;

  if (!Number.isFinite(quantityInput) || quantityInput <= 0) {
    return {
      valid: false,
      error: "INVALID_QUANTITY",
      quantityPiece: 0,
      unitPricePiece: 0,
      totalAmount: 0,
    };
  }

  if (!Number.isFinite(priceInput) || priceInput < 0) {
    return {
      valid: false,
      error: "INVALID_PRICE",
      quantityPiece: 0,
      unitPricePiece: 0,
      totalAmount: 0,
    };
  }

  let quantityPiece: number;
  const totalAmount = Math.round(quantityInput * priceInput);

  if (unit === "cube") {
    if (!volumeM3 || volumeM3 <= 0) {
      return {
        valid: false,
        error: "MISSING_VOLUME",
        quantityPiece: 0,
        unitPricePiece: 0,
        totalAmount,
      };
    }
    // m³ / V -> dona
    quantityPiece = Math.round((quantityInput / volumeM3) * 10000) / 10000;
  } else {
    quantityPiece = Math.round(quantityInput * 10000) / 10000;
  }

  // 1. Omborda qoldiq bormi?
  if (currentStock <= EPSILON) {
    return {
      valid: false,
      error: "OUT_OF_STOCK",
      quantityPiece,
      unitPricePiece: 0,
      totalAmount,
    };
  }

  // 2. Yaxlitlashdagi kasr xatosi: |miqdor - qoldiq| < epsilon bo'lsa miqdor = qoldiq
  if (Math.abs(quantityPiece - currentStock) < EPSILON) {
    quantityPiece = currentStock;
  } else if (currentStock + EPSILON < quantityPiece) {
    // 3. Qoldiq yetarlimi?
    return {
      valid: false,
      error: "INSUFFICIENT_STOCK",
      quantityPiece,
      unitPricePiece: 0,
      totalAmount,
    };
  }

  // 1 dona ekvivalent narxi: unitPrice = jami / dona
  const unitPricePiece = quantityPiece > 0 ? Math.round(totalAmount / quantityPiece) : 0;

  return {
    valid: true,
    quantityPiece,
    unitPricePiece,
    totalAmount,
  };
}

/**
 * Birlik almashtirilganda narxni konvertatsiya qilish.
 * - donadan kubga: cubePrice ?? joriyNarx / V
 * - kubdan donaga: sellingPrice ?? joriyNarx * V
 */
export function convertDispatchPrice(params: {
  fromUnit: DispatchUnit;
  toUnit: DispatchUnit;
  currentPrice: number;
  volumeM3: number | null;
  materialSellingPrice?: number | null;
  materialCubePrice?: number | null;
}): number {
  const { fromUnit, toUnit, currentPrice, volumeM3, materialSellingPrice, materialCubePrice } = params;

  if (fromUnit === toUnit) return currentPrice;
  if (!volumeM3 || volumeM3 <= 0) return currentPrice;

  if (fromUnit === "piece" && toUnit === "cube") {
    if (materialCubePrice !== undefined && materialCubePrice !== null && materialCubePrice > 0) {
      return materialCubePrice;
    }
    return Math.round(currentPrice / volumeM3);
  }

  if (fromUnit === "cube" && toUnit === "piece") {
    if (materialSellingPrice !== undefined && materialSellingPrice !== null && materialSellingPrice > 0) {
      return materialSellingPrice;
    }
    return Math.round(currentPrice * volumeM3);
  }

  return currentPrice;
}
