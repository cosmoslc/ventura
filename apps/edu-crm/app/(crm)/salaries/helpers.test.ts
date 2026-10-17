import { describe, expect, it } from "vitest";
import { personHref, remainingState, signedAmount, sumBalances } from "./helpers";

const all = { teacher: true, staff: true };

describe("personHref", () => {
  it("o'qituvchi va xodim profiliga olib boradi", () => {
    expect(personHref("teacher:abc", all)).toBe("/teachers/abc");
    expect(personHref("user:xyz", all)).toBe("/staff/xyz");
  });
  it("oy berilsa o'qituvchi profili shu oy bilan ochiladi", () => {
    expect(personHref("teacher:abc", all, "2026-09")).toBe("/teachers/abc?oy=2026-09");
    expect(personHref("user:xyz", all, "2026-09")).toBe("/staff/xyz");
  });
  it("ruxsat yo'q yoki qiymat noto'g'ri bo'lsa havola yo'q", () => {
    expect(personHref("teacher:abc", { teacher: false, staff: true })).toBeNull();
    expect(personHref("user:xyz", { teacher: true, staff: false })).toBeNull();
    expect(personHref("boshqa:1", all)).toBeNull();
    expect(personHref("teacher", all)).toBeNull();
  });
});

describe("remainingState", () => {
  it("qarz, ortiqcha va yopilgan", () => {
    expect(remainingState(100)).toBe("due");
    expect(remainingState(-1)).toBe("over");
    expect(remainingState(0)).toBe("settled");
  });
});

describe("signedAmount", () => {
  const f = (v: number) => String(v);
  it("belgi bilan, nol — null", () => {
    expect(signedAmount(50, f)).toBe("+50");
    expect(signedAmount(-20, f)).toBe("−20");
    expect(signedAmount(0, f)).toBeNull();
  });
});

describe("sumBalances", () => {
  it("ustunlar bo'yicha jamlaydi, bonus va jarima farqi bilan", () => {
    const rows = [
      { accrued: 1000, bonus: 100, penalty: 0, advance: 200, paid: 500, remaining: 600 },
      { accrued: 500, bonus: 0, penalty: 50, advance: 0, paid: 700, remaining: -250 },
    ];
    expect(sumBalances(rows)).toEqual({ accrued: 1500, adjust: 50, advance: 200, paid: 1200, remaining: 350 });
  });
  it("bo'sh ro'yxat — nollar", () => {
    expect(sumBalances([])).toEqual({ accrued: 0, adjust: 0, advance: 0, paid: 0, remaining: 0 });
  });
});
