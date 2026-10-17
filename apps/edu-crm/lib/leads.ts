import { type HolidayRange, lessonDates } from "./lessons";
import { DEFAULT_LOST_REASONS, LOST_REASONS_KEY, parseReasonList } from "./reasons";

/*
 * Lidlar (E4a, ADR 0022): standart bosqichlar, manbalar va bosqichlar ro'yxati qoidalari. Bosqichlar markaz
 * sozlamasida: ochiq bosqichlar (doskadagi ustunlar) qo'shiladi, nomlanadi, bo'yaladi va tartiblanadi; "Guruhga qo'shildi"
 * (`won`, o'quvchiga aylanganlar) va "Yo'qotildi" (`lost`) — tizim bosqichlari, bittadan, o'chirilmaydi.
 */

export type StageKind = "open" | "won" | "lost";

/**
 * Yangi mijozga yaratiladigan standart bosqichlar (eski CRM bilan bir xil ketma-ketlik). Oxirgi ochiq bo'lmagan
 * "Guruhga qo'shildi" — tizim bosqichi `won`: lid o'quvchiga aylantirilganda (guruhga qo'shilganda) shu yerga o'tadi,
 * shuning uchun alohida ochiq "Guruhga qo'shildi" ustuni qo'shilmaydi (takror bo'lmasin). Mavjud mijozlarning
 * bosqichlari o'zgarmaydi.
 */
export const DEFAULT_LEAD_STAGES: { name: string; color: string; kind: StageKind }[] = [
  { name: "Yangi", color: "#3b82f6", kind: "open" },
  { name: "Ma'lumot berildi", color: "#f59e0b", kind: "open" },
  { name: "Sinov darsida", color: "#8b5cf6", kind: "open" },
  { name: "Sinovda qatnashdi", color: "#06b6d4", kind: "open" },
  { name: "Guruhga qo'shildi", color: "#10b981", kind: "won" },
  { name: "Yo'qotildi", color: "#ef4444", kind: "lost" },
];

export const STAGE_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#64748b",
] as const;

export const LEAD_SOURCES = [
  "Instagram",
  "Telegram",
  "Tanish / Tavsiya",
  "Banner / Reklama",
  "Veb-sayt forma",
  "Qo'ng'iroq",
  "Boshqa",
] as const;

export { DEFAULT_LOST_REASONS, LOST_REASONS_KEY };

/** Bazadagi qiymat: 1–30 ta, takrorsiz, bo'sh emas; buzilgan bo'lsa standart ro'yxat */
export const parseLostReasons = (value: unknown): string[] => parseReasonList(value, DEFAULT_LOST_REASONS);

export interface StageDraft {
  id?: string;
  name: string;
  color: string;
  kind: StageKind;
}

/** Saqlashdan oldin: nom bo'sh emas va takrorlanmaydi, kamida bitta ochiq bosqich, won va lost — bittadan */
export function stagesError(list: readonly StageDraft[]): "name" | "duplicate" | "open" | "system" | null {
  if (list.some((s) => !s.name.trim())) return "name";
  const names = list.map((s) => s.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return "duplicate";
  if (!list.some((s) => s.kind === "open")) return "open";
  if (list.filter((s) => s.kind === "won").length !== 1 || list.filter((s) => s.kind === "lost").length !== 1)
    return "system";
  return null;
}

/** Bosqichda necha kun turgani (Toshkent kuni bo'yicha) */
export function daysIn(sinceIso: string, today: string): number {
  const since = new Date(sinceIso).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`)) / 86_400_000));
}

/* ---------- Birinchi dars kunlari (EDU-CRM-FIXES 1.1) ---------- */

/** Lidni birinchi darsga yozishda taklif qilinadigan oraliq: bugundan boshlab 3 hafta */
export const FIRST_LESSON_WINDOW_DAYS = 21;

interface LessonGroup {
  days: readonly string[];
  startDate: string;
  branchId: string;
}

/** "2026-10-12" + n kun */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Guruhning bugundan boshlab yaqin 3 haftadagi dars kunlari: jadval, guruh boshlanishi va dam olish kunlari hisobga olingan */
export function firstLessonDays(group: LessonGroup, today: string, holidays: readonly HolidayRange[]): string[] {
  return lessonDates(group, today, addDays(today, FIRST_LESSON_WINDOW_DAYS - 1), holidays);
}

/** Sana shu guruhning haqiqiy dars kuni va bugundan oldin emas (server tekshiruvi) */
export function isFirstLessonDay(
  group: LessonGroup,
  date: string,
  today: string,
  holidays: readonly HolidayRange[],
): boolean {
  return date >= today && lessonDates(group, date, date, holidays).length === 1;
}
