import type { ColorOption } from "@ventura/ui/color-swatches";

/*
 * Kurs va filial ranglari — foydalanuvchi tanlaydigan ma'lumot (bazada #rrggbb), interfeys tokeni emas.
 * Ro'yxatlar eski tizimdagidek (kurs — 12, filial — 9 rang).
 */

export const COURSE_COLORS: readonly ColorOption[] = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Siyohrang" },
  { value: "#0284c7", label: "Zangori" },
  { value: "#10b981", label: "Yashil" },
  { value: "#f43f5e", label: "Qizil" },
  { value: "#f59e0b", label: "To'q sariq" },
  { value: "#ec4899", label: "Pushti" },
  { value: "#ea580c", label: "Apelsin" },
  { value: "#06b6d4", label: "Moviy" },
  { value: "#0d9488", label: "Feruza" },
  { value: "#475569", label: "Kulrang" },
  { value: "#a855f7", label: "Binafsha" },
];

export const BRANCH_COLORS: readonly ColorOption[] = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Binafsha" },
  { value: "#ec4899", label: "Pushti" },
  { value: "#f43f5e", label: "Qizil" },
  { value: "#f97316", label: "Apelsin" },
  { value: "#eab308", label: "Sariq" },
  { value: "#10b981", label: "Yashil" },
  { value: "#06b6d4", label: "Moviy" },
  { value: "#3b82f6", label: "Ko'k" },
];

export const DEFAULT_COLOR = "#6366f1";

/** Lavozim ranglari (eski tizimdagi 6 ta) */
export const POSITION_COLORS: readonly ColorOption[] = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#0ea5e9", label: "Moviy" },
  { value: "#10b981", label: "Yashil" },
  { value: "#f59e0b", label: "Sariq" },
  { value: "#ec4899", label: "Pushti" },
  { value: "#8b5cf6", label: "Binafsha" },
];
