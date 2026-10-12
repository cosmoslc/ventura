import { type MemberPeriod, markable } from "./lessons";

/*
 * Davomat hisoboti (eski tizimdagi "Kelmaganlar" sahifasi, ADR 0014) — bitta o'quvchining bitta guruhdagi
 * ko'rsatkichlari. Eski tizimdan farqi: "belgilanmagan" dars taqvimidan hisoblanadi (eski tizim davomat qatori
 * umuman yo'q kunni sanamas edi), muzlatilgan va guruhga hali qo'shilmagan kunlar sanalmaydi.
 */

export type MarkStatus = "present" | "late" | "excused" | "absent";

export interface ReportMark {
  status: MarkStatus;
  reason: string | null;
}

export interface ReportInput {
  /** Guruhning tarix boshidan `to` gacha dars sanalari (o'sish tartibida, bayramlarsiz) */
  lessonDates: readonly string[];
  periods: readonly MemberPeriod[];
  /** sana → belgi */
  marks: ReadonlyMap<string, ReportMark>;
  /** Bog'lanish (qo'ng'iroq, ota-ona bilan suhbat) sanalari */
  contacts: readonly string[];
  from: string;
  to: string;
  today: string;
}

export interface ReportStats {
  /** Davrdagi darslar (o'quvchi shu kuni guruhda va muzlatilmagan) */
  lessons: number;
  present: number;
  late: number;
  /** Qoldirgan: sababsiz + sababli */
  missed: number;
  excused: number;
  unmarked: number;
  /** (bor + kech) / belgilangan; belgilanmagan dars foizni tushirmaydi */
  rate: number | null;
  /** Oxirgi o'tgan dars (`to` gacha) va undagi belgi; null — belgilanmagan */
  previous: { date: string; status: MarkStatus | null } | null;
  /** Oxirgi qoldirilgan dars — sabab shu belgiga yoziladi */
  lastMissed: { date: string; status: MarkStatus; reason: string | null } | null;
  /** Ketma-ket qoldirgan darslar (oxirgi belgidan orqaga, belgilanmaganlar o'tkazib yuboriladi) */
  consecutive: number;
  /** Shu oyda (bugungi oy) qoldirgan */
  missedThisMonth: number;
  /** Oxirgi qoldirilgan darsdan keyin bog'lanilgan; qoldirmagan bo'lsa — true */
  contacted: boolean;
}

export const isMissed = (s: MarkStatus | null | undefined) => s === "absent" || s === "excused";

export function studentStats(input: ReportInput): ReportStats {
  const { periods, marks, from, to, today } = input;
  const until = to < today ? to : today;
  const month = today.slice(0, 7);
  const days = input.lessonDates.filter((d) => d <= until && markable(periods, d));

  let lessons = 0;
  let present = 0;
  let late = 0;
  let missed = 0;
  let excused = 0;
  let unmarked = 0;
  for (const d of days) {
    if (d < from) continue;
    lessons++;
    const m = marks.get(d);
    if (!m) unmarked++;
    else if (m.status === "present") present++;
    else if (m.status === "late") late++;
    else {
      missed++;
      if (m.status === "excused") excused++;
    }
  }

  // Belgi bor, lekin dars ro'yxatida yo'q kun (keyin bayram qo'shilgan) ham tarixda hisobga olinadi
  const marked = [...marks.entries()].filter(([d]) => d <= until).sort(([a], [b]) => a.localeCompare(b));
  const last = days.at(-1);
  const previous = last ? { date: last, status: marks.get(last)?.status ?? null } : null;

  let lastMissed: ReportStats["lastMissed"] = null;
  for (let i = marked.length - 1; i >= 0; i--) {
    const [date, m] = marked[i]!;
    if (isMissed(m.status)) {
      lastMissed = { date, status: m.status, reason: m.reason };
      break;
    }
  }

  let consecutive = 0;
  for (let i = marked.length - 1; i >= 0; i--) {
    if (isMissed(marked[i]![1].status)) consecutive++;
    else break;
  }

  const missedThisMonth = marked.filter(([d, m]) => d.startsWith(month) && isMissed(m.status)).length;
  const contacted = !lastMissed || input.contacts.some((d) => d >= lastMissed.date);
  const markedCount = present + late + missed;

  return {
    lessons,
    present,
    late,
    missed,
    excused,
    unmarked,
    rate: markedCount ? Math.round(((present + late) / markedCount) * 100) : null,
    previous,
    lastMissed,
    consecutive,
    missedThisMonth,
    contacted,
  };
}

/** Holat filtri va KPI kartalari (eski tizimdagidek) */
export const REPORT_FILTERS = ["absent", "present", "unmarked", "risk", "uncontacted", "all"] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];

export function matchesFilter(s: ReportStats, f: ReportFilter): boolean {
  switch (f) {
    case "absent":
      return s.missed >= 1;
    case "present":
      return s.present + s.late >= 1;
    case "unmarked":
      return s.unmarked >= 1;
    case "risk":
      return s.consecutive >= 3 || s.missed >= 3;
    case "uncontacted":
      return s.missed >= 1 && !s.contacted;
    case "all":
      return true;
  }
}
