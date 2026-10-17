import { type LedgerEntry, type LedgerSummary, cash } from "./ledger";

/*
 * Guruh profili uchun sof hisoblar (ADR 0047): a'zoning shu guruh bo'yicha puli va davomati, ro'yxatni
 * filtrlash/saralash, guruh tugash sanasi. Ma'lumot serverda yig'iladi (groups/data.ts), bu yerda faqat mantiq.
 */

/** A'zoning shu guruh bo'yicha puli (o'quvchi hisobidan) */
export interface MemberMoney {
  /** Yopilmagan oylar qoldig'i (barcha oylar) */
  due: number;
  /** Nechta oy yopilmagan */
  dueMonths: number;
  /** Shu oyga hisoblangan */
  monthCharged: number;
  /** Shu oydan yopilmagan qismi */
  monthDue: number;
  /** Shu oy belgisi bilan shu guruhga kelgan naqd pul (to'lov − qaytarish) */
  collected: number;
}

export function memberMoney(
  summary: Pick<LedgerSummary, "groups">,
  entries: readonly Pick<LedgerEntry, "kind" | "amount" | "groupId" | "month">[],
  groupId: string,
  month: string,
): MemberMoney {
  const months = summary.groups.find((g) => g.groupId === groupId)?.months ?? [];
  const open = months.filter((m) => m.due > 0);
  const current = months.filter((m) => m.month === month);
  return {
    due: open.reduce((s, m) => s + m.due, 0),
    dueMonths: new Set(open.map((m) => m.month)).size,
    monthCharged: current.reduce((s, m) => s + m.amount, 0),
    monthDue: current.reduce((s, m) => s + m.due, 0),
    collected: entries.filter((e) => e.groupId === groupId && e.month === month).reduce((s, e) => s + cash(e), 0),
  };
}

export type MonthState = "none" | "paid" | "partial" | "unpaid";

/** Shu oy holati: hisoblanmagan (sinov, muzlatilgan, bepul) / to'langan / qisman / to'lanmagan */
export function monthState(m: Pick<MemberMoney, "monthCharged" | "monthDue">): MonthState {
  if (m.monthCharged <= 0) return "none";
  if (m.monthDue <= 0) return "paid";
  return m.monthDue < m.monthCharged ? "partial" : "unpaid";
}

export interface AttendanceStat {
  came: number;
  marked: number;
  /** Foiz; belgilangan dars bo'lmasa null */
  rate: number | null;
}

/**
 * Davomat foizi: `from` dan keyingi belgilangan darslardan nechtasiga kelgan (bor + kech). Belgisiz kun hisobga
 * kirmaydi — jurnal (attendance-tab) bilan bir xil qoida.
 */
export function attendanceStat(marks: readonly { date: string; status: string }[], from: string): AttendanceStat {
  const own = marks.filter((m) => m.date >= from);
  const came = own.filter((m) => m.status === "present" || m.status === "late").length;
  return { came, marked: own.length, rate: own.length ? Math.round((came / own.length) * 100) : null };
}

/** Sanadan `days` kun oldin ("YYYY-MM-DD") */
export function daysAgo(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! - days)).toISOString().slice(0, 10);
}

/** Oy qo'shish: kun oyning oxiridan oshsa, oxirgi kuniga tushadi (31-yan + 1 oy = 28/29-fev) */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m! - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y!, m! - 1 + n, Math.min(d!, last))).toISOString().slice(0, 10);
}

/** Guruh tugash sanasi: boshlanishdan `durationMonths` oy keyin, oxirgi dars kuni emas, kurs davri tugaydigan kun */
export function groupEndDate(startDate: string, durationMonths: number): string {
  return daysAgo(addMonths(startDate, durationMonths), 1);
}

/** Dars davomiyligi, daqiqa ("15:00", "16:30" → 90) */
export function lessonMinutes(start: string, end: string): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(end) - m(start);
}

export type MemberFilter = "all" | "active" | "trial" | "paused" | "debt";
export type MemberSort = "name" | "debt" | "joined" | "attendance";

export interface SortableMember {
  name: string;
  status: "trial" | "active" | "paused" | "left";
  enrolledAt: string;
  /** Pul ma'lumoti yo'q bo'lsa 0 */
  due: number;
  rate: number | null;
}

export function matchesFilter(m: Pick<SortableMember, "status" | "due">, filter: MemberFilter): boolean {
  if (filter === "all") return true;
  if (filter === "debt") return m.due > 0;
  return m.status === filter;
}

/** Saralash: qarz — ko'pi birinchi; davomat — pasti birinchi (e'tibor kerak), foizsizlar oxirida; qo'shilgan — yangisi birinchi */
export function compareMembers(sort: MemberSort): (a: SortableMember, b: SortableMember) => number {
  const byName = (a: SortableMember, b: SortableMember) => a.name.localeCompare(b.name);
  switch (sort) {
    case "debt":
      return (a, b) => b.due - a.due || byName(a, b);
    case "joined":
      return (a, b) => b.enrolledAt.localeCompare(a.enrolledAt) || byName(a, b);
    case "attendance":
      return (a, b) => (a.rate ?? 101) - (b.rate ?? 101) || byName(a, b);
    default:
      return byName;
  }
}

/** Yig'ilgan ulush, 0–100 */
export function collectedPercent(charged: number, collected: number): number {
  return charged > 0 ? Math.max(0, Math.min(100, Math.round((collected / charged) * 100))) : 0;
}
