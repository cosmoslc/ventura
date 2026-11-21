/**
 * Sawmill hisob-kitob va o'lcham birliklari moduli.
 * SAWMILL-TAHLIL 5-bo'limi asosida.
 *
 * Barcha bazaviy o'lchamlar bazada santimetr (sm) bo'lib saqlanadi.
 * Pul qiymatlari butun son (bigint so'm).
 */

export type DimensionUnit = "mm" | "sm" | "m";

export interface DimensionsCm {
  thicknessCm: number | null;
  widthCm: number | null;
  lengthCm: number | null;
}

/**
 * Birlik koeffitsiyenti (sm ga o'tkazish uchun ko'paytiriladi).
 */
const TO_CM_FACTORS: Record<DimensionUnit, number> = {
  mm: 0.1,
  sm: 1,
  m: 100,
};

/**
 * Foydalanuvchi kiritgan o'lchamni bazaviy santimetr (sm) ga o'tkazadi.
 */
export function toCm(val: number, unit: DimensionUnit): number {
  if (!Number.isFinite(val) || val < 0) return 0;
  const factor = TO_CM_FACTORS[unit];
  // 4 xonali aniqlikda yaxlitlash (masalan 12.3456)
  return Math.round(val * factor * 10000) / 10000;
}

/**
 * Bazadagi santimetr (sm) ni berilgan birlikka o'tkazadi (ko'rsatish yoki formaga to'ldirish uchun).
 */
export function fromCm(valCm: number, unit: DimensionUnit): number {
  if (!Number.isFinite(valCm) || valCm < 0) return 0;
  const factor = TO_CM_FACTORS[unit];
  return Math.round((valCm / factor) * 10000) / 10000;
}

/**
 * 1 dona materialning hajmini (kub metri, m³) hisoblaydi.
 * V = (q/100) * (e/100) * (u/100) m³
 * Uchala o'lcham ham musbat bo'lmasa, null qaytaradi (kubga aylanmaydi).
 */
export function pieceVolumeM3(dims: DimensionsCm): number | null {
  const { thicknessCm, widthCm, lengthCm } = dims;
  if (
    thicknessCm === null ||
    widthCm === null ||
    lengthCm === null ||
    thicknessCm <= 0 ||
    widthCm <= 0 ||
    lengthCm <= 0
  ) {
    return null;
  }

  // Metrlarga o'tkazib ko'paytirish
  const qM = thicknessCm / 100;
  const eM = widthCm / 100;
  const uM = lengthCm / 100;
  const vol = qM * eM * uM;

  // 6 ta o'nlik xonagacha aniqlikda
  return Math.round(vol * 1_000_000) / 1_000_000;
}

/**
 * Donani kub metrga (m³) aylantiradi.
 * Material kubga aylanmasa null qaytaradi.
 */
export function pieceToCube(pieces: number, volumeM3: number | null): number | null {
  if (volumeM3 === null || volumeM3 <= 0 || pieces <= 0) return null;
  const cube = pieces * volumeM3;
  return Math.round(cube * 10_000) / 10_000;
}

/**
 * Kub metrni (m³) donaga aylantiradi.
 * Material kubga aylanmasa null qaytaradi.
 */
export function cubeToPiece(cubeM3: number, volumeM3: number | null): number | null {
  if (volumeM3 === null || volumeM3 <= 0 || cubeM3 <= 0) return null;
  const pieces = cubeM3 / volumeM3;
  // Donani 2 ta o'nlik xonagacha yoki butun songa yaqinlashtirish
  return Math.round(pieces * 100) / 100;
}

/**
 * Pul summasini o'zbek so'mida formatlaydi.
 * Masalan: 1250000 -> "1 250 000 so'm", -50000 -> "-50 000 so'm"
 */
export function formatMoney(amount: number | bigint, withCurrency = true): string {
  const num = typeof amount === "bigint" ? Number(amount) : amount;
  const isNegative = num < 0;
  const abs = Math.abs(Math.round(num));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = isNegative ? "-" : "";
  return withCurrency ? `${sign}${formatted} so'm` : `${sign}${formatted}`;
}

/**
 * Kiritilgan matndan butun pul summasini ajratib oladi (probellar va belgilarni tozalaydi).
 */
export function parseMoney(input: string): bigint {
  const cleaned = input.replace(/[^\d-]/g, "");
  if (!cleaned || cleaned === "-") return 0n;
  try {
    return BigInt(cleaned);
  } catch {
    return 0n;
  }
}
