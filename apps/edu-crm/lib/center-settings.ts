import { z } from "zod";
import { displayPhone } from "./format";
import { uz } from "./uz";

/*
 * Markaz sozlamalari (E6a, ADR 0036): aloqa, ijtimoiy tarmoqlar va ish vaqti. `settings` jadvalida kalit
 * `center`. Eski tizimda bu maydonlar faqat saqlanardi; yangida ariza sahifasi (`/ariza`) va chek ishlatadi.
 * Markaz nomi va logotipi bu yerda emas — ular Ventura panelida (tenant.name, tenant.brand).
 */

export const CENTER_KEY = "center";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, uz.settingsCenter.timeInvalid);
const phone = z.string().regex(/^(\d{9})?$/, uz.settingsCenter.phoneInvalid);

/** http(s) manzil, nuqtali domen bilan */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Sayt va xarita: protokolsiz yozilsa https qo'shiladi; bo'sh qoladi — bo'sh */
export function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

/** "@nom", "t.me/nom" yoki to'liq havola → to'liq havola. Tushunarsiz bo'lsa tekshiruv rad etadi */
export function normalizeSocial(kind: "telegram" | "instagram", raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const handle = kind === "telegram" ? /^@?([A-Za-z0-9_]{3,64})$/ : /^@?([A-Za-z0-9_.]{1,30})$/;
  const m = handle.exec(v);
  if (m) return kind === "telegram" ? `https://t.me/${m[1]}` : `https://instagram.com/${m[1]}`;
  return normalizeUrl(v);
}

const url = (normalize: (v: string) => string) =>
  z
    .string()
    .trim()
    .max(200)
    .transform(normalize)
    .refine((v) => v === "" || isHttpUrl(v), uz.settingsCenter.linkInvalid);

const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));

/** Bazadagi shakl (saqlashdan keyingi) */
export const centerSchema = z.object({
  /** 9 ta mahalliy raqam yoki bo'sh */
  phone: phone.default(""),
  phone2: phone.default(""),
  address: z.string().trim().max(200).default(""),
  mapUrl: url(normalizeUrl).default(""),
  telegram: url((v) => normalizeSocial("telegram", v)).default(""),
  instagram: url((v) => normalizeSocial("instagram", v)).default(""),
  website: url(normalizeUrl).default(""),
  workDays: z
    .array(z.enum(WEEKDAYS))
    .max(7)
    .transform((d) => WEEKDAYS.filter((w) => d.includes(w)))
    .default([]),
  workStart: z.union([time, z.literal("")]).default(""),
  workEnd: z.union([time, z.literal("")]).default(""),
});
export type CenterSettings = z.infer<typeof centerSchema>;

/** Forma yuboradigan kirish: ish vaqti oralig'i ham tekshiriladi */
export const centerInput = centerSchema
  .strict()
  .refine((v) => (v.workStart === "") === (v.workEnd === ""), {
    message: uz.settingsCenter.timeBoth,
    path: ["workEnd"],
  })
  .refine((v) => v.workStart === "" || minutes(v.workStart) < minutes(v.workEnd), {
    message: uz.settingsCenter.timeOrder,
    path: ["workEnd"],
  });

export const DEFAULT_CENTER: CenterSettings = centerSchema.parse({});

/** Bazadagi qiymat; yo'q yoki buzilgan bo'lsa — bo'sh sozlama */
export function parseCenter(value: unknown): CenterSettings {
  const parsed = centerSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_CENTER;
}

/** "Du–Shan" kabi qisqa yozuv: ketma-ket 3 va undan ko'p kun oraliq bo'ladi, qolganlari vergul bilan */
export function workDaysText(days: readonly Weekday[]): string {
  const idx = WEEKDAYS.map((w, i) => (days.includes(w) ? i : -1)).filter((i) => i >= 0);
  const short = (i: number) => uz.weekdays.short[WEEKDAYS[i]!];
  const parts: string[] = [];
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j]! + 1) j++;
    if (j - i >= 2) parts.push(`${short(idx[i]!)}–${short(idx[j]!)}`);
    else for (let k = i; k <= j; k++) parts.push(short(idx[k]!));
    i = j + 1;
  }
  return parts.join(", ");
}

/** "Du–Shan · 09:00–21:00"; hech narsa kiritilmagan bo'lsa — null */
export function workHoursText(s: Pick<CenterSettings, "workDays" | "workStart" | "workEnd">): string | null {
  const days = workDaysText(s.workDays);
  const hours = s.workStart && s.workEnd ? `${s.workStart}–${s.workEnd}` : "";
  return [days, hours].filter(Boolean).join(" · ") || null;
}

/** "https://t.me/nom/" → "t.me/nom" (ekranda ko'rsatish uchun) */
export const shortLink = (href: string) =>
  href
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/+$/, "")
    .slice(0, 60);

export interface ContactLink {
  kind: "telegram" | "instagram" | "website" | "map";
  href: string;
  label: string;
}

export interface CenterContacts {
  phones: { href: string; label: string }[];
  address: string;
  links: ContactLink[];
  hours: string | null;
}

/** Ariza sahifasi va chek uchun tayyor ko'rinish; bo'sh qismlar tushib qoladi */
export function centerContacts(s: CenterSettings): CenterContacts {
  const phones = [s.phone, s.phone2]
    .filter((p) => p.length === 9)
    .map((p) => ({ href: `tel:+998${p}`, label: displayPhone(p) ?? p }));
  const links: ContactLink[] = [
    { kind: "telegram" as const, href: s.telegram },
    { kind: "instagram" as const, href: s.instagram },
    { kind: "website" as const, href: s.website },
  ]
    .filter((l) => l.href)
    .map((l) => ({ ...l, label: shortLink(l.href) }));
  if (s.mapUrl) links.push({ kind: "map", href: s.mapUrl, label: uz.settingsCenter.mapLink });
  return { phones, address: s.address, links, hours: workHoursText(s) };
}

/** Chekdagi QR kod olib boradigan manzil: sayt, bo'lmasa Telegram, bo'lmasa Instagram; yo'q bo'lsa — "" */
export const qrTarget = (s: CenterSettings) => s.website || s.telegram || s.instagram || "";
