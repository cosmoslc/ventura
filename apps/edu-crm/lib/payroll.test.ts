import { describe, expect, it } from "vitest";
import {
  type GroupCash,
  type PayrollGroup,
  type StudentMonth,
  type TeacherRule,
  daysInMonth,
  fixedForMonth,
  groupPay,
  groupShares,
  managerAccrual,
  salaryBalance,
  teacherAccrual,
  teacherCoef,
  teacherFixedFrom,
} from "./payroll";

const percent: TeacherRule = { salaryType: "percent", percent: 40, perStudent: 0, fixed: 0 };
const g = (over: Partial<PayrollGroup> = {}): PayrollGroup => ({
  id: "g1",
  salaryType: null,
  percent: null,
  amount: null,
  ...over,
});
const sm = (studentId: string, over: Partial<StudentMonth> = {}): StudentMonth => ({
  studentId,
  groupId: "g1",
  amount: 300_000,
  basePrice: 300_000,
  fullPrice: 300_000,
  teacherPrice: 300_000,
  ...over,
});
const cash = (studentId: string, amount: number, groupId = "g1"): GroupCash => ({ studentId, groupId, amount });

describe("teacherCoef", () => {
  it("chegirma o'qituvchiga ta'sir qilmasa — to'langan narxdan yuqori ulush", () => {
    expect(teacherCoef(sm("a", { fullPrice: 200_000, teacherPrice: 300_000 }))).toBe(1.5);
    expect(teacherCoef(sm("a"))).toBe(1);
    expect(teacherCoef(undefined)).toBe(1);
    expect(teacherCoef(sm("a", { fullPrice: 0, teacherPrice: 0 }))).toBe(1);
  });
});

describe("foiz turi", () => {
  it("guruhga shu oy tushgan naqd pul × foiz, qaytarish ayiriladi", () => {
    const r = groupPay(percent, g(), [sm("a"), sm("b")], [cash("a", 300_000), cash("b", 150_000), cash("b", -50_000)]);
    // 120 000 + 60 000 − 20 000
    expect(r).toEqual({ groupId: "g1", salaryType: "percent", revenue: 400_000, pay: 160_000 });
  });

  it("o'qituvchiga ta'sir qilmaydigan chegirma: koeffitsient bilan", () => {
    const r = groupPay(percent, g(), [sm("a", { fullPrice: 200_000, teacherPrice: 300_000 })], [cash("a", 200_000)]);
    expect(r.pay).toBe(120_000);
  });

  it("guruh sozlamasi bo'sh — o'qituvchining foizi; guruhda 0% — 0 (aniq belgilangan)", () => {
    expect(groupPay(percent, g({ salaryType: null, percent: 0 }), [], [cash("a", 100_000)]).pay).toBe(40_000);
    expect(groupPay(percent, g({ salaryType: "percent", percent: 0 }), [], [cash("a", 100_000)]).pay).toBe(0);
    expect(groupPay(percent, g({ salaryType: "percent", percent: 50 }), [], [cash("a", 100_000)]).pay).toBe(50_000);
  });

  it("boshqa guruh puli kirmaydi", () => {
    expect(groupPay(percent, g(), [], [cash("a", 100_000, "g2")]).pay).toBe(0);
  });
});

describe("har o'quvchi uchun turi", () => {
  const rule: TeacherRule = { salaryType: "per_student", percent: 0, perStudent: 100_000, fixed: 0 };

  it("to'liq to'lagan — to'liq stavka, yarmini to'lagan — yarmi, to'lamagan — 0", () => {
    const r = groupPay(rule, g(), [sm("a"), sm("b"), sm("c")], [cash("a", 300_000), cash("b", 150_000)]);
    expect(r.pay).toBe(150_000);
  });

  it("oy o'rtasidan qo'shilgan: chegara hisobga mutanosib", () => {
    // 6/12 dars — hisob 150 000, chegara 50 000, to'liq to'lagan
    const r = groupPay(rule, g(), [sm("a", { amount: 150_000 })], [cash("a", 150_000)]);
    expect(r.pay).toBe(50_000);
  });

  it("ortiqcha to'lov chegaradan oshirmaydi; hisob 0 — 0", () => {
    expect(groupPay(rule, g(), [sm("a")], [cash("a", 900_000)]).pay).toBe(100_000);
    expect(groupPay(rule, g(), [sm("a", { amount: 0 })], [cash("a", 100_000)]).pay).toBe(0);
  });

  it("o'qituvchiga ta'sir qiladigan chegirma ulushni kamaytiradi, ta'sir qilmaydigani — yo'q", () => {
    const affects = sm("a", { amount: 150_000, fullPrice: 150_000, teacherPrice: 150_000 });
    expect(groupPay(rule, g(), [affects], [cash("a", 150_000)]).pay).toBe(50_000);
    const notAffects = sm("a", { amount: 150_000, fullPrice: 150_000, teacherPrice: 300_000 });
    expect(groupPay(rule, g(), [notAffects], [cash("a", 150_000)]).pay).toBe(100_000);
  });

  it("guruhdagi o'zgacha stavka", () => {
    const r = groupPay(rule, g({ salaryType: "per_student", amount: 60_000 }), [sm("a")], [cash("a", 300_000)]);
    expect(r.pay).toBe(60_000);
  });
});

