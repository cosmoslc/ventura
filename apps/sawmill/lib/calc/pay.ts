/**
 * Sawmill ish haqi hisob-kitoblari moduli.
 * SAWMILL-TAHLIL 6-bo'limi va K1, K2, K3, K15 qarorlari asosida.
 */

export type WorkerSalaryType = "piecework" | "daily" | "weekly" | "monthly";
export type WorkPayUnit = "piece" | "row" | "cube";
export type CubeCalculationMode = "direct" | "calculated";

export interface WorkerPriceInput {
  salaryType: WorkerSalaryType;
  baseWorkerPrice: number;
  specialPrice?: number | null;
}

export interface WorkerCubePriceInput {
  salaryType: WorkerSalaryType;
  baseCubeWorkerPrice?: number | null;
}

/**
 * Ishchining material bo'yicha dona/qator narxini aniqlaydi.
 * Agar ishchi maoshli bo'lsa (kunlik/haftalik/oylik), ishiga qarab narx 0 bo'ladi.
 * Maxsus narx bo'lsa, u ustun turadi. Aks holda terakdagi bazaviy narx olinadi.
 */
export function resolveWorkerPrice({
  salaryType,
  baseWorkerPrice,
  specialPrice,
}: WorkerPriceInput): number {
  if (salaryType !== "piecework") return 0;
  if (specialPrice !== undefined && specialPrice !== null && specialPrice > 0) {
    return specialPrice;
  }
  return baseWorkerPrice > 0 ? baseWorkerPrice : 0;
}

/**
 * Ishchining material bo'yicha kub narxini aniqlaydi.
 * Agar ishchi maoshli bo'lsa, 0. Aks holda terakdagi bazaviy kub narxi.
 */
export function resolveWorkerCubePrice({
  salaryType,
  baseCubeWorkerPrice,
}: WorkerCubePriceInput): number {
  if (salaryType !== "piecework") return 0;
  return baseCubeWorkerPrice && baseCubeWorkerPrice > 0 ? baseCubeWorkerPrice : 0;
}

export interface SingleWorkCalculationInput {
  kind: "regular" | "material";
  manualAmount?: number;
  payUnit?: WorkPayUnit;
  cubeMode?: CubeCalculationMode;
  workerPrice: number;
  workerCubePrice: number;
  quantity?: number;
  rows?: number;
  cubeM3?: number;
  volumeM3?: number | null;
}

export interface SingleWorkCalculationResult {
  amount: number;
  stockDelta: number;
}

/**
 * Yakka ish uchun ish haqi summasi va omborga qo'shiladigan miqdorni hisoblaydi.
 */
export function calculateSingleWork(
  input: SingleWorkCalculationInput,
): SingleWorkCalculationResult {
  if (input.kind === "regular") {
    return {
      amount: Math.max(0, Math.round(input.manualAmount ?? 0)),
      stockDelta: 0,
    };
  }

  const { payUnit, cubeMode = "direct", workerPrice, workerCubePrice, volumeM3 } = input;

  if (payUnit === "row") {
    const rows = Math.max(0, input.rows ?? 0);
    return {
      amount: Math.round(rows * workerPrice),
      stockDelta: rows,
    };
  }

  if (payUnit === "cube") {
    if (cubeMode === "direct") {
      const m3 = Math.max(0, input.cubeM3 ?? 0);
      const stockDelta = volumeM3 && volumeM3 > 0 ? Math.round((m3 / volumeM3) * 100) / 100 : 0;
      return {
        amount: Math.round(m3 * workerCubePrice),
        stockDelta,
      };
    } else {
      // calculated: kiritilgan donalardan m³ hisoblanadi
      const qty = Math.max(0, input.quantity ?? 0);
      const m3 = volumeM3 && volumeM3 > 0 ? qty * volumeM3 : 0;
      return {
        amount: Math.round(m3 * workerCubePrice),
        stockDelta: qty,
      };
    }
  }

  // Standart dona bo'yicha
  const qty = Math.max(0, input.quantity ?? 0);
  return {
    amount: Math.round(qty * workerPrice),
    stockDelta: qty,
  };
}

export interface GroupWorkWorkerInput {
  workerId: string;
  salaryType: WorkerSalaryType;
  specialPrice?: number | null;
}

export interface GroupWorkCalculationInput {
  kind: "regular" | "material";
  totalAmountInput?: number;
  payUnit?: WorkPayUnit;
  cubeMode?: CubeCalculationMode;
  baseWorkerPrice: number;
  baseCubeWorkerPrice: number;
  quantity?: number;
  rows?: number;
  cubeM3?: number;
  volumeM3?: number | null;
  payFullToEach: boolean;
  workers: GroupWorkWorkerInput[];
}

export interface GroupWorkWorkerResult {
  workerId: string;
  amount: number;
}

export interface GroupWorkCalculationResult {
  totalAmount: number;
  stockDelta: number;
  distributions: GroupWorkWorkerResult[];
}

/**
 * Guruh ishi uchun jami summa, ombor miqdori (faqat 1 marta qo'shiladi)
 * va ishchilar orasida taqsimotni hisoblaydi (K2, K15 qarorlari).
 */
export function calculateGroupWork(
  input: GroupWorkCalculationInput,
): GroupWorkCalculationResult {
  const { workers, payFullToEach } = input;
  if (workers.length === 0) {
    return { totalAmount: 0, stockDelta: 0, distributions: [] };
  }

  // 1. Ishning bazaviy jami summasi va omborga qo'shiladigan miqdorni hisoblash
  const baseWork = calculateSingleWork({
    kind: input.kind,
    manualAmount: input.totalAmountInput,
    payUnit: input.payUnit,
    cubeMode: input.cubeMode,
    workerPrice: input.baseWorkerPrice,
    workerCubePrice: input.baseCubeWorkerPrice,
    quantity: input.quantity,
    rows: input.rows,
    cubeM3: input.cubeM3,
    volumeM3: input.volumeM3,
  });

  const totalAmount = baseWork.amount;
  const stockDelta = baseWork.stockDelta; // Omborga faqat bir marta qo'shiladi

  // 2. Ishchilar orasida taqsimlash
  if (payFullToEach) {
    // Har biriga to'liq beriladi (maoshli ishchilardan tashqari)
    const distributions: GroupWorkWorkerResult[] = workers.map((w) => ({
      workerId: w.workerId,
      amount: w.salaryType === "piecework" ? totalAmount : 0,
    }));
    return { totalAmount, stockDelta, distributions };
  }

  // Teng bo'linadi (K15: qolgan so'm birinchi ishchiga qo'shiladi, yig'indi jamiga teng)
  const pieceworkWorkers = workers.filter((w) => w.salaryType === "piecework");
  if (pieceworkWorkers.length === 0) {
    return {
      totalAmount,
      stockDelta,
      distributions: workers.map((w) => ({ workerId: w.workerId, amount: 0 })),
    };
  }

  const count = pieceworkWorkers.length;
  const baseShare = Math.floor(totalAmount / count);
  const remainder = totalAmount - baseShare * count;

  let firstGiven = false;
  const distributions: GroupWorkWorkerResult[] = workers.map((w) => {
    if (w.salaryType !== "piecework") {
      return { workerId: w.workerId, amount: 0 };
    }
    if (!firstGiven) {
      firstGiven = true;
      return { workerId: w.workerId, amount: baseShare + remainder };
    }
    return { workerId: w.workerId, amount: baseShare };
  });

  return { totalAmount, stockDelta, distributions };
}
