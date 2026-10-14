/*
 * O'qituvchi samaradorlik reytingi (E5d, ADR 0033) — toza funksiyalar (Vitest). Eski tizimdagi sahifa qo'lda
 * yozilgan raqamlarni ko'rsatardi; bu yerda har ko'rsatkich bazadagi haqiqiy yozuvlardan, umumiy "ball" yo'q —
 * turli ko'rsatkichlarni bitta songa aralashtirish o'zboshimchalik bo'lardi.
 */

const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : null);

/** Bitta o'qituvchining davrdagi xom sanoqlari (serverda yig'iladi) */
export interface TeacherCounts {
  teacherId: string;
  name: string;
  /** Hozirgi (arxivlanmagan) guruhlari */
  groups: number;
  /** Hozirgi guruhlaridagi faol va sinovdagi o'quvchilar (takrorsiz) */
  students: number;
  /** Davrda jadval bo'yicha o'tilgan darslar (bayramsiz, bugungacha) */
  lessons: number;
  minutes: number;
  /** Shulardan davomat olingan darslar */
  markedLessons: number;
  /** Davomat belgilari: bor + kech / jami belgilar */
  attended: number;
  marks: number;
  /** Davr boshida guruhlarida bo'lgan faollashtirilgan o'quvchilar va ulardan davrda chiqqanlar */
  base: number;
  left: number;
  /** Davrda qo'shilganlardan: faollashtirilgan va faollashtirilmay chiqqan (sinovdagilar hali hal bo'lmagan) */
  activated: number;
  trialLeft: number;
  /** Birinchi darsga kelgan lidlar va ulardan o'quvchi bo'lganlar */
  firstCame: number;
  firstWon: number;
  /** Hisoblangan maosh (moliyaviy ruxsatsiz — null) */
  salary: number | null;
}

export interface TeacherRow extends TeacherCounts {
  hours: number;
  /** O'tilgan darslarning necha foizida davomat olingan */
  markedRate: number | null;
  attendance: number | null;
  retention: number | null;
  trialConv: number | null;
  firstConv: number | null;
}

export function teacherRow(c: TeacherCounts): TeacherRow {
  return {
    ...c,
    hours: c.minutes / 60,
    markedRate: pct(c.markedLessons, c.lessons),
    attendance: pct(c.attended, c.marks),
    retention: pct(c.base - c.left, c.base),
    trialConv: pct(c.activated, c.activated + c.trialLeft),
    firstConv: pct(c.firstWon, c.firstCame),
  };
}

/** Jami qator: sanoqlar yig'indisi, foizlar shu yig'indidan (o'rtachalar o'rtachasi emas) */
export function teacherTotal(rows: readonly TeacherCounts[], name: string): TeacherRow {
  const sum = (k: keyof Omit<TeacherCounts, "teacherId" | "name" | "salary">) => rows.reduce((s, r) => s + r[k], 0);
  const salaries = rows.map((r) => r.salary).filter((v) => v !== null);
  return teacherRow({
    teacherId: "",
    name,
    groups: sum("groups"),
    students: sum("students"),
    lessons: sum("lessons"),
    minutes: sum("minutes"),
    markedLessons: sum("markedLessons"),
    attended: sum("attended"),
    marks: sum("marks"),
    base: sum("base"),
    left: sum("left"),
    activated: sum("activated"),
    trialLeft: sum("trialLeft"),
    firstCame: sum("firstCame"),
    firstWon: sum("firstWon"),
    salary: salaries.length ? salaries.reduce((s, v) => s + v, 0) : null,
  });
}

/**
 * Tartib: ushlab turish (yuqoridan), keyin davomat, keyin o'tilgan darslar. Ushlab turishi hisoblanmaganlar (davr
 * boshida o'quvchisi yo'q) oxirida.
 */
export function rankTeachers(rows: readonly TeacherRow[]): TeacherRow[] {
  const v = (x: number | null) => (x === null ? -1 : x);
  return [...rows].sort(
    (a, b) =>
      v(b.retention) - v(a.retention) ||
      v(b.attendance) - v(a.attendance) ||
      b.lessons - a.lessons ||
      a.name.localeCompare(b.name),
  );
}

/** "HH:MM" oralig'i, daqiqa */
export function lessonMinutes(start: string, end: string): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return Math.max(0, m(end) - m(start));
}
