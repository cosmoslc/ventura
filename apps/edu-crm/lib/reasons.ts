/*
 * Sabablar ro'yxatlari (sozlamalarda saqlanadi): lid yo'qotish sabablari (ADR 0022) va guruhdan chiqish sabablari
 * (ADR 0031, eski tizimdagi "Sabablar" sahifasi). Bazadagi qiymat buzilgan yoki bo'sh bo'lsa — standart ro'yxat.
 */

/** 1–30 ta, takrorsiz, bo'sh emas, 80 belgigacha */
export function parseReasonList(value: unknown, defaults: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...defaults];
  const list = [...new Set(value.filter((v): v is string => typeof v === "string").map((v) => v.trim()))].filter(
    (v) => v.length > 0 && v.length <= 80,
  );
  return list.length ? list.slice(0, 30) : [...defaults];
}

export const LEAVE_REASONS_KEY = "groups.leave_reasons";

/** Guruhdan chiqarishda tanlanadigan sabablar (standart; markaz o'zgartiradi) */
export const DEFAULT_LEAVE_REASONS = [
  "Narxi qimmat",
  "Vaqti to'g'ri kelmadi",
  "O'qituvchi yoqmadi",
  "Natija bo'lmadi",
  "Boshqa markazga o'tdi",
  "Ko'chib ketdi",
  "Moliyaviy qiyinchilik",
  "Sog'lig'i sababli",
  "Kursni tugatdi",
  "Boshqa",
];
