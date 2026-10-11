import { describe, expect, it } from "vitest";
import { fingerprint, generateKeyPair, sh } from "./ssh";

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
  it("kalit izi SHA256 ko'rinishida", () => {
    expect(fingerprint(Buffer.from("abc"))).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
  });
});