describe("belgilangan turi va jami", () => {
  it("o'z oyligi oyiga bir marta (guruhsiz ham), guruhdagi o'zgacha summa alohida qo'shiladi", () => {
    const rule: TeacherRule = { salaryType: "fixed", percent: 0, perStudent: 0, fixed: 2_000_000 };
    expect(teacherAccrual(rule, [], [], []).total).toBe(2_000_000);
    const r = teacherAccrual(
      rule,
      [
        g({ id: "g1" }),
        g({ id: "g2", salaryType: "fixed", amount: 500_000 }),
        g({ id: "g3", salaryType: "percent", percent: 10 }),
      ],
      [],
      [cash("a", 1_000_000, "g3")],
    );
    expect(r).toMatchObject({ base: 2_000_000, revenue: 1_000_000, total: 2_600_000 });
    expect(r.groups.map((x) => x.pay)).toEqual([0, 500_000, 100_000]);
  });

  it("foizli o'qituvchida guruh o'zgacha belgilangan bo'lsa", () => {
    const r = teacherAccrual(percent, [g({ salaryType: "fixed", amount: 700_000 })], [], [cash("a", 1_000_000)]);
    expect(r.total).toBe(700_000);
  });
});

describe("belgilangan oylik: ish boshlagan sana", () => {
  it("kunlar soni", () => {
    expect(daysInMonth("2026-10")).toBe(31);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });

  it("sana yo'q — har oy to'liq; sanadan oldingi oylar 0; keyingilari to'liq", () => {
    expect(fixedForMonth(3_100_000, null, "2026-10")).toEqual({ pay: 3_100_000, proration: null });
    expect(fixedForMonth(3_100_000, "2026-10-16", "2026-09")).toEqual({ pay: 0, proration: null });
    expect(fixedForMonth(3_100_000, "2026-10-16", "2026-11")).toEqual({ pay: 3_100_000, proration: null });
  });

  it("birinchi oy kunlarga mutanosib (boshlagan kuni ham sanaladi)", () => {
    expect(fixedForMonth(3_100_000, "2026-10-16", "2026-10")).toEqual({
      pay: 1_600_000,
      proration: { days: 16, total: 31 },
    });
    // 31-kuni boshlagan — bir kun
    expect(fixedForMonth(3_100_000, "2026-10-31", "2026-10").pay).toBe(100_000);
    // oyning 1-kuni — to'liq oy, mutanosiblik yo'q
    expect(fixedForMonth(3_100_000, "2026-10-01", "2026-10")).toEqual({ pay: 3_100_000, proration: null });
    // yaxlitlash: 1 000 000 × 10/30
    expect(fixedForMonth(1_000_000, "2026-11-21", "2026-11").pay).toBe(333_333);
  });

  it("standart sana: aniq sana, aks holda qo'shilgan kun va guruhlar boshlanishidan eng erta", () => {
    expect(teacherFixedFrom("2026-10-05", "2026-09-01", ["2026-08-01"])).toBe("2026-10-05");
    expect(teacherFixedFrom(null, "2026-09-10", ["2026-08-20", "2026-09-01"])).toBe("2026-08-20");
    expect(teacherFixedFrom(null, "2026-09-10", [])).toBe("2026-09-10");
    expect(teacherFixedFrom("", "2026-09-10", ["2026-10-01"])).toBe("2026-09-10");
  });

  const rule = (fixedFrom: string | null): TeacherRule => ({
    salaryType: "fixed",
    percent: 0,
    perStudent: 0,
    fixed: 3_100_000,
    fixedFrom,
  });

  it("o'z oyligi (support ham) sanadan oldin 0, birinchi oyda mutanosib", () => {
    expect(teacherAccrual(rule("2026-10-16"), [], [], [], "2026-09").total).toBe(0);
    const r = teacherAccrual(rule("2026-10-16"), [], [], [], "2026-10");
    expect(r).toMatchObject({ base: 1_600_000, total: 1_600_000, baseProration: { days: 16, total: 31 } });
    expect(teacherAccrual(rule("2026-10-16"), [], [], [], "2026-11").total).toBe(3_100_000);
    // oy berilmasa — sanasiz, to'liq (eski chaqiruvlar)
    expect(teacherAccrual(rule("2026-10-16"), [], [], []).total).toBe(3_100_000);
  });

  it("guruhdagi belgilangan summa guruhning o'z sanasidan; foizli o'qituvchi o'zgarmaydi", () => {
    const grp = g({ id: "g2", salaryType: "fixed", amount: 620_000, fixedFrom: "2026-10-11" });
    const pct = teacherAccrual(percent, [grp], [], [], "2026-10");
    expect(pct.total).toBe(420_000);
    expect(pct.groups[0]).toMatchObject({ pay: 420_000, proration: { days: 21, total: 31 } });
    expect(teacherAccrual(percent, [grp], [], [], "2026-09").total).toBe(0);
    expect(teacherAccrual(percent, [grp], [], [], "2026-12").total).toBe(620_000);
  });
});

