/*
 * Ish haqi hisobi (EDU-CRM-PLAN E3c, ADR 0018) — toza funksiyalar, Vitest. Hisoblangan maosh bazada saqlanmaydi:
 * o'quvchi hisobi (lib/billing.ts) va kassa yozuvlaridan har safar shu yerda olinadi. Boshqa joyda maosh formulasi
 * yozilmaydi.
 *
 * Eski tizimdan farqlari:
 *  - guruh sozlamasi bo'sh (null) bo'lsa o'qituvchining o'z sozlamasi ishlaydi (eski tizimda 0% ustun turar edi);
 *  - "o'qituvchi ulushiga ta'sir qilmaydigan" chegirma o'qituvchi ulushini kamaytirmaydi (koeffitsient);
 *  - qoldiq hamma joyda bitta formula: hisoblangan + bonus − jarima − (maosh + avans);
 *  - belgilangan oylik "ish boshlagan sana"dan hisoblanadi: undan oldingi oylarga yozilmaydi, birinchi (to'liq
 *    bo'lmagan) oy kunlarga mutanosib bo'linadi (ADR 0043).
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
  /** O'z oyligi shu sanadan hisoblanadi ("YYYY-MM-DD"); null yoki berilmasa — har oyga to'liq */
  fixedFrom?: string | null;
}

export interface PayrollGroup {
  id: string;
  /** null — o'qituvchining o'z sozlamasi */
  salaryType: SalaryType | null;
  percent: number | null;
  /** per_student — stavka, fixed — guruh uchun summa */
  amount: number | null;
  /** Guruhdagi belgilangan summa shu sanadan hisoblanadi ("YYYY-MM-DD"); null yoki berilmasa — har oyga to'liq */
  fixedFrom?: string | null;
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
  /** To'lov yozuvi (profildagi ro'yxat uchun) */
  id?: string;
  /** Pul olingan kun — bir o'quvchining to'lovlari shu tartibda ulushga aylanadi */
  date?: string;
}

/** Belgilangan oylik to'liq oy emas: ishlangan kunlar / oydagi kunlar */
export interface Proration {
  days: number;
  total: number;
}

export interface GroupPay {
  groupId: string;
  salaryType: SalaryType;
  /** Guruhga tushgan naqd pul (sof) */
  revenue: number;
  pay: number;
  /** Guruhdagi belgilangan summa kunlarga mutanosib bo'lingan bo'lsa */
  proration?: Proration | null;
}

export interface TeacherAccrual {
  /** O'z oyligi (belgilangan turida, oyiga bir marta; ish boshlagan sanadan) */
  base: number;
  /** O'z oyligi kunlarga mutanosib bo'lingan bo'lsa */
  baseProration?: Proration | null;
  groups: GroupPay[];
  revenue: number;
  total: number;
}

/* ---------- Belgilangan oylik: ish boshlagan sana ---------- */

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/**
 * Belgilangan summaning shu oyga tegishli qismi. `from` oyidan oldingi oylar — 0; `from` oyida — ishlangan kunlar
 * (boshlagan kuni ham) / oydagi kunlar, yaxlitlangan; keyingi oylar — to'liq. `from` yo'q bo'lsa — to'liq.
 * Kunlar bo'yicha (darslar bo'yicha emas): bayram va jadval o'zgarishi summani o'zgartirmaydi (ADR 0043).
 */
export function fixedForMonth(
  amount: number,
  from: string | null | undefined,
  month: string,
): { pay: number; proration: Proration | null } {
  if (!from) return { pay: amount, proration: null };
  const startMonth = from.slice(0, 7);
  if (month < startMonth) return { pay: 0, proration: null };
  if (month > startMonth || amount <= 0) return { pay: amount, proration: null };
  const total = daysInMonth(month);
  const days = Math.max(0, total - Number(from.slice(8, 10)) + 1);
  if (days >= total) return { pay: amount, proration: null };
  return { pay: Math.round((amount * days) / total), proration: { days, total } };
}

/**
 * O'qituvchining o'z belgilangan oyligi qaysi sanadan hisoblanadi: aniq sana berilgan bo'lsa shu; bo'lmasa tizimga
 * qo'shilgan kun va birinchi guruhi boshlangan kundan eng erta biri (shu sanadan oldin u ishlagan bo'lishi mumkin emas).
 */
export function teacherFixedFrom(
  explicit: string | null | undefined,
  createdDate: string,
  groupStarts: readonly string[],
): string {
  if (explicit) return explicit;
  return groupStarts.reduce((min, d) => (d < min ? d : min), createdDate);
}

/** Koeffitsient = o'qituvchi narxi / to'langan narx; hisob bo'lmasa yoki narx 0 bo'lsa — 1 */
export function teacherCoef(sm: StudentMonth | undefined): number {
  if (!sm || sm.fullPrice <= 0) return 1;
  return sm.teacherPrice / sm.fullPrice;
}

