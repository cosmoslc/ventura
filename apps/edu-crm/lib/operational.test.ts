import { describe, expect, it } from "vitest";
import { type OperationalInput, operationalMonths } from "./operational";

const input: OperationalInput = {
  leads: new Map([
    ["2026-01", 4],
    ["2026-02", 1],
  ]),
  won: new Map([
    ["2026-01", 1],
    ["2026-02", 1],
  ]),
  firstPayers: new Map([
    ["2026-01", 2],
    ["2026-02", 1],
  ]),
  stints: [
    { studentId: "a", from: "2025-12-10", to: null },
    // b yanvarda guruh almashtirdi — ketgan hisoblanmaydi
    { studentId: "b", from: "2025-12-20", to: "2026-01-15" },
    { studentId: "b", from: "2026-01-15", to: null },
    // c yanvar oxirida ketdi
    { studentId: "c", from: "2025-11-01", to: "2026-01-20" },
    // d fevralda keldi
    { studentId: "d", from: "2026-02-03", to: null },
  ],
  groups: [
    { start: "2025-09-01", end: null },
    { start: "2025-10-01", end: "2026-02-01" },
    { start: "2026-02-10", end: null },
  ],
  attendance: new Map([
    ["2026-01", { present: 45, marked: 50 }],
    ["2026-02", { present: 0, marked: 0 }],
  ]),
};
const TODAY = "2026-02-20";

describe("operatsion ko'rsatkichlar", () => {
  const m = operationalMonths(input, 2026, TODAY);

  it("12 oy; kelmagan oylar bo'sh", () => {
    expect(m).toHaveLength(12);
    expect(m[2]).toMatchObject({ future: true, leads: null, students: null, attendance: null });
  });

  it("lidlar, birinchi to'lov va konversiya", () => {
    expect(m[0]).toMatchObject({ leads: 4, firstPayers: 2, conversion: 25 });
    expect(m[1]).toMatchObject({ leads: 1, firstPayers: 1, conversion: 100 });
  });

  it("o'quvchilar oy oxirida; guruh almashtirish ketish emas", () => {
    // yanvar oxiri: a, b (c ketgan)
    expect(m[0]).toMatchObject({ students: 2, left: 1 });
    // joriy oy — bugungi holat: a, b, d
    expect(m[1]).toMatchObject({ students: 3, left: 0 });
  });

  it("guruhlar va o'rtacha to'ldirilish", () => {
    expect(m[0]).toMatchObject({ groups: 2, avgFill: 1 });
    // fevral: ikkinchi guruh 1-fevralda arxivlangan, uchinchisi ochilgan
    expect(m[1]).toMatchObject({ groups: 2, avgFill: 1.5 });
  });

  it("davomat: belgi bo'lmasa null", () => {
    expect(m[0]!.attendance).toBe(90);
    expect(m[1]!.attendance).toBeNull();
  });

  it("lid yo'q — konversiya null", () => {
    const empty = operationalMonths({ ...input, leads: new Map() }, 2026, TODAY);
    expect(empty[0]!.conversion).toBeNull();
  });
});
