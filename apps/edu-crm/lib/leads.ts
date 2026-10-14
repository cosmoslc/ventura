import { parseReasonList } from "./reasons";

/*
 * Lidlar (E4a, ADR 0022): standart bosqichlar, manbalar va bosqichlar ro'yxati qoidalari. Bosqichlar markaz
 * sozlamasida: ochiq bosqichlar (doskadagi ustunlar) qo'shiladi, nomlanadi, bo'yaladi va tartiblanadi; "O'quvchi bo'ldi"
 * (`won`) va "Yo'qotildi" (`lost`) — tizim bosqichlari, bittadan, o'chirilmaydi.
 */

export type StageKind = "open" | "won" | "lost";

export const DEFAULT_LEAD_STAGES: { name: string; color: string; kind: StageKind }[] = [
  { name: "Yangi", color: "#3b82f6", kind: "open" },
  { name: "Bog'lanildi", color: "#f59e0b", kind: "open" },
  { name: "Sinov darsi", color: "#8b5cf6", kind: "open" },
  { name: "O'quvchi bo'ldi", color: "#10b981", kind: "won" },
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

export const LOST_REASONS_KEY = "leads.lost_reasons";

/** Lid yo'qotilganda tanlanadigan sabablar (eski tizimdagi "Liddan o'chirilganda" sabablari) */
export const DEFAULT_LOST_REASONS = [
  "Narxi qimmat",
  "Vaqti to'g'ri kelmadi",
  "Boshqa markazni tanladi",
  "Javob bermadi",
  "Qiziqishi yo'qoldi",
  "Manzil uzoq",
  "Boshqa",
];

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