/** Guruhda amalda qaysi tur va qiymat: foiz — %, har o'quvchi — stavka, belgilangan — guruhdagi summa (o'z oyligi — 0) */
export function groupTerms(teacher: TeacherRule, group: PayrollGroup): { type: SalaryType; value: number } {
  const type = group.salaryType ?? teacher.salaryType;
  if (type === "percent")
    return { type, value: group.salaryType === "percent" && group.percent !== null ? group.percent : teacher.percent };
  if (type === "per_student")
    return {
      type,
      value: group.salaryType === "per_student" && group.amount !== null ? group.amount : teacher.perStudent,
    };
  return { type, value: group.salaryType === "fixed" ? (group.amount ?? 0) : 0 };
}

/** Bitta to'lov (yoki qaytarish) va undan o'qituvchiga tegadigan ulush */
export interface ShareLine {
  cash: GroupCash;
  pay: number;
}

/**
 * Guruhga tushgan har to'lovdan o'qituvchi ulushi (kiritish tartibida). Foiz va har o'quvchi uchun turlarida
 * `groupPay` aynan shu yig'indini oladi — profildagi ro'yxat va ish haqi jadvali hech qachon farq qilmaydi.
 *  - foiz: `round(summa × koeffitsient × foiz / 100)` har to'lovdan;
 *  - har o'quvchi uchun: o'quvchining chegarasi to'lovlar sana tartibida to'lanib borgan ulushiga qarab bo'linadi
 *    (jamlangan summalar ayirmasi), shuning uchun yig'indi o'quvchi bo'yicha jami to'lovdan hisoblangan chegaraga teng;
 *  - belgilangan: to'lovga bog'liq emas, har to'lov 0.
 */
export function groupShares(
  teacher: TeacherRule,
  group: PayrollGroup,
  months: readonly StudentMonth[],
  cash: readonly GroupCash[],
): ShareLine[] {
  const { type, value } = groupTerms(teacher, group);
  const money = cash.filter((c) => c.groupId === group.id);
  const byStudent = new Map(months.filter((m) => m.groupId === group.id).map((m) => [m.studentId, m]));
  if (type === "percent") {
    return money.map((c) => ({
      cash: c,
      pay: Math.round((c.amount * teacherCoef(byStudent.get(c.studentId)) * value) / 100),
    }));
  }
  if (type === "per_student") {
    const rate = value;
    const pays = new Array<number>(money.length).fill(0);
    const order = money
      .map((_, i) => i)
      .sort((a, b) => (money[a]!.date ?? "").localeCompare(money[b]!.date ?? "") || a - b);
    const paidSoFar = new Map<string, number>();
    for (const i of order) {
      const c = money[i]!;
      const m = byStudent.get(c.studentId);
      const before = paidSoFar.get(c.studentId) ?? 0;
      const after = before + c.amount;
      paidSoFar.set(c.studentId, after);
      if (!m || m.amount <= 0 || m.basePrice <= 0) continue;
      const cap = Math.round((rate * m.amount * teacherCoef(m)) / m.basePrice);
      const accrued = (paid: number) => Math.round(cap * Math.min(1, Math.max(0, paid) / m.amount));
      pays[i] = accrued(after) - accrued(before);
    }
    return money.map((c, i) => ({ cash: c, pay: pays[i]! }));
  }
  return money.map((c) => ({ cash: c, pay: 0 }));
}

/** `month` — hisob oyi ("YYYY-MM"); berilmasa belgilangan oylik ish boshlagan sanasiz, to'liq olinadi */
export function groupPay(
  teacher: TeacherRule,
  group: PayrollGroup,
  months: readonly StudentMonth[],
  cash: readonly GroupCash[],
  month?: string,
): GroupPay {
  const type = group.salaryType ?? teacher.salaryType;
  const revenue = cash.filter((c) => c.groupId === group.id).reduce((s, c) => s + c.amount, 0);
  if (type === "fixed") {
    // Guruhga o'zgacha belgilangan summa; o'qituvchining o'z oyligi guruhlarga bo'linmaydi (base)
    if (group.salaryType !== "fixed") return { groupId: group.id, salaryType: type, revenue, pay: 0 };
    const f = fixedForMonth(group.amount ?? 0, month ? group.fixedFrom : null, month ?? "");
    return { groupId: group.id, salaryType: type, revenue, pay: f.pay, proration: f.proration };
  }
  const pay = groupShares(teacher, group, months, cash).reduce((s, l) => s + l.pay, 0);
  return { groupId: group.id, salaryType: type, revenue, pay };
}

export function teacherAccrual(
  teacher: TeacherRule,
  groups: readonly PayrollGroup[],
  months: readonly StudentMonth[],
  cash: readonly GroupCash[],
  month?: string,
): TeacherAccrual {
  const list = groups.map((g) => groupPay(teacher, g, months, cash, month));
  const own =
    teacher.salaryType === "fixed"
      ? fixedForMonth(teacher.fixed, month ? teacher.fixedFrom : null, month ?? "")
      : { pay: 0, proration: null };
  return {
    base: own.pay,
    baseProration: own.proration,
    groups: list,
    revenue: list.reduce((s, g) => s + g.revenue, 0),
    total: own.pay + list.reduce((s, g) => s + g.pay, 0),
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
