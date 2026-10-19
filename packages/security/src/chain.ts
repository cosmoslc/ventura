import { createHash } from "node:crypto";

/*
 * Audit xesh zanjiri (SPEC 10-bo'lim): har yozuv oldingisining xeshini saqlaydi.
 * hash = sha256(prevHash + "\n" + kanonik JSON). Bazaga qo'lda aralashilsa zanjir buziladi.
 */

export interface ChainPayload {
  at: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

export interface ChainLink extends ChainPayload {
  seq: number;
  prevHash: string | null;
  hash: string;
}

/** Kalitlari tartiblangan, bo'shliqsiz JSON — bir xil ma'lumot doim bir xil satr beradi. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function hashLink(prevHash: string | null, payload: ChainPayload): string {
  return createHash("sha256")
    .update(`${prevHash ?? ""}\n${canonicalJson(payload)}`)
    .digest("hex");
}

export type ChainVerdict =
  { ok: true; count: number } | { ok: false; count: number; brokenAtSeq: number; reason: string };

export type SegmentVerdict = { ok: true; lastHash: string | null } | { ok: false; brokenAtSeq: number; reason: string };

/**
 * Zanjir bo'lagi: yozuvlar seq bo'yicha o'sish tartibida, `prevHash` — bo'lakdan oldingi yozuv xeshi (boshida null).
 * Bo'laklab tekshirish (audit.verify) va butun zanjir (verifyChain) shu bitta qoidadan foydalanadi.
 */
export function verifySegment(links: readonly ChainLink[], prevHash: string | null): SegmentVerdict {
  let prev = prevHash;
  for (const link of links) {
    if (link.prevHash !== prev)
      return { ok: false, brokenAtSeq: link.seq, reason: "prev_hash oldingi yozuv xeshiga mos emas" };
    const { seq: _seq, prevHash: _p, hash, ...payload } = link;
    if (hashLink(prev, payload) !== hash)
      return { ok: false, brokenAtSeq: link.seq, reason: "yozuv mazmuni o'zgartirilgan" };
    prev = hash;
  }
  return { ok: true, lastHash: prev };
}

/** Yozuvlar seq bo'yicha o'sish tartibida beriladi. */
export function verifyChain(links: ChainLink[]): ChainVerdict {
  const v = verifySegment(links, null);
  return v.ok
    ? { ok: true, count: links.length }
    : { ok: false, count: links.length, brokenAtSeq: v.brokenAtSeq, reason: v.reason };
}
