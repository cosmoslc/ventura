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

/* ---------- Sabablar sahifasi (ADR 0035): har amal turi uchun alohida ro'yxat va "sabab so'ralsinmi" yoqgichi ---------- */

export const REASON_SWITCHES_KEY = "reasons.switches";

export const REASON_CATEGORY_IDS = [
  "student_active",
  "student_trial",
  "freeze",
  "student_return",
  "leave",
  "group_archive",
  "lead_archive",
  "lost",
] as const;
export type ReasonCategoryId = (typeof REASON_CATEGORY_IDS)[number];

/** Yoqgichi bor turlar (guruhdan chiqish va lid yo'qotishda sabab doim majburiy) */
export type SwitchableCategoryId = Exclude<ReasonCategoryId, "leave" | "lost">;

export interface ReasonCategory {
  id: ReasonCategoryId;
  /** settings kaliti */
  key: string;
  /** Tegishli bo'lim (features) — bo'lim o'chirilgan bo'lsa tur ko'rinmaydi */
  feature: "students" | "groups" | "leads";
  /** Ro'yxatni tahrirlash ruxsati */
  permission: "students.edit" | "groups.edit" | "leads.edit";
  switchable: boolean;
  defaults: readonly string[];
}

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

export const REASON_CATEGORIES: Record<ReasonCategoryId, ReasonCategory> = {
  student_active: {
    id: "student_active",
    key: "reasons.student_active",
    feature: "students",
    permission: "students.edit",
    switchable: true,
    defaults: [
      "Narxi qimmat",
      "Vaqti to'g'ri kelmadi",
      "Natija bo'lmadi",
      "Boshqa markazga o'tdi",
      "Ko'chib ketdi",
      "Moliyaviy qiyinchilik",
    ],
  },
  student_trial: {
    id: "student_trial",
    key: "reasons.student_trial",
    feature: "students",
    permission: "students.edit",
    switchable: true,
    defaults: ["Dars yoqmadi", "Narxi qimmat", "Vaqti to'g'ri kelmadi", "Davom etmadi"],
  },
  freeze: {
    id: "freeze",
    key: "reasons.freeze",
    feature: "students",
    permission: "students.edit",
    switchable: true,
    defaults: ["Kasallik", "Safar", "Moliyaviy qiyinchilik", "Imtihon davri", "Vaqtincha to'xtadi"],
  },
  student_return: {
    id: "student_return",
    key: "reasons.student_return",
    feature: "students",
    permission: "students.edit",
    switchable: true,
    defaults: ["O'zi qaytdi", "Qarz to'landi", "Muammo hal bo'ldi", "Yangi guruh ochildi"],
  },
  leave: {
    id: "leave",
    key: LEAVE_REASONS_KEY,
    feature: "groups",
    permission: "groups.edit",
    switchable: false,
    defaults: DEFAULT_LEAVE_REASONS,
  },
  group_archive: {
    id: "group_archive",
    key: "reasons.group_archive",
    feature: "groups",
    permission: "groups.edit",
    switchable: true,
    defaults: ["Guruh to'ldi", "O'quvchi yetmadi", "Kurs tugadi", "O'qituvchi ketdi", "Xato ochilgan"],
  },
  lead_archive: {
    id: "lead_archive",
    key: "reasons.lead_archive",
    feature: "leads",
    permission: "leads.edit",
    switchable: true,
    defaults: ["Takroriy lid", "Xato raqam", "Sinov yozuvi", "Aloqa yo'q"],
  },
  lost: {
    id: "lost",
    key: LOST_REASONS_KEY,
    feature: "leads",
    permission: "leads.edit",
    switchable: false,
    defaults: DEFAULT_LOST_REASONS,
  },
};

export const REASON_CATEGORY_LIST = REASON_CATEGORY_IDS.map((id) => REASON_CATEGORIES[id]);

export type ReasonsConfig = {
  lists: Record<ReasonCategoryId, string[]>;
  /** true — shu amalda sabab so'raladi; qiymat yo'q bo'lsa — yoqilgan (eski tizimdagidek) */
  switches: Record<SwitchableCategoryId, boolean>;
};

export function parseSwitches(value: unknown): ReasonsConfig["switches"] {
  const src = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const out = {} as ReasonsConfig["switches"];
  for (const c of REASON_CATEGORY_LIST) {
    if (c.switchable)
      out[c.id as SwitchableCategoryId] = typeof src[c.id] === "boolean" ? (src[c.id] as boolean) : true;
  }
  return out;
}

/** settings qatorlari ({kalit: qiymat}) dan to'liq sozlama */
export function buildReasonsConfig(rows: Record<string, unknown>): ReasonsConfig {
  const lists = {} as ReasonsConfig["lists"];
  for (const c of REASON_CATEGORY_LIST) {
    lists[c.id] = c.key in rows ? parseReasonList(rows[c.key], c.defaults) : [...c.defaults];
  }
  return { lists, switches: parseSwitches(rows[REASON_SWITCHES_KEY]) };
}

/** Amalda ishlatiladigan holat: yoqilgan va ro'yxati bor bo'lsa — `active` (dialog sabab so'raydi) */
export function reasonOptions(config: ReasonsConfig, id: ReasonCategoryId): { active: boolean; options: string[] } {
  const options = config.lists[id];
  const enabled = REASON_CATEGORIES[id].switchable ? config.switches[id as SwitchableCategoryId] : true;
  return { active: enabled && options.length > 0, options };
}

/** O'quvchi arxivga o'tganda qaysi tur: sinovdagi yoki faol */
export const studentArchiveCategory = (status: string): ReasonCategoryId =>
  status === "trial" ? "student_trial" : "student_active";

/** Holat o'zgarganda qaysi tur (muzlatish yoki qaytarish); boshqa holatlarda sabab turi yo'q */
export function statusReasonCategory(to: string): ReasonCategoryId | null {
  return to === "paused" ? "freeze" : to === "returned" ? "student_return" : null;
}
