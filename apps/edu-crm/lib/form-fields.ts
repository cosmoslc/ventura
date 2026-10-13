import { z } from "zod";

/*
 * Formadagi qo'shimcha maydonlar — markaz o'zi qo'shadi: "Xodim formasi" (eski tizimdagi staff_form_fields) va
 * "O'quvchi formasi" (ADR 0020). Ro'yxat `settings` jadvalida (STAFF_FIELDS_KEY / STUDENT_FIELDS_KEY), qiymatlar esa
 * xodim yoki o'quvchining `custom_data` ustunida (maydon id → matn). Sozlama hali saqlanmagan bo'lsa — standart ro'yxat
 * (xodimda 6 ta maydon, o'quvchida bo'sh: o'quvchi formasida faqat ism, telefon, jins va izoh asosiy).
 *
 * Qiymat har doim matn: ko'p tanlov — variantlar ", " bilan (variant ichida vergul bo'lmaydi, sozlamada vergul bilan
 * ajratib yoziladi), belgilash — "1", guruh — guruh id, sana — YYYY-MM-DD, soat — HH:MM.
 */

export const STAFF_FIELDS_KEY = "staff.form_fields";
export const STUDENT_FIELDS_KEY = "students.form_fields";
export const FIELD_TYPES = [
  "text",
  "number",
  "tel",
  "date",
  "time",
  "select",
  "multiselect",
  "checkbox",
  "group",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
/** Xodim formasida guruh tanlash yo'q (guruh — o'quvchiga tegishli) */
export const STAFF_FIELD_TYPES = FIELD_TYPES.filter((t) => t !== "group");
/** Variantlar ro'yxati kerak bo'lgan turlar */
export const hasOptions = (t: FieldType) => t === "select" || t === "multiselect";

export const formFieldSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_]{1,40}$/),
  label: z.string().trim().min(1).max(80),
  type: z.enum(FIELD_TYPES),
  placeholder: z.string().trim().max(80).default(""),
  required: z.boolean().default(false),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(60)
        .refine((o) => !o.includes(","), "variantda vergul bo'lmaydi"),
    )
    .max(30)
    .default([]),
});
export type FormField = z.infer<typeof formFieldSchema>;
export const formFieldsSchema = z.array(formFieldSchema).max(40);

export const DEFAULT_STAFF_FIELDS: FormField[] = [
  {
    id: "passport",
    label: "Pasport seriya va raqami",
    type: "text",
    placeholder: "AA 1234567",
    required: false,
    options: [],
  },
  { id: "pinfl", label: "JSHSHIR (PINFL)", type: "text", placeholder: "14 xonali raqam", required: false, options: [] },
  {
    id: "education",
    label: "Ta'lim darajasi / Mutaxassisligi",
    type: "select",
    placeholder: "",
    required: false,
    options: ["Oliy (Magistr)", "Oliy (Bakalavr)", "O'rta maxsus", "Talaba", "Boshqa"],
  },
  { id: "telegram", label: "Telegram username", type: "text", placeholder: "@username", required: false, options: [] },
  {
    id: "contractNo",
    label: "Mehnat shartnomasi raqami",
    type: "text",
    placeholder: "№ 12/2025",
    required: false,
    options: [],
  },
  {
    id: "emergencyPhone",
    label: "Favqulodda bog'lanish telefoni (Yaqini)",
    type: "tel",
    placeholder: "+998 90 123 45 67",
    required: false,
    options: [],
  },
];

export const DEFAULT_STUDENT_FIELDS: FormField[] = [];

/** Bazadagi qiymat — buzilgan yoki yo'q bo'lsa standart ro'yxat */
export function parseFormFields(value: unknown, defaults: FormField[]): FormField[] {
  if (value === undefined || value === null) return defaults;
  const parsed = formFieldsSchema.safeParse(value);
  return parsed.success ? parsed.data : defaults;
}

export interface FormCompletion {
  filled: number;
  total: number;
  /** Hamma maydon to'ldirilgan (maydon yo'q bo'lsa ham — to'ldiradigan narsa yo'q) */
  complete: boolean;
}

export function formCompletion(data: Record<string, string>, fields: readonly FormField[]): FormCompletion {
  const filled = fields.filter((f) => (data[f.id] ?? "").trim() !== "").length;
  return { filled, total: fields.length, complete: filled === fields.length };
}

/** Ko'p tanlov qiymati → variantlar */
export const splitMulti = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bitta maydon qiymatini tozalash; noto'g'ri qiymat — bo'sh */
function cleanValue(f: FormField, raw: string): string {
  const v = raw.trim().slice(0, 300);
  if (!v) return "";
  switch (f.type) {
    case "select":
      return f.options.length && !f.options.includes(v) ? "" : v;
    case "multiselect": {
      const picked = f.options.filter((o) => splitMulti(v).includes(o));
      return picked.join(", ");
    }
    case "checkbox":
      return v === "1" ? "1" : "";
    case "group":
      return UUID.test(v) ? v.toLowerCase() : "";
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
    case "time":
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "";
    default:
      return v;
  }
}

/** Faqat ro'yxatdagi maydonlar qoladi, bo'sh va noto'g'ri qiymatlar tashlanadi */
export function cleanCustomData(data: Record<string, string>, fields: readonly FormField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = cleanValue(f, data[f.id] ?? "");
    if (v) out[f.id] = v;
  }
  return out;
}

/**
 * Profil va batafsil oynada ko'rinadigan matn; null — to'ldirilmagan. Belgilash to'ldirilmagan bo'lsa ham "Yo'q".
 * `groupName` — guruh id bo'yicha nom (topilmasa "—").
 */
export function fieldText(
  f: FormField,
  value: string | undefined,
  labels: { yes: string; no: string; groupName: (id: string) => string | undefined },
): string | null {
  if (f.type === "checkbox") return value === "1" ? labels.yes : labels.no;
  if (!value) return null;
  if (f.type === "group") return labels.groupName(value) ?? "—";
  if (f.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join(".");
  return value;
}

/** Majburiy maydonlardan birinchi to'ldirilmagani */
export function missingRequired(data: Record<string, string>, fields: readonly FormField[]): FormField | null {
  return fields.find((f) => f.required && !(data[f.id] ?? "").trim()) ?? null;
}
