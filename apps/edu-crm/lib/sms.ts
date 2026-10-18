import { z } from "zod";
import { uz } from "./uz";

/*
 * SMS sozlamalari qoidalari (docs/EDU-CRM-SMS.md, S1): forma ham, server amali ham shu sxemalardan foydalanadi.
 * Maxfiy kalit faqat ulashda yuboriladi va hech qachon qaytarilmaydi.
 */

const t = uz.sms;

/** Ulash: email va kabinetdagi maxfiy kalit */
export const smsConnectInput = z.object({
  email: z.email(t.emailInvalid).trim().max(200),
  secret: z.string().trim().min(1, t.secretRequired).max(500),
});
export type SmsConnectInput = z.input<typeof smsConnectInput>;

const hour = z.number().int().min(0).max(23);

/** Yuboruvchi nomi va tinch soatlar */
export const smsPrefsInput = z
  .object({
    /** "" — standart 4546 */
    sender: z.string().trim().max(20).default(""),
    quietFrom: hour,
    quietTo: hour,
  })
  .refine((v) => v.quietFrom !== v.quietTo, { message: t.quietSame, path: ["quietTo"] });
export type SmsPrefsInput = z.input<typeof smsPrefsInput>;

export const smsModeInput = z.object({ mode: z.enum(["ventura", "own"]) });

/** Test SMS: 9 ta mahalliy raqam */
export const smsTestInput = z.object({ phone: z.string().regex(/^\d{9}$/, t.phoneInvalid) });

export type SmsMode = "ventura" | "own";

/** Brauzerga boradigan holat: sirlarsiz */
export interface SmsProviderView {
  /** ventura — Ventura paketi (standart); own — markazning o'z Eskiz hisobi */
  mode: SmsMode;
  /** Joriy rejimda yuborish mumkinmi (ventura — relay sozlangan; own — Eskiz ulangan) */
  connected: boolean;
  /** O'z Eskiz hisobi ulangan (rejimdan qat'i nazar) */
  ownConnected: boolean;
  /** Ventura paketi shu serverda sozlangan (panel manzili va kaliti deploy'da yozilgan) */
  relayReady: boolean;
  /** Kalit saqlangan, lekin ochilmadi (server kaliti almashgan) — qayta ulash kerak */
  broken: boolean;
  email: string | null;
  sender: string | null;
  quietFrom: number;
  quietTo: number;
  checkedAt: string | null;
}

/** Soat — "21:00" */
export const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Hozirgi soat tinch oraliqdami (oraliq yarim tundan o'tishi mumkin: 21 → 8) */
export function inQuietHours(hourNow: number, from: number, to: number): boolean {
  return from < to ? hourNow >= from && hourNow < to : hourNow >= from || hourNow < to;
}