describe("to'lovlardan ulush qatorlari", () => {
  it("foiz: har to'lovdan; yig'indi groupPay bilan teng", () => {
    const c = [cash("a", 300_000), cash("b", 150_000), cash("b", -50_000)];
    const lines = groupShares(percent, g(), [sm("a"), sm("b")], c);
    expect(lines.map((l) => l.pay)).toEqual([120_000, 60_000, -20_000]);
    expect(lines.reduce((x, l) => x + l.pay, 0)).toBe(groupPay(percent, g(), [sm("a"), sm("b")], c).pay);
  });

  const per: TeacherRule = { salaryType: "per_student", percent: 0, perStudent: 100_000, fixed: 0 };

  it("har o'quvchi uchun: bo'lib-bo'lib to'lov sana tartibida bo'linadi, yig'indi o'zgarmaydi", () => {
    const c: GroupCash[] = [
      { studentId: "a", groupId: "g1", amount: 200_000, date: "2026-10-12", id: "p2" },
      { studentId: "a", groupId: "g1", amount: 100_000, date: "2026-10-03", id: "p1" },
    ];
    const lines = groupShares(per, g(), [sm("a")], c);
    // 3 oktabr: 100 000 / 300 000 → 33 333; 12 oktabr: qolgani 66 667
    expect(lines.map((l) => [l.cash.id, l.pay])).toEqual([
      ["p2", 66_667],
      ["p1", 33_333],
    ]);
    expect(lines.reduce((x, l) => x + l.pay, 0)).toBe(groupPay(per, g(), [sm("a")], c).pay);
    expect(groupPay(per, g(), [sm("a")], c).pay).toBe(100_000);
  });

  it("har o'quvchi uchun: ortiqcha to'lov va qaytarish; hisobsiz o'quvchi 0", () => {
    const c: GroupCash[] = [
      { studentId: "a", groupId: "g1", amount: 400_000, date: "2026-10-01" },
      { studentId: "a", groupId: "g1", amount: -250_000, date: "2026-10-09" },
      { studentId: "x", groupId: "g1", amount: 100_000, date: "2026-10-02" },
    ];
    const lines = groupShares(per, g(), [sm("a")], c);
    // 400 000 (chegara 100 000) → 100 000; qaytarishdan keyin 150 000 → 50 000: −50 000
    expect(lines.map((l) => l.pay)).toEqual([100_000, -50_000, 0]);
    expect(lines.reduce((x, l) => x + l.pay, 0)).toBe(groupPay(per, g(), [sm("a")], c).pay);
  });

  it("belgilangan guruh: to'lovlar 0", () => {
    const lines = groupShares(percent, g({ salaryType: "fixed", amount: 500_000 }), [], [cash("a", 100_000)]);
    expect(lines.map((l) => l.pay)).toEqual([0]);
  });
});

describe("menejer", () => {
  const rule = {
    salaryType: "kpi" as const,
    monthlySalary: 3_000_000,
    kpiStudentAmount: 50_000,
    kpiContractBonus: 100_000,
  };

  it("oklad + yangi o'quvchilar + 1 oy to'liq to'laganlar", () => {
    expect(managerAccrual(rule, 4, 2)).toEqual({
      base: 3_000_000,
      newStudents: 4,
      studentPart: 200_000,
      oneMonthStudents: 2,
      bonusPart: 200_000,
      total: 3_400_000,
    });
  });

  it("belgilangan turida faqat oklad", () => {
    expect(managerAccrual({ ...rule, salaryType: "fixed" }, 4, 2).total).toBe(3_000_000);
  });
});

describe("qoldiq", () => {
  it("hisoblangan + bonus − jarima − (maosh + avans)", () => {
    expect(
      salaryBalance(2_000_000, [
        { kind: "advance", amount: 500_000 },
        { kind: "salary", amount: 1_000_000 },
        { kind: "bonus", amount: 200_000 },
        { kind: "penalty", amount: 50_000 },
      ]),
    ).toEqual({
      accrued: 2_000_000,
      bonus: 200_000,
      penalty: 50_000,
      salary: 1_000_000,
      advance: 500_000,
      paid: 1_500_000,
      remaining: 650_000,
    });
  });

  it("ortiqcha berilgani manfiy qoldiq (ikki marta sanalmaydi)", () => {
    expect(salaryBalance(1_000_000, [{ kind: "salary", amount: 1_200_000 }]).remaining).toBe(-200_000);
  });
});
