import { z } from "zod";

/*
 * "Xodim formasi" — markaz o'zi qo'shadigan qo'shimcha maydonlar (eski tizimdagi staff_form_fields). Ro'yxat
 * `settings` jadvalida STAFF_FIELDS_KEY kalitida, qiymatlar esa xodimning `custom_data` ustunida (maydon id → matn).
 * Sozlama hali saqlanmagan bo'lsa — standart 6 ta maydon.
 */

export const STAFF_FIELDS_KEY = "staff.form_fields";
export const STAFF_FIELD_TYPES = ["text", "number", "date", "tel", "select"] as const;
export type StaffFieldType = (typeof STAFF_FIELD_TYPES)[number];

export const staffFieldSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_]{1,40}$/),
  label: z.string().trim().min(1).max(80),
  type: z.enum(STAFF_FIELD_TYPES),
  placeholder: z.string().trim().max(80).default(""),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});
export type StaffField = z.infer<typeof staffFieldSchema>;
export const staffFieldsSchema = z.array(staffFieldSchema).max(40);

export const DEFAULT_STAFF_FIELDS: StaffField[] = [
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

/** Bazadagi qiymat — buzilgan yoki yo'q bo'lsa standart ro'yxat */
export function parseStaffFields(value: unknown): StaffField[] {
  if (value === undefined || value === null) return DEFAULT_STAFF_FIELDS;
  const parsed = staffFieldsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_STAFF_FIELDS;
}

export interface FormCompletion {
  filled: number;
  total: number;
  /** Hamma maydon to'ldirilgan (maydon yo'q bo'lsa ham — to'ldiradigan narsa yo'q) */
  complete: boolean;
}

export function formCompletion(data: Record<string, string>, fields: readonly StaffField[]): FormCompletion {
  const filled = fields.filter((f) => (data[f.id] ?? "").trim() !== "").length;
  return { filled, total: fields.length, complete: filled === fields.length };
}

/** Faqat ro'yxatdagi maydonlar qoladi, bo'sh qiymatlar tashlanadi */
export function cleanCustomData(data: Record<string, string>, fields: readonly StaffField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (data[f.id] ?? "").trim().slice(0, 300);
    if (!v) continue;
    if (f.type === "select" && f.options.length && !f.options.includes(v)) continue;
    out[f.id] = v;
  }
  return out;
}

/** Majburiy maydonlardan birinchi to'ldirilmagani */
export function missingRequired(data: Record<string, string>, fields: readonly StaffField[]): StaffField | null {
  return fields.find((f) => f.required && !(data[f.id] ?? "").trim()) ?? null;
}
