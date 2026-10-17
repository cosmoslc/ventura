import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAVE_REASONS,
  LEAVE_REASONS_KEY,
  LOST_REASONS_KEY,
  REASON_CATEGORIES,
  REASON_CATEGORY_LIST,
  REASON_SWITCHES_KEY,
  buildReasonsConfig,
  parseSwitches,
  reasonOptions,
  statusReasonCategory,
  studentArchiveCategory,
} from "./reasons";

describe("sabab turlari", () => {
  it("kalitlar takrorsiz; mavjud ikkitasi o'z joyida", () => {
    const keys = REASON_CATEGORY_LIST.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(REASON_CATEGORIES.leave.key).toBe(LEAVE_REASONS_KEY);
    expect(REASON_CATEGORIES.lost.key).toBe(LOST_REASONS_KEY);
    expect(keys).not.toContain(REASON_SWITCHES_KEY);
  });

  it("har turda standart ro'yxat bor va qoidaga mos", () => {
    for (const c of REASON_CATEGORY_LIST) {
      expect(c.defaults.length).toBeGreaterThan(0);
      expect(new Set(c.defaults).size).toBe(c.defaults.length);
      expect(c.defaults.every((d) => d.length <= 80)).toBe(true);
    }
  });

  it("yoqgichlar: qiymat yo'q — yoqilgan, buzilgan qiymat — yoqilgan", () => {
    expect(parseSwitches(undefined).freeze).toBe(true);
    expect(parseSwitches({ freeze: false, group_archive: "yo'q" })).toMatchObject({
      freeze: false,
      group_archive: true,
    });
    expect(parseSwitches([1])).toMatchObject({ freeze: true });
    expect("leave" in parseSwitches({})).toBe(false);
  });

  it("sozlamadan to'liq config; buzilgan ro'yxat — standart", () => {
    const c = buildReasonsConfig({
      "reasons.freeze": ["Safar", " Safar ", ""],
      "reasons.lead_archive": 5,
      [REASON_SWITCHES_KEY]: { student_trial: false },
    });
    expect(c.lists.freeze).toEqual(["Safar"]);
    expect(c.lists.lead_archive).toEqual([...REASON_CATEGORIES.lead_archive.defaults]);
    expect(c.lists.leave).toEqual(DEFAULT_LEAVE_REASONS);
    expect(c.switches.student_trial).toBe(false);
    expect(c.switches.student_active).toBe(true);
  });

  it("dialog sabab so'raydimi: yoqgich o'chiq bo'lsa yo'q; chiqish va yo'qotishda doim", () => {
    const c = buildReasonsConfig({ [REASON_SWITCHES_KEY]: { freeze: false } });
    expect(reasonOptions(c, "freeze").active).toBe(false);
    expect(reasonOptions(c, "student_active").active).toBe(true);
    expect(reasonOptions(c, "leave").active).toBe(true);
    expect(reasonOptions(c, "lost").active).toBe(true);
  });

  it("faol o'quvchini o'chirishda Sabablar sahifasidagi ro'yxat chiqadi (har holatda)", () => {
    const saved = ["Narxi qimmat", "Sabab X"];
    const c = buildReasonsConfig({ [REASON_CATEGORIES.student_active.key]: saved });
    for (const status of ["active", "paused", "left", "returned", "graduated"]) {
      const o = reasonOptions(c, studentArchiveCategory(status));
      expect(o).toEqual({ active: true, options: saved });
    }
    // sinovdagi o'quvchi — o'z ro'yxati, faol ro'yxatga aralashmaydi
    expect(reasonOptions(c, studentArchiveCategory("trial")).options).toEqual([
      ...REASON_CATEGORIES.student_trial.defaults,
    ]);
    // sozlamada hali saqlanmagan bo'lsa — standart ro'yxat, dropdown bo'sh qolmaydi
    const d = reasonOptions(buildReasonsConfig({}), studentArchiveCategory("active"));
    expect(d.active).toBe(true);
    expect(d.options).toEqual([...REASON_CATEGORIES.student_active.defaults]);
  });

  it("amalga mos tur tanlanadi", () => {
    expect(studentArchiveCategory("trial")).toBe("student_trial");
    expect(studentArchiveCategory("active")).toBe("student_active");
    expect(statusReasonCategory("paused")).toBe("freeze");
    expect(statusReasonCategory("returned")).toBe("student_return");
    expect(statusReasonCategory("active")).toBeNull();
  });
});
