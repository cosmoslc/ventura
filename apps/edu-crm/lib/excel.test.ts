import { describe, expect, it } from "vitest";
import {
  detectColumns,
  parseDate,
  parseDays,
  parseGender,
  parseMoney,
  parsePhone,
  parseSalary,
  parseTimeRange,
} from "./excel";

describe("parsePhone", () => {
  it("turli yozuvlarni 9 raqamga keltiradi", () => {
    expect(parsePhone("+998 90 123-45-67")).toBe("901234567");
    expect(parsePhone("998901234567")).toBe("901234567");
    expect(parsePhone("0901234567")).toBe("901234567");
    expect(parsePhone("90 123 45 67")).toBe("901234567");
  });
  it("noto'g'ri raqamni rad etadi (eski tizim 7 belgini ham qabul qilar edi)", () => {
    expect(parsePhone("1234567")).toBeNull();
    expect(parsePhone("+7 999 123 45 67")).toBeNull();
    expect(parsePhone("")).toBeNull();
  });
});

describe("parseDate", () => {
  it("formatlar va Excel seriya raqami", () => {
    expect(parseDate("2026-10-12")).toBe("2026-10-12");
    expect(parseDate("12.10.2026")).toBe("2026-10-12");
    expect(parseDate("5/3/2010")).toBe("2010-03-05");
    expect(parseDate("46307")).toBe("2026-10-12");
  });
  it("mavjud bo'lmagan sanani rad etadi", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("ertaga")).toBeNull();
  });
});

describe("parseMoney", () => {
  it("kasr ajratkichi raqamga qo'shilmaydi (eski tizim 390000.50 ni 39000050 qilar edi)", () => {
    expect(parseMoney("390 000")).toBe(390000);
    expect(parseMoney("390,000")).toBe(390000);
    expect(parseMoney("390000.50")).toBe(390000);
    expect(parseMoney("1 200 000 so'm")).toBe(1200000);
    expect(parseMoney("")).toBeNull();
  });
});

describe("parseDays va parseTimeRange", () => {
  it("kunlar", () => {
    expect(parseDays("Du, Chor, Jum")).toEqual(["mon", "wed", "fri"]);
    expect(parseDays("Juft")).toEqual(["tue", "thu", "sat"]);
    expect(parseDays("Shanba / Yakshanba")).toEqual(["sat", "sun"]);
    expect(parseDays("har kuni")).toBeNull();
  });
  it("vaqt", () => {
    expect(parseTimeRange("14:00 - 16:00")).toEqual({ start: "14:00", end: "16:00" });
    expect(parseTimeRange("9.30")).toEqual({ start: "09:30", end: "11:00" });
    expect(parseTimeRange("16:00 - 14:00")).toBeNull();
  });
});

describe("parseSalary", () => {
  it("tur va qiymat", () => {
    expect(parseSalary("40")).toEqual({ type: "percent", value: 40 });
    expect(parseSalary("40%")).toEqual({ type: "percent", value: 40 });
    expect(parseSalary("3 000 000 [Fiks]")).toEqual({ type: "fixed", value: 3000000 });
    expect(parseSalary("50 000 [O'quvchi]")).toEqual({ type: "per_student", value: 50000 });
    expect(parseSalary("140")).toBeNull();
  });
});

describe("detectColumns", () => {
  it("o'quvchi eksport sarlavhalari qayta importda to'g'ri tushadi", () => {
    expect(
      detectColumns("students", ["F.I.SH", "Telefon", "Ota-ona telefoni", "Guruhlar", "Holati", "Qo'shilgan vaqti"]),
    ).toEqual(["name", "phone", "parentPhone", "group", "", "joinedAt"]);
  });
  it("guruh eksport sarlavhalari", () => {
    expect(
      detectColumns("groups", [
        "Guruh nomi",
        "Kurs nomi",
        "O'qituvchi",
        "Dars kunlari",
        "Xona",
        "Dars vaqti",
        "Boshlanish sanasi",
        "Oylik to'lov",
      ]),
    ).toEqual(["name", "course", "teacher", "days", "room", "time", "startDate", "price"]);
  });
  it("o'qituvchi eksport sarlavhalari", () => {
    expect(
      detectColumns("teachers", ["O'qituvchi F.I.SH", "Telefon raqami", "Filial", "Tug'ilgan sana", "Maosh", "Izoh"]),
    ).toEqual(["name", "phone", "", "birthDate", "salary", "note"]);
  });
});

describe("lidlar (E4c)", () => {
  it("lid eksport sarlavhalari qayta importda to'g'ri tushadi, qolganlari o'tkaziladi", () => {
    expect(
      detectColumns("leads", [
        "Ism familiya",
        "Telefon",
        "Qo'shimcha telefon",
        "Jinsi",
        "Manba",
        "Kurs",
        "Keyingi aloqa",
        "Izoh",
        "Bosqich",
        "Mas'ul",
        "Qo'shilgan",
      ]),
    ).toEqual(["name", "phone", "phone2", "gender", "source", "course", "targetDate", "note", "", "", ""]);
  });
  it("jins yozuvlari", () => {
    expect(parseGender("Erkak")).toBe("male");
    expect(parseGender("qiz")).toBe("female");
    expect(parseGender("F")).toBe("female");
    expect(parseGender("noma'lum")).toBeNull();
  });
});
