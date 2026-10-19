import { describe, expect, it } from "vitest";
import {
  DEFAULT_COINS,
  attendanceEarns,
  attendanceKey,
  coinMeta,
  coinSettingsInput,
  homeworkKey,
  parseCoinSettings,
  prepayKey,
  prepayQualifies,
} from "./coins";

const prices = [{ fromMonth: "0000-01", price: 300_000 }];
const base = { month: "2026-11", groupId: "g1", prices, discounts: [] };

describe("coin sozlamasi", () => {
  it("standart — hamma qoida o'chiq", () => {
    expect(DEFAULT_COINS.prepay.enabled).toBe(false);
    expect(DEFAULT_COINS.attendance.enabled).toBe(false);
    expect(DEFAULT_COINS.homework.enabled).toBe(false);
    expect(parseCoinSettings(null)).toEqual(DEFAULT_COINS);
  });

  it("buzilgan qiymat — standart; qisman qiymat to'ldiriladi", () => {
    expect(parseCoinSettings({ prepay: { enabled: "ha" } })).toEqual(DEFAULT_COINS);
    expect(parseCoinSettings({ attendance: { enabled: true, amount: 3 } }).attendance).toEqual({
      enabled: true,
      amount: 3,
    });
  });

  it("forma: noma'lum kalit va chegaradan tashqari miqdor rad etiladi", () => {
    expect(coinSettingsInput.safeParse({ ...DEFAULT_COINS, bonus: 1 }).success).toBe(false);
    expect(coinSettingsInput.safeParse({ ...DEFAULT_COINS, prepay: { enabled: true, amount: 0 } }).success).toBe(false);
    expect(coinSettingsInput.safeParse({ ...DEFAULT_COINS, prepay: { enabled: true, amount: 1.5 } }).success).toBe(
      false,
    );
    expect(coinSettingsInput.safeParse({ ...DEFAULT_COINS, prepay: { enabled: true, amount: 1001 } }).success).toBe(
      false,
    );
  });
});

describe("sabab kalitlari va davomat", () => {
  it("kalitlar guruh va sana/oy bo'yicha", () => {
    expect(prepayKey("g1", "2026-11")).toBe("prepay:g1:2026-11");
    expect(attendanceKey("g1", "2026-11-02")).toBe("att:g1:2026-11-02");
    expect(homeworkKey("g1", "2026-11-02")).toBe("hw:g1:2026-11-02");
  });

  it("faqat Bor va eski Kech coin beradi", () => {
    expect(attendanceEarns("present")).toBe(true);
    expect(attendanceEarns("late")).toBe(true);
    expect(attendanceEarns("excused")).toBe(false);
    expect(attendanceEarns("absent")).toBe(false);
    expect(attendanceEarns(null)).toBe(false);
  });
});

describe("oldindan to'lov", () => {
  it("oy boshlanishidan oldin to'liq narx — ha; 1-kuni yoki keyin — yo'q", () => {
    expect(prepayQualifies({ ...base, entries: [{ kind: "payment", amount: 300_000, date: "2026-10-31" }] })).toBe(
      true,
    );
    expect(prepayQualifies({ ...base, entries: [{ kind: "payment", amount: 300_000, date: "2026-11-01" }] })).toBe(
      false,
    );
  });

  it("qisman to'lov yetmaydi; bir necha to'lov va bir martalik chegirma qo'shiladi", () => {
    expect(prepayQualifies({ ...base, entries: [{ kind: "payment", amount: 299_999, date: "2026-10-20" }] })).toBe(
      false,
    );
    expect(
      prepayQualifies({
        ...base,
        entries: [
          { kind: "payment", amount: 200_000, date: "2026-10-10" },
          { kind: "payment", amount: 50_000, date: "2026-10-25" },
          { kind: "discount", amount: 50_000, date: "2026-10-25" },
        ],
      }),
    ).toBe(true);
  });

  it("oy ichidagi to'lov oldingi to'lovga qo'shilmaydi; qaytarish va tuzatish hisobga olinmaydi", () => {
    expect(
      prepayQualifies({
        ...base,
        entries: [
          { kind: "payment", amount: 200_000, date: "2026-10-10" },
          { kind: "payment", amount: 100_000, date: "2026-11-03" },
          { kind: "correction", amount: 100_000, date: "2026-10-10" },
        ],
      }),
    ).toBe(false);
  });

  it("doimiy chegirma narxni kamaytiradi; narx tarixi oy bo'yicha", () => {
    const discounts = [
      {
        id: "d1",
        groupId: null,
        kind: "percent" as const,
        value: 50,
        fromMonth: "2026-01",
        toMonth: null,
        affectsTeacher: true,
      },
    ];
    expect(
      prepayQualifies({ ...base, discounts, entries: [{ kind: "payment", amount: 150_000, date: "2026-10-30" }] }),
    ).toBe(true);
    const stepped = [
      { fromMonth: "0000-01", price: 300_000 },
      { fromMonth: "2026-11", price: 400_000 },
    ];
    expect(
      prepayQualifies({
        ...base,
        prices: stepped,
        entries: [{ kind: "payment", amount: 300_000, date: "2026-10-30" }],
      }),
    ).toBe(false);
  });

  it("bepul (narxi 0) — coin yo'q", () => {
    expect(
      prepayQualifies({
        ...base,
        prices: [{ fromMonth: "0000-01", price: 0 }],
        entries: [{ kind: "payment", amount: 1, date: "2026-10-01" }],
      }),
    ).toBe(false);
  });
});

describe("audit qismi", () => {
  it("o'zgarishsiz — bo'sh, bor bo'lsa ro'yxat", () => {
    expect(coinMeta([null, null])).toEqual({});
    expect(coinMeta([{ rule: "attendance", action: "award", amount: 1 }, null])).toEqual({
      coins: [{ rule: "attendance", action: "award", amount: 1 }],
    });
  });
});
