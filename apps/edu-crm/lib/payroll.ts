/*
 * Ish haqi hisobi (EDU-CRM-PLAN E3c, ADR 0018) — toza funksiyalar, Vitest. Hisoblangan maosh bazada saqlanmaydi:
 * o'quvchi hisobi (lib/billing.ts) va kassa yozuvlaridan har safar shu yerda olinadi. Boshqa joyda maosh formulasi
 * yozilmaydi.
 *
 * Eski tizimdan farqlari:
 *  - guruh sozlamasi bo'sh (null) bo'lsa o'qituvchining o'z sozlamasi ishlaydi (eski tizimda 0% ustun turar edi);
 *  - "o'qituvchi ulushiga ta'sir qilmaydigan" chegirma o'qituvchi ulushini kamaytirmaydi (koeffitsient);
 *  - qoldiq hamma joyda bitta formula: hisoblangan + bonus − jarima − (maosh + avans).
 */

export type SalaryType = "percent" | "per_student" | "fixed";

export interface TeacherRule {
  salaryType: SalaryType;
  /** Foiz turi uchun, 0–100 */
  percent: number;
  /** Har o'quvchi uchun turida — to'liq oy uchun summa */
  perStudent: number;
  /** Belgilangan turida — oyiga bir marta */
  fixed: number;
}

export interface PayrollGroup {
  id: string;
  /** null — o'qituvchining o'z sozlamasi */
  salaryType: SalaryType | null;
  percent: number | null;
  /** per_student — stavka, fixed — guruh uchun summa */
  amount: number | null;
}

/** O'quvchining shu oy shu guruhdagi hisobi (lib/billing.ts MonthCharge dan) */
export interface StudentMonth {
  studentId: string;
  groupId: string;
  /** Oylik hisob (darslarga mutanosib) */
  amount: number;
  /** Guruhning shu oydagi narxi */
  basePrice: number;
  /** Barcha chegirmalardan keyingi narx */
  fullPrice: number;
  /** Faqat "o'qituvchiga ta'sir qiladigan" chegirmalardan keyingi narx */
  teacherPrice: number;
}

/** Guruhga shu oy belgisi bilan tushgan naqd pul: to'lov +, qaytarish − */
export interface GroupCash {
  studentId: string;
  groupId: string;
  amount: number;
}

export interface GroupPay {
  groupId: string;
  salaryType: SalaryType;
  /** Guruhga tushgan naqd pul (sof) */
  revenue: number;
  pay: number;
}

export interface TeacherAccrual {
  /** O'z oyligi (belgilangan turida, oyiga bir marta) */
  base: number;
  groups: GroupPay[];
  revenue: number;
  total: number;
}

/** Koeffitsient = o'qituvchi narxi / to'langan narx; hisob bo'lmasa yoki narx 0 bo'lsa — 1 */
export function teacherCoef(sm: StudentMonth | undefined): number {
  if (!sm || sm.fullPrice <= 0) return 1;
  return sm.teacherPrice / sm.fullPrice;
}

export function groupPay(
  teacher: TeacherRule,
  group: PayrollGroup,
  months: readonly StudentMonth[],
  cash: readonly GroupCash[],
): GroupPay {
  const type = group.salaryType ?? teacher.salaryType;
  const own = months.filter((m) => m.groupId === group.id);
  const money = cash.filter((c) => c.groupId === group.id);
  const revenue = money.reduce((s, c) => s + c.amount, 0);
  const byStudent = new Map(own.map((m) => [m.studentId, m]));
  let pay = 0;
  if (type === "percent") {
    const pct = group.salaryType === "percent" && group.percent !== null ? group.percent : teacher.percent;
    for (const c of money) pay += Math.round((c.amount * teacherCoef(byStudent.get(c.studentId)) * pct) / 100);
  } else if (type === "per_student") {
    const rate = group.salaryType === "per_student" && group.amount !== null ? group.amount : teacher.perStudent;
    for (const m of own) {
      if (m.amount <= 0 || m.basePrice <= 0) continue;
      const cap = Math.round((rate * m.amount * teacherCoef(m)) / m.basePrice);
      const paid = money.filter((c) => c.studentId === m.studentId).reduce((s, c) => s + c.amount, 0);
      pay += Math.round(cap * Math.min(1, Math.max(0, paid) / m.amount));
    }
  } else {
    // Guruhga o'zgacha belgilangan summa; o'qituvchining o'z oyligi guruhlarga bo'linmaydi (base)
    pay = group.salaryType === "fixed" ? (group.amount ?? 0) : 0;
  }
  return { groupId: group.id, salaryType: type, revenue, pay };
}

export function teacherAccrual(
  teacher: TeacherRule,
  groups: readonly PayrollGroup[],
  months: readonly StudentMonth[],
  cash: readonly GroupCash[],
): TeacherAccrual {
  const list = groups.map((g) => groupPay(teacher, g, months, cash));
  const base = teacher.salaryType === "fixed" ? teacher.fixed : 0;
  return {
    base,
    groups: list,
    revenue: list.reduce((s, g) => s + g.revenue, 0),
    total: base + list.reduce((s, g) => s + g.pay, 0),
  };
}

/* ---------- Menejer ---------- */

export interface ManagerRule {
  salaryType: "fixed" | "kpi";
  monthlySalary: number;
  /** Har yangi o'quvchi uchun */
  kpiStudentAmount: number;
  /** 1 oy o'qib, to'liq to'lagan o'quvchi uchun */
  kpiContractBonus: number;
}

export interface ManagerAccrual {
  base: number;
  newStudents: number;
  studentPart: number;
  oneMonthStudents: number;
  bonusPart: number;
  total: number;
}

/**
 * Menejer maoshi (4-qaror): oklad + shu oyda birinchi marta faollashtirilgan o'zi qo'shgan o'quvchilar × summa +
 * 1 oy o'qib, shu oyni to'liq to'lagan o'quvchilar × bonus. `fixed` turida faqat oklad.
 */
export function managerAccrual(rule: ManagerRule, newStudents: number, oneMonthStudents: number): ManagerAccrual {
  const kpi = rule.salaryType === "kpi";
  const studentPart = kpi ? newStudents * rule.kpiStudentAmount : 0;
  const bonusPart = kpi ? oneMonthStudents * rule.kpiContractBonus : 0;
  return {
    base: rule.monthlySalary,
    newStudents,
    studentPart,
    oneMonthStudents,
    bonusPart,
    total: rule.monthlySalary + studentPart + bonusPart,
  };
}

/* ---------- Qoldiq ---------- */

export interface SalaryMove {
  kind: "salary" | "advance" | "bonus" | "penalty";
  amount: number;
}

export interface SalaryBalance {
  accrued: number;
  bonus: number;
  penalty: number;
  salary: number;
  advance: number;
  /** Berilgan pul: maosh + avans */
  paid: number;
  /** hisoblangan + bonus − jarima − berilgan; manfiy — ortiqcha berilgan */
  remaining: number;
}

export function salaryBalance(accrued: number, moves: readonly SalaryMove[]): SalaryBalance {
  const sum = (k: SalaryMove["kind"]) => moves.filter((m) => m.kind === k).reduce((s, m) => s + m.amount, 0);
  const bonus = sum("bonus");
  const penalty = sum("penalty");
  const salary = sum("salary");
  const advance = sum("advance");
  const paid = salary + advance;
  return { accrued, bonus, penalty, salary, advance, paid, remaining: accrued + bonus - penalty - paid };
}
