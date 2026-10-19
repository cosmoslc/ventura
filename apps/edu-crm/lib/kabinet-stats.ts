import type { GradeMark } from "./grades";

/*
 * O'qituvchi kabineti, guruh statistikasi (ADR 0062). Toza funksiya: oy bo'yicha har o'quvchining davomati,
 * o'rtacha bahosi (foizda, turli shkalalar bilan) va uy vazifasi; guruh o'zlashtirishi; eng yuqori va eng past.
 */

export interface StudentStat {
  studentId: string;
  name: string;
  /** (bor + kech) / belgilar, %; belgi yo'q — null */
  attendance: number | null;
  /** O'rtacha baho, %; baho yo'q — null */
  average: number | null;
  graded: number;
  homeworkDone: number;
  homeworkMarked: number;
}

export interface GroupStats {
  students: StudentStat[];
  /** Guruh o'zlashtirishi: hamma baholarning o'rtachasi, % */
  mastery: number | null;
  attendance: number | null;
  homework: number | null;
  /** O'rtacha bahosi bor o'quvchilardan */
  best: StudentStat | null;
  worst: StudentStat | null;
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

export function groupStats(input: {
  members: readonly { studentId: string; name: string }[];
  /** `${studentId}|${date}` → davomat holati */
  attendance: Readonly<Record<string, { status: string }>>;
  /** `${studentId}|${date}` → baho */
  grades: Readonly<Record<string, GradeMark>>;
}): GroupStats {
  const att = new Map<string, { came: number; marked: number }>();
  for (const [key, m] of Object.entries(input.attendance)) {
    const id = key.split("|")[0]!;
    const a = att.get(id) ?? { came: 0, marked: 0 };
    a.marked++;
    if (m.status === "present" || m.status === "late") a.came++;
    att.set(id, a);
  }
  const gr = new Map<string, { sum: number; n: number; hwDone: number; hw: number }>();
  for (const [key, g] of Object.entries(input.grades)) {
    const id = key.split("|")[0]!;
    const s = gr.get(id) ?? { sum: 0, n: 0, hwDone: 0, hw: 0 };
    if (g.score !== null) {
      s.sum += (g.score / g.scale) * 100;
      s.n++;
    }
    if (g.homework !== null) {
      s.hw++;
      if (g.homework) s.hwDone++;
    }
    gr.set(id, s);
  }
  const students: StudentStat[] = input.members.map((m) => {
    const a = att.get(m.studentId);
    const g = gr.get(m.studentId);
    return {
      studentId: m.studentId,
      name: m.name,
      attendance: a ? pct(a.came, a.marked) : null,
      average: g?.n ? Math.round(g.sum / g.n) : null,
      graded: g?.n ?? 0,
      homeworkDone: g?.hwDone ?? 0,
      homeworkMarked: g?.hw ?? 0,
    };
  });
  const ids = new Set(input.members.map((m) => m.studentId));
  const all = [...gr.entries()].filter(([id]) => ids.has(id)).map(([, s]) => s);
  const totalN = all.reduce((s, x) => s + x.n, 0);
  const attAll = [...att.entries()].filter(([id]) => ids.has(id)).map(([, a]) => a);
  const ranked = students
    .filter((s) => s.average !== null)
    .sort((a, b) => b.average! - a.average! || a.name.localeCompare(b.name));
  return {
    students,
    mastery: totalN ? Math.round(all.reduce((s, x) => s + x.sum, 0) / totalN) : null,
    attendance: pct(
      attAll.reduce((s, a) => s + a.came, 0),
      attAll.reduce((s, a) => s + a.marked, 0),
    ),
    homework: pct(
      all.reduce((s, x) => s + x.hwDone, 0),
      all.reduce((s, x) => s + x.hw, 0),
    ),
    best: ranked[0] ?? null,
    worst: ranked.length > 1 ? ranked[ranked.length - 1]! : null,
  };
}

/** O'zlashtirish darajasi (o'rtacha foizdan): a'lo ≥ 85, yaxshi ≥ 70, qoniqarli ≥ 50, past < 50 */
export type MasteryLevel = "excellent" | "good" | "fair" | "low";
export const masteryLevel = (percent: number): MasteryLevel =>
  percent >= 85 ? "excellent" : percent >= 70 ? "good" : percent >= 50 ? "fair" : "low";
