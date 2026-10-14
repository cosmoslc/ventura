import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Ariza formasining vaqt belgisi (ADR 0026): sahifa ochilganda server vaqtni mijoz siri bilan imzolaydi, forma uni
 * qaytaradi. Imzo to'g'ri bo'lsa, forma qachon ochilgani aniq: juda tez yuborilgan (bot) arizalar ajratiladi, belgini
 * qo'lda yasab bo'lmaydi. Faqat server kodida ishlatiladi (sir brauzerga chiqmaydi).
 */

/** Forma ochilgandan keyin kamida shuncha vaqt o'tishi kerak */
export const MIN_FILL_MS = 3_000;
/** Belgi shuncha vaqt amal qiladi (sayt sahifasi uzoq ochiq turishi mumkin) */
export const STAMP_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

const sign = (secret: string, scope: string, ts: number) =>
  createHmac("sha256", secret).update(`apply:${scope}:${ts}`).digest("base64url");

export function makeStamp(secret: string, scope: string, now = Date.now()): string {
  return `${now}.${sign(secret, scope, now)}`;
}

export type StampCheck = "ok" | "fast" | "invalid";

export function checkStamp(secret: string, scope: string, stamp: string, now = Date.now()): StampCheck {
  const [tsRaw, sig] = stamp.split(".");
  const ts = Number(tsRaw);
  if (!sig || !Number.isSafeInteger(ts)) return "invalid";
  const expected = Buffer.from(sign(secret, scope, ts));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  if (now - ts > STAMP_TTL_MS || ts - now > 60_000) return "invalid";
  return now - ts < MIN_FILL_MS ? "fast" : "ok";
}
