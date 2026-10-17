import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAD_STAGES,
  DEFAULT_LOST_REASONS,
  daysIn,
  firstLessonDays,
  isFirstLessonDay,
  parseLostReasons,
  stagesError,
} from "./leads";

describe("lid bosqichlari", () => {
  it("standart ro'yxat to'g'ri", () => {
    expect(stagesError(DEFAULT_LEAD_STAGES)).toBeNull();
  });

  it("yangi mijozga: 4 ochiq bosqich, keyin tizim bosqichlari (Guruhga qo'shildi = won)", () => {
    expect(DEFAULT_LEAD_STAGES.map((s) => [s.name, s.kind])).toEqual([
      ["Yangi", "open"],
      ["Ma'lumot berildi", "open"],
      ["Sinov darsida", "open"],
      ["Sinovda qatnashdi", "open"],
      ["Guruhga qo'shildi", "won"],
      ["Yo'qotildi", "lost"],
    ]);
  });

  it("bo'sh va takroriy nom, ochiq bosqichsiz, tizim bosqichisiz ro'yxat rad etiladi", () => {
    const won = { name: "O'quvchi", color: "#10b981", kind: "won" as const };
    const lost = { name: "Yo'qotildi", color: "#ef4444", kind: "lost" as const };
    const open = (name: string) => ({ name, color: "#3b82f6", kind: "open" as const });
    expect(stagesError([open(" "), won, lost])).toBe("name");
    expect(stagesError([open("Yangi"), open("yangi "), won, lost])).toBe("duplicate");
    expect(stagesError([won, lost])).toBe("open");
    expect(stagesError([open("Yangi"), lost])).toBe("system");
    expect(stagesError([open("Yangi"), won, { ...won, name: "Bitirdi" }, lost])).toBe("system");
  });

  it("bosqichda turgan kunlar Toshkent vaqti bo'yicha", () => {
    // 2026-10-12 20:00 UTC = 13-oktabr Toshkentda
    expect(daysIn("2026-10-12T20:00:00Z", "2026-10-13")).toBe(0);
    expect(daysIn("2026-10-10T05:00:00Z", "2026-10-13")).toBe(3);
  });
});

describe("yo'qotish sabablari", () => {
  it("takror, bo'sh va uzun qiymatlar tashlanadi; bo'sh ro'yxat — standart", () => {
    expect(parseLostReasons(["Qimmat", " Qimmat ", "", 5, "x".repeat(81), "Uzoq"])).toEqual(["Qimmat", "Uzoq"]);
    expect(parseLostReasons([])).toEqual(DEFAULT_LOST_REASONS);
    expect(parseLostReasons("buzuq")).toEqual(DEFAULT_LOST_REASONS);
  });
});

describe("birinchi dars kunlari", () => {
  // 2026-10-12 — dushanba
  const group = { days: ["mon", "wed"], startDate: "2026-09-01", branchId: "b1" };
  const holiday = { startDate: "2026-10-14", endDate: "2026-10-14", branchIds: null, affectsLessons: true };

  it("bugundan 3 hafta: faqat jadvaldagi kunlar, bugun ham kiradi, bayram tushadi", () => {
    expect(firstLessonDays(group, "2026-10-12", [holiday])).toEqual([
      "2026-10-12",
      "2026-10-19",
      "2026-10-21",
      "2026-10-26",
      "2026-10-28",
    ]);
  });

  it("hali boshlanmagan guruh: birinchi dars kunidan boshlanadi", () => {
    const later = { ...group, startDate: "2026-10-20" };
    expect(firstLessonDays(later, "2026-10-12", [])[0]).toBe("2026-10-21");
  });

  it("server tekshiruvi: dars kuni bo'lmagan, o'tgan va bayram kuni rad etiladi", () => {
    expect(isFirstLessonDay(group, "2026-10-19", "2026-10-12", [])).toBe(true);
    expect(isFirstLessonDay(group, "2026-10-13", "2026-10-12", [])).toBe(false);
    expect(isFirstLessonDay(group, "2026-10-05", "2026-10-12", [])).toBe(false);
    expect(isFirstLessonDay(group, "2026-10-14", "2026-10-12", [holiday])).toBe(false);
  });
});
