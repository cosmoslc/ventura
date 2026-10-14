import { describe, expect, it } from "vitest";
import { DEFAULT_APPLY_FORM, WindowLimiter, iframeCode, parseApplyForm, plausiblePhone } from "./apply-form";
import { MIN_FILL_MS, STAMP_TTL_MS, checkStamp, makeStamp } from "./apply-stamp";

describe("ariza sozlamasi", () => {
  it("yo'q yoki buzilgan bo'lsa — standart, o'chirilgan", () => {
    expect(parseApplyForm(undefined)).toEqual(DEFAULT_APPLY_FORM);
    expect(parseApplyForm({ enabled: "ha" })).toEqual(DEFAULT_APPLY_FORM);
    expect(DEFAULT_APPLY_FORM.enabled).toBe(false);
    expect(parseApplyForm({ enabled: true, title: " Kurslar " })).toMatchObject({ enabled: true, title: "Kurslar" });
  });

  it("iframe kodida sarlavhadagi HTML belgilari yo'q", () => {
    const code = iframeCode("https://a.uz/ariza", 'Kurs"><script>');
    expect(code).toContain('src="https://a.uz/ariza?embed=1"');
    expect(code).not.toContain("<script>");
  });
});

describe("telefon", () => {
  it("ochiq-oydin soxta raqamlarni rad etadi", () => {
    expect(plausiblePhone("901234567")).toBe(true);
    expect(plausiblePhone("712001122")).toBe(true);
    expect(plausiblePhone("999999999")).toBe(false);
    expect(plausiblePhone("900000000")).toBe(false);
    expect(plausiblePhone("123456789")).toBe(false);
    expect(plausiblePhone("90123456")).toBe(false);
  });
});

describe("WindowLimiter", () => {
  it("oyna ichida chegaradan oshirmaydi, oyna o'tgach yana ruxsat beradi", () => {
    const l = new WindowLimiter(3, 1_000);
    expect([l.take("ip", 0), l.take("ip", 10), l.take("ip", 20)]).toEqual([true, true, true]);
    expect(l.take("ip", 30)).toBe(false);
    // Boshqa kalit — alohida hisob
    expect(l.take("boshqa", 30)).toBe(true);
    expect(l.take("ip", 1_001)).toBe(true);
  });

  it("rad etilgan urinish hisobga qo'shilmaydi", () => {
    const l = new WindowLimiter(1, 1_000);
    expect(l.take("ip", 0)).toBe(true);
    for (let i = 1; i < 50; i++) expect(l.take("ip", i * 10)).toBe(false);
    expect(l.take("ip", 1_001)).toBe(true);
  });
});

describe("vaqt belgisi", () => {
  const secret = "s".repeat(32);

  it("to'g'ri belgi, juda tez yuborish va eskirgan belgi", () => {
    const stamp = makeStamp(secret, "alfa", 1_000_000);
    expect(checkStamp(secret, "alfa", stamp, 1_000_000 + MIN_FILL_MS)).toBe("ok");
    expect(checkStamp(secret, "alfa", stamp, 1_000_000 + 500)).toBe("fast");
    expect(checkStamp(secret, "alfa", stamp, 1_000_000 + STAMP_TTL_MS + 1)).toBe("invalid");
  });

  it("boshqa markaz, boshqa sir yoki o'zgartirilgan vaqt — yaroqsiz", () => {
    const stamp = makeStamp(secret, "alfa", 1_000_000);
    const now = 1_000_000 + 10_000;
    expect(checkStamp(secret, "beta", stamp, now)).toBe("invalid");
    expect(checkStamp("x".repeat(32), "alfa", stamp, now)).toBe("invalid");
    expect(checkStamp(secret, "alfa", stamp.replace("1000000", "990000"), now)).toBe("invalid");
    expect(checkStamp(secret, "alfa", "garbage", now)).toBe("invalid");
  });
});
