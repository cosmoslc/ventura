import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { type ChainLink, type ChainPayload, canonicalJson, hashLink, verifyChain } from "./chain";
import { decrypt, encrypt } from "./crypto";

describe("AES-256-GCM", () => {
  const key = randomBytes(32);

  it("shifrlangan qiymat qayta ochiladi", () => {
    const enc = encrypt("ghp_maxfiy-token-123", key);
    expect(enc.ciphertext).not.toContain("maxfiy");
    expect(decrypt(enc, key)).toBe("ghp_maxfiy-token-123");
  });

  it("har safar boshqa iv — bir xil matn har xil shifr beradi", () => {
    expect(encrypt("parol", key).ciphertext).not.toBe(encrypt("parol", key).ciphertext);
  });

  it("o'zgartirilgan shifrni rad etadi", () => {
    const enc = encrypt("parol", key);
    const raw = Buffer.from(enc.ciphertext, "base64");
    raw[0] = (raw[0] ?? 0) ^ 0xff;
    expect(() => decrypt({ ...enc, ciphertext: raw.toString("base64") }, key)).toThrow();
  });

  it("boshqa kalit bilan ochilmaydi", () => {
    const enc = encrypt("parol", key);
    expect(() => decrypt(enc, randomBytes(32))).toThrow();
  });
});

function payload(i: number, extra: Partial<ChainPayload> = {}): ChainPayload {
  return {
    at: new Date(Date.UTC(2026, 9, 10, 12, 0, i)).toISOString(),
    actorType: "user",
    actorId: "u1",
    actorName: "Saidakbar",
    action: "project.update",
    targetType: "project",
    targetId: `p${i}`,
    ip: "127.0.0.1",
    userAgent: "test",
    metadata: { before: { name: "A" }, after: { name: `B${i}` } },
    ...extra,
  };
}

function buildChain(n: number): ChainLink[] {
  const out: ChainLink[] = [];
  let prev: string | null = null;
  for (let i = 1; i <= n; i++) {
    const p = payload(i);
    const hash = hashLink(prev, p);
    out.push({ ...p, seq: i, prevHash: prev, hash });
    prev = hash;
  }
  return out;
}

describe("audit xesh zanjiri", () => {
  it("kanonik JSON kalit tartibiga bog'liq emas", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      canonicalJson({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
    );
  });

  it("butun zanjir tasdiqlanadi", () => {
    expect(verifyChain(buildChain(25))).toEqual({ ok: true, count: 25 });
  });

  it("bo'sh zanjir — butun", () => {
    expect(verifyChain([])).toEqual({ ok: true, count: 0 });
  });

  it("yozuv mazmuni o'zgartirilsa aniqlanadi", () => {
    const chain = buildChain(10);
    chain[4] = { ...chain[4]!, metadata: { after: { name: "soxta" } } };
    const v = verifyChain(chain);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.brokenAtSeq).toBe(5);
  });

  it("o'rtadagi yozuv o'chirilsa aniqlanadi", () => {
    const chain = buildChain(10);
    chain.splice(6, 1);
    const v = verifyChain(chain);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.brokenAtSeq).toBe(8);
  });

  it("xesh qayta hisoblangan soxta yozuv keyingi bo'g'inni buzadi", () => {
    const chain = buildChain(10);
    const forged = payload(3, { action: "project.delete" });
    chain[2] = { ...forged, seq: 3, prevHash: chain[1]!.hash, hash: hashLink(chain[1]!.hash, forged) };
    const v = verifyChain(chain);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.brokenAtSeq).toBe(4);
  });
});
