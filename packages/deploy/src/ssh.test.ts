import { describe, expect, it } from "vitest";
import ssh2 from "ssh2";
import { fingerprint, generateKeyPair, sh } from "./ssh";

const { utils } = ssh2;

describe("sh — buyruq argumentini qo'shtirnoqlash", () => {
  it("oddiy qiymatlarga tegmaydi", () => {
    expect(sh("bilim")).toBe("bilim");
    expect(sh("/home/deploy/apps/bilim/releases/20261011-1")).toBe("/home/deploy/apps/bilim/releases/20261011-1");
    expect(sh(4100)).toBe("4100");
  });
  it("bo'sh joy va maxsus belgilarni bitta argument qilib o'raydi", () => {
    expect(sh("a b")).toBe("'a b'");
    expect(sh("x; rm -rf /")).toBe("'x; rm -rf /'");
    expect(sh("$(whoami)")).toBe("'$(whoami)'");
    expect(sh("`id`")).toBe("'`id`'");
    expect(sh("")).toBe("''");
  });
  it("ichidagi bittalik qo'shtirnoqdan chiqib ketib bo'lmaydi", () => {
    // Har ichki ' belgisi: yopish, ekranlangan ', qayta ochish
    const escapedQuote = String.fromCharCode(92) + "'";
    expect(sh("a'; id; '")).toBe(["'a'", "'; id; '", "''"].join(escapedQuote));
  });
});

describe("kalit jufti", () => {
  it("ed25519, OpenSSH formatida; har safar yangi", () => {
    const a = generateKeyPair("ventura-panel:test");
    const b = generateKeyPair("ventura-panel:test");
    expect(a.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+ ventura-panel:test$/);
    expect(a.privateKey).toContain("BEGIN OPENSSH PRIVATE KEY");
    expect(a.publicKey).not.toBe(b.publicKey);
  });
  it("har bir kalit ssh2 tomonidan o'qiladi va ochiq qismi bilan mos (ilgari ~256 tadan biri buzuq edi)", () => {
    let leadingZero = 0;
    for (let i = 0; i < 3000; i++) {
      const { privateKey, publicKey } = generateKeyPair(`ventura-panel:srv-${i}`);
      const parsed = utils.parseKey(privateKey);
      if (parsed instanceof Error || Array.isArray(parsed)) throw new Error(`kalit ${i}: ${String(parsed)}`);
      expect(parsed.type).toBe("ssh-ed25519");
      const blob = Buffer.from(publicKey.split(" ")[1]!, "base64");
      expect(parsed.getPublicSSH().equals(blob)).toBe(true);
      // Ochiq kalit har doim 32 bayt (oxirgi 32 bayt bloki), birinchi bayti 0 bo'lsa ham
      expect(blob.readUInt32BE(15)).toBe(32);
      if (blob[19] === 0) leadingZero++;
    }
    // 3000 ta ichida birinchi bayti 0 bo'lganlar deyarli doim bo'ladi (aynan ilgari buzilgan holat)
    expect(leadingZero).toBeGreaterThan(0);
  });
  it("kalit bilan imzo qo'yiladi va ochiq kalit bilan tekshiriladi", () => {
    const { privateKey, publicKey } = generateKeyPair("ventura-panel:sign");
    const key = utils.parseKey(privateKey);
    if (key instanceof Error || Array.isArray(key)) throw key;
    const data = Buffer.from("ventura");
    const pub = utils.parseKey(publicKey);
    if (pub instanceof Error || Array.isArray(pub)) throw pub;
    expect(pub.verify(data, key.sign(data))).toBe(true);
  });
  it("kalit izi SHA256 ko'rinishida", () => {
    expect(fingerprint(Buffer.from("abc"))).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
  });
});
