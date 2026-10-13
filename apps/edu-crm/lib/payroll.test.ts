import { describe, expect, it } from "vitest";
import {
  type GroupCash,
  type PayrollGroup,
  type StudentMonth,
  type TeacherRule,
  groupPay,
  managerAccrual,
  salaryBalance,
  teacherAccrual,
  teacherCoef,
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
