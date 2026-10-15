import { describe, expect, it } from "vitest";
import {
  DEFAULT_CENTER,
  centerContacts,
  centerInput,
  normalizeSocial,
  normalizeUrl,
  parseCenter,
  qrTarget,
  workDaysText,
  workHoursText,
} from "./center-settings";

describe("markaz sozlamasi", () => {
  it("yo'q yoki buzilgan bo'lsa — bo'sh sozlama", () => {
    expect(parseCenter(undefined)).toEqual(DEFAULT_CENTER);
    expect(parseCenter({ phone: "12" })).toEqual(DEFAULT_CENTER);
    expect(parseCenter({ address: " Chilonzor " })).toMatchObject({ address: "Chilonzor" });
  });

  it("havolalar to'liq ko'rinishga keltiriladi", () => {
    expect(normalizeUrl("markaz.uz")).toBe("https://markaz.uz");
    expect(normalizeUrl("http://markaz.uz")).toBe("http://markaz.uz");
    expect(normalizeUrl("  ")).toBe("");
    expect(normalizeSocial("telegram", "@markaz")).toBe("https://t.me/markaz");
    expect(normalizeSocial("telegram", "t.me/markaz")).toBe("https://t.me/markaz");
    expect(normalizeSocial("instagram", "@markaz.uz")).toBe("https://instagram.com/markaz.uz");
    expect(normalizeSocial("instagram", "https://www.instagram.com/markaz/")).toBe("https://www.instagram.com/markaz/");
  });

  it("forma kirishi: noto'g'ri havola, telefon va vaqt rad etiladi", () => {
    const ok = centerInput.safeParse({ website: "markaz.uz", telegram: "@markaz", workDays: ["sat", "mon"] });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.website).toBe("https://markaz.uz");
      expect(ok.data.workDays).toEqual(["mon", "sat"]);
    }
    expect(centerInput.safeParse({ website: "salom dunyo" }).success).toBe(false);
    expect(centerInput.safeParse({ website: "javascript:alert(1)" }).success).toBe(false);
    expect(centerInput.safeParse({ phone: "9012" }).success).toBe(false);
    expect(centerInput.safeParse({ workStart: "25:00", workEnd: "26:00" }).success).toBe(false);
    expect(centerInput.safeParse({ workStart: "09:00" }).success).toBe(false);
    expect(centerInput.safeParse({ workStart: "21:00", workEnd: "09:00" }).success).toBe(false);
    expect(centerInput.safeParse({ workStart: "09:00", workEnd: "21:00" }).success).toBe(true);
    expect(centerInput.safeParse({ qo: "ha" }).success).toBe(false);
  });

  it("ish kunlari qisqa yoziladi", () => {
    expect(workDaysText(["mon", "tue", "wed", "thu", "fri", "sat"])).toBe("Du–Shan");
    expect(workDaysText(["mon", "wed", "fri"])).toBe("Du, Chor, Jum");
    expect(workDaysText(["mon", "tue"])).toBe("Du, Se");
    expect(workDaysText(["mon", "tue", "wed", "fri", "sat", "sun"])).toBe("Du–Chor, Jum–Yak");
    expect(workDaysText([])).toBe("");
    expect(workHoursText({ workDays: ["mon", "tue", "wed"], workStart: "09:00", workEnd: "18:00" })).toBe(
      "Du–Chor · 09:00–18:00",
    );
    expect(workHoursText({ workDays: [], workStart: "", workEnd: "" })).toBeNull();
  });

  it("aloqa ko'rinishi: bo'sh qismlar tushadi", () => {
    expect(centerContacts(DEFAULT_CENTER)).toEqual({ phones: [], address: "", links: [], hours: null });
    const c = centerContacts(
      parseCenter({ phone: "901234567", phone2: "", telegram: "https://t.me/markaz", mapUrl: "https://maps.app/x.y" }),
    );
    expect(c.phones).toEqual([{ href: "tel:+998901234567", label: "+998 90 123 45 67" }]);
    expect(c.links.map((l) => l.kind)).toEqual(["telegram", "map"]);
    expect(c.links[0]!.label).toBe("t.me/markaz");
  });

  it("QR manzili: sayt, keyin Telegram, keyin Instagram", () => {
    expect(qrTarget(DEFAULT_CENTER)).toBe("");
    expect(qrTarget(parseCenter({ instagram: "https://instagram.com/a" }))).toBe("https://instagram.com/a");
    expect(qrTarget(parseCenter({ telegram: "https://t.me/abc", instagram: "https://instagram.com/a" }))).toBe(
      "https://t.me/abc",
    );
    expect(qrTarget(parseCenter({ website: "https://m.uz", telegram: "https://t.me/abc" }))).toBe("https://m.uz");
  });
});
