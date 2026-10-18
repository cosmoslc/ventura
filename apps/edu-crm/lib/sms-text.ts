import { z } from "zod";
import { uz } from "./uz";

/*
 * SMS shablonlari matni (docs/EDU-CRM-SMS.md, S2): o'zgaruvchilar, qismlar hisobi, tayyor andozalar va Eskiz moderatsiya
 * holatlari. Forma ham, server ham shu fayldan foydalanadi.
 *
 * Qismlar: lotin (GSM-7) — 160 belgi bitta qism, ko'p qismli xabarda har biri 153; boshqa belgi bo'lsa (kirill,
 * "ʻ") — UCS-2: 70 / 67. Shuning uchun o'zbekcha "oʻ", "gʻ" belgilari saqlashda oddiy apostrofga almashtiriladi.
 */

const t = uz.smsTemplates;

export const SMS_TEMPLATE_KINDS = [
  "payment_received",
  "payment_reminder",
  "debt_warning",
  "absence",
  "salary_paid",
  "birthday",
  "custom",
] as const;
export type SmsTemplateKind = (typeof SMS_TEMPLATE_KINDS)[number];

export const SMS_VARS = [
  "ism",
  "familiya",
  "guruh",
  "kurs",
  "summa",
  "qarz",
  "oy",
  "sana",
  "markaz",
  "telefon",
  "maosh",
] as const;
export type SmsVar = (typeof SMS_VARS)[number];

const COMMON: SmsVar[] = ["ism", "familiya", "markaz", "telefon"];

/** Har turda ishlatsa bo'ladigan o'zgaruvchilar (avto-SMS shu qiymatlarni beradi — S4) */
export const KIND_VARS: Record<SmsTemplateKind, readonly SmsVar[]> = {
  payment_received: [...COMMON, "summa", "guruh", "kurs", "oy", "sana"],
  payment_reminder: [...COMMON, "summa", "guruh", "kurs", "oy", "sana"],
  debt_warning: [...COMMON, "qarz", "guruh", "kurs"],
  absence: [...COMMON, "guruh", "kurs", "sana"],
  salary_paid: ["ism", "familiya", "markaz", "maosh", "oy", "sana"],
  birthday: COMMON,
  custom: SMS_VARS.filter((v) => v !== "maosh"),
};

/** Jonli namuna uchun qiymatlar */
export const SAMPLE_VARS: Record<SmsVar, string> = {
  ism: "Aziz",
  familiya: "Karimov",
  guruh: "IELTS 1",
  kurs: "Ingliz tili",
  summa: "450 000",
  qarz: "300 000",
  oy: "oktabr",
  sana: "18.10.2026",
  markaz: "Markaz",
  telefon: "+998 90 123 45 67",
  maosh: "3 500 000",
};

/** Tayyor andozalar (lotin, oddiy apostrof — bitta qismga sig'adi) */
export const SMS_PRESETS: Record<Exclude<SmsTemplateKind, "custom">, string> = {
  payment_received: "{markaz}: {ism} {familiya} uchun {summa} so'm to'lov qabul qilindi ({guruh}). Rahmat!",
  payment_reminder: "{markaz}: {ism}ning {oy} oyi uchun {summa} so'm to'lov muddati {sana}. Tel: {telefon}",
  debt_warning:
    "{markaz}: {ism} {familiya}ning {qarz} so'm qarzi bor. Iltimos, to'lovni amalga oshiring. Tel: {telefon}",
  absence: "{markaz}: {ism} bugun ({sana}) {guruh} darsiga kelmadi. Tel: {telefon}",
  salary_paid: "{markaz}: {ism}, {oy} oyi uchun {maosh} so'm maosh berildi.",
  birthday: "{markaz} jamoasi {ism}ni tug'ilgan kuni bilan tabriklaydi!",
};

/** Moderatsiya holati: draft — Eskiz'ga yuborilmagan; advert — Eskiz reklama deb belgilagan (kunduzi, qimmatroq) */
export const SMS_MODERATION = ["draft", "moderation", "approved", "advert", "rejected"] as const;
export type SmsModeration = (typeof SMS_MODERATION)[number];

/** Eskiz holati → bizniki */
export function moderationFromEskiz(status: string): SmsModeration {
  if (status === "service") return "approved";
  if (status === "reklama") return "advert";
  if (status === "rejected") return "rejected";
  return "moderation";
}

/** Tipografik belgilarni GSM-7 ga mos oddiylariga almashtiradi (qism soni oshmasin) */
export function normalizeSms(text: string): string {
  return text
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/\r\n?/g, "\n");
}

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

export interface SmsParts {
  /** Belgilar (GSM-7 da kengaytirilgan belgi 2 ta hisoblanadi) */
  length: number;
  parts: number;
  unicode: boolean;
  /** Joriy qism chegarasi (160 / 153 / 70 / 67) */
  perPart: number;
}

export function smsParts(text: string): SmsParts {
  let gsm = 0;
  let unicode = false;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) gsm += 1;
    else if (GSM_EXT.includes(ch)) gsm += 2;
    else {
      unicode = true;
      break;
    }
  }
  if (unicode) {
    const length = text.length; // UTF-16 birliklari
    const perPart = length <= 70 ? 70 : 67;
    return { length, parts: Math.max(1, Math.ceil(length / perPart)), unicode, perPart };
  }
  const perPart = gsm <= 160 ? 160 : 153;
  return { length: gsm, parts: Math.max(1, Math.ceil(gsm / perPart)), unicode, perPart };
}

/** Matndagi `{o'zgaruvchi}` nomlari (takrorsiz, tartib bilan) */
export function templateVars(body: string): string[] {
  return [...new Set([...body.matchAll(/\{([^{}\s]+)\}/g)].map((m) => m[1]!))];
}

/** Shu turda ruxsat etilmagan o'zgaruvchilar */
export function unknownVars(body: string, kind: SmsTemplateKind): string[] {
  const allowed = new Set<string>(KIND_VARS[kind]);
  return templateVars(body).filter((v) => !allowed.has(v));
}

/** "Ism familiya" (o'quvchi va xodim formalaridagi tartib): birinchi so'z — ism, qolgani — familiya */
export function splitName(name: string): { first: string; last: string } {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return { first, last: rest.join(" ") };
}

/** O'zgaruvchilarni qiymat bilan almashtiradi; qiymati yo'q o'zgaruvchi bo'sh qoladi */
export function renderSms(body: string, vars: Partial<Record<SmsVar, string>>): string {
  return normalizeSms(body.replace(/\{([^{}\s]+)\}/g, (_, k: string) => vars[k as SmsVar] ?? ""))
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Namunadagi qism soni (o'zgaruvchilar namuna qiymatlari bilan) */
export const sampleParts = (body: string, centerName: string) =>
  smsParts(renderSms(body, { ...SAMPLE_VARS, markaz: centerName }));

export const smsTemplateInput = z
  .object({
    id: z.uuid().optional(),
    kind: z.enum(SMS_TEMPLATE_KINDS),
    name: z.string().trim().min(1, t.nameRequired).max(80),
    body: z.string().transform(normalizeSms).pipe(z.string().trim().min(1, t.bodyRequired).max(1000, t.bodyTooLong)),
  })
  .superRefine((v, ctx) => {
    const bad = unknownVars(v.body, v.kind);
    if (bad.length) ctx.addIssue({ code: "custom", message: t.unknownVars(bad.map((b) => `{${b}}`)), path: ["body"] });
  });
export type SmsTemplateInput = z.input<typeof smsTemplateInput>;
