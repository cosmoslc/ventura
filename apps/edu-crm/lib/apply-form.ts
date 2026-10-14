import { z } from "zod";

/*
 * Tashqi ariza sahifasi `/ariza` (E4c, ADR 0026): kirishsiz forma — havola yoki saytga iframe. Sozlama `settings`
 * jadvalida (APPLY_FORM_KEY): yoqilganmi, sarlavha va matn, arizalar tushadigan filial, kurs va filial so'ralsinmi,
 * "Lid formasi"dagi qaysi qo'shimcha maydonlar ko'rinsin. Standart — o'chirilgan: markaz o'zi yoqadi.
 *
 * Spamdan himoya: IP va markaz bo'yicha so'rovlar soni (`WindowLimiter`), yashirin "tuzoq" maydon, formani juda tez
 * yuborish (imzolangan vaqt belgisi, `apply-stamp.ts`) va telefon tekshiruvi.
 */

export const APPLY_FORM_KEY = "leads.apply_form";
export const APPLY_SOURCE = "Veb-sayt forma";
export const APPLY_PATH = "/ariza";

export const applyFormSchema = z.object({
  enabled: z.boolean().default(false),
  title: z.string().trim().max(120).default(""),
  intro: z.string().trim().max(500).default(""),
  success: z.string().trim().max(300).default(""),
  /** Arizalar tushadigan filial; null — birinchi faol filial */
  branchId: z.uuid().nullable().default(null),
  /** Ariza beruvchi filialni o'zi tanlaydi (bir nechta filial bo'lsa) */
  askBranch: z.boolean().default(false),
  askCourse: z.boolean().default(true),
  /** "Lid formasi" qo'shimcha maydonlaridan qaysilari ko'rinadi */
  fieldIds: z
    .array(z.string().regex(/^[A-Za-z0-9_]{1,40}$/))
    .max(40)
    .default([]),
});
export type ApplyForm = z.infer<typeof applyFormSchema>;

export const DEFAULT_APPLY_FORM: ApplyForm = applyFormSchema.parse({});

/** Bazadagi qiymat; buzilgan yoki yo'q bo'lsa — standart (o'chirilgan) */
export function parseApplyForm(value: unknown): ApplyForm {
  const parsed = applyFormSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_APPLY_FORM;
}

/** Ariza beruvchi yuboradigan ma'lumot */
export const applyInput = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^\d{9}$/),
  branchId: z.uuid().nullable().default(null),
  courseId: z.uuid().nullable().default(null),
  customData: z.record(z.string().max(40), z.string().max(300)).default({}),
  /** Yashirin "tuzoq" maydon: odam ko'rmaydi, bot to'ldiradi */
  website: z.string().max(300).default(""),
  /** Forma ochilgan vaqt belgisi (imzolangan) */
  stamp: z.string().max(200),
});
export type ApplyInput = z.input<typeof applyInput>;

/**
 * Telefon: 9 ta mahalliy raqam, ochiq-oydin soxtasi emas (hammasi bir xil raqam, operator kodidan keyin nollar,
 * 123456789). Operator kodlari ro'yxati bilan cheklanmaydi — yangi kod qo'shilsa haqiqiy ariza yo'qolmasin.
 */
export function plausiblePhone(local: string): boolean {
  if (!/^\d{9}$/.test(local)) return false;
  if (/^(\d)\1{8}$/.test(local)) return false;
  if (/^\d{2}0{7}$/.test(local)) return false;
  return local !== "123456789" && local !== "987654321";
}

/**
 * Oyna ichida so'rovlar soni (jarayon xotirasida). Mijozlar bitta jarayonda ishlaydi — kalitda mijoz bo'ladi.
 * Ilova qayta ishga tushsa hisob nolga tushadi; bu himoyaning bir qatlami, yolg'iz emas.
 */
export class WindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Ruxsat bo'lsa — hisoblaydi va true; chegaraga yetgan bo'lsa — false (hisoblamaydi) */
  take(key: string, now = Date.now()): boolean {
    const from = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > from);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5_000) this.sweep(from);
    return true;
  }

  private sweep(from: number) {
    for (const [k, list] of this.hits) if (!list.some((t) => t > from)) this.hits.delete(k);
  }
}

/** Saytga qo'yiladigan iframe kodi */
export function iframeCode(url: string, title: string): string {
  const safe = title.replace(/[<>"&]/g, "");
  return `<iframe src="${url}?embed=1" title="${safe}" width="100%" height="640" style="border:0;max-width:520px" loading="lazy"></iframe>`;
}
