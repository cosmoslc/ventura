import { describe, expect, it } from "vitest";
import {
  accessState,
  can,
  isSessionExpired,
  normalizeUzPhone,
  passwordProblem,
  shouldLock,
  secureCookies,
  trustedOrigins,
} from "./policy";
import { readPending, signPending } from "./service";

describe("cookie xavfsizligi", () => {
  it("https manzilda Secure, http manzilda (mahalliy tarmoq, localhost) yo'q", () => {
    expect(secureCookies("https://admin.ventura.uz")).toBe(true);
    expect(secureCookies("http://localhost:3000")).toBe(false);
    expect(secureCookies("http://192.168.1.10:3000")).toBe(false);
    expect(secureCookies(undefined)).toBe(false);
  });
});

describe("ishonchli manzillar", () => {
  it("vergul bilan, oxirgi / siz; noto'g'ri qiymatlar tashlanadi", () => {
    expect(trustedOrigins(" https://admin.ventura.uz/ , http://localhost:3000 ")).toEqual([
      "https://admin.ventura.uz",
      "http://localhost:3000",
    ]);
    expect(trustedOrigins("*, javascript:alert(1), https://a.uz/path")).toEqual([]);
    expect(trustedOrigins(undefined)).toEqual([]);
  });
});

describe("telefon", () => {
  it("turli yozuvlarni +998XXXXXXXXX ga keltiradi", () => {
    expect(normalizeUzPhone("+998 90 123 45 67")).toBe("+998901234567");
    expect(normalizeUzPhone("90-123-45-67")).toBe("+998901234567");
    expect(normalizeUzPhone("998901234567")).toBe("+998901234567");
  });
  it("noto'g'ri raqamni rad etadi", () => {
    expect(normalizeUzPhone("12345")).toBeNull();
    expect(normalizeUzPhone("+7 912 345 67 89")).toBeNull();
  });
});

describe("parol", () => {
  it("kamida 8 belgi", () => {
    expect(passwordProblem("1234567")).not.toBeNull();
    expect(passwordProblem("12345678")).toBeNull();
  });
});

describe("sessiya muddati", () => {
  const login = new Date("2026-10-10T10:00:00Z");
  const after = (ms: number) => new Date(login.getTime() + ms);
  it("1 daqiqa", () => {
    expect(isSessionExpired(login, "1m", after(59_000))).toBe(false);
    expect(isSessionExpired(login, "1m", after(60_000))).toBe(true);
  });
  it("3 soat va 1 hafta", () => {
    expect(isSessionExpired(login, "3h", after(3 * 3_600_000 - 1))).toBe(false);
    expect(isSessionExpired(login, "7d", after(8 * 24 * 3_600_000))).toBe(true);
  });
  it("brauzer yopilguncha — server tomonida ham 1 kun bilan cheklangan", () => {
    expect(isSessionExpired(login, "browser", after(23 * 3_600_000))).toBe(false);
    expect(isSessionExpired(login, "browser", after(25 * 3_600_000))).toBe(true);
  });
});

describe("kirish holati (2FA'siz panelga kirib bo'lmaydi)", () => {
  const ok = { lockedAt: null, mustChangePassword: false, twoFactorEnabled: true, telegramChatId: "1" };
  it("hammasi joyida", () => expect(accessState(ok)).toBe("ok"));
  it("Telegram ulanmagan — panel yopiq", () => {
    expect(accessState({ ...ok, twoFactorEnabled: false })).toBe("needs_telegram");
    expect(accessState({ ...ok, telegramChatId: null })).toBe("needs_telegram");
  });
  it("bloklash hammasidan ustun", () =>
    expect(accessState({ ...ok, lockedAt: new Date(), mustChangePassword: true })).toBe("locked"));
  it("vaqtinchalik parol", () => expect(accessState({ ...ok, mustChangePassword: true })).toBe("must_change_password"));
  it("5 xatodan keyin bloklanadi", () => {
    expect(shouldLock(4)).toBe(false);
    expect(shouldLock(5)).toBe(true);
  });
});

describe("rollar", () => {
  it("kuzatuvchi faqat ko'radi, admin adminlarni boshqara olmaydi", () => {
    expect(can("viewer", "view")).toBe(true);
    expect(can("viewer", "projects.write")).toBe(false);
    expect(can("admin", "projects.write")).toBe(true);
    expect(can("admin", "admins.manage")).toBe(false);
    expect(can("super_admin", "settings.manage")).toBe(true);
  });

  it("serverni faqat super admin qo'shadi va o'chiradi, admin ilovani qayta yuklay oladi", () => {
    expect(can("super_admin", "servers.manage")).toBe(true);
    expect(can("admin", "servers.manage")).toBe(false);
    expect(can("admin", "projects.deploy")).toBe(true);
    expect(can("viewer", "servers.manage")).toBe(false);
  });
});

describe("2FA bosqichidagi imzolangan token", () => {
  const secret = "test-secret";
  it("to'g'ri token o'qiladi", () => expect(readPending(signPending("u1", secret), secret)).toBe("u1"));
  it("soxta imzo va muddati o'tgan token rad etiladi", () => {
    const t = signPending("u1", secret);
    expect(readPending(t.replace("u1", "u2"), secret)).toBeNull();
    expect(readPending(signPending("u1", secret, -1), secret)).toBeNull();
    expect(readPending(t, "boshqa-secret")).toBeNull();
  });
});
