import { uz } from "@/lib/uz";

const k = uz.reports.leaves;

/** Muddat: 30 kundan kam — kun, aks holda to'liq oylar */
export const durationLabel = (days: number) =>
  days >= 30 ? k.durationMonths(Math.floor(days / 30)) : k.durationDays(days);

export const pct1 = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
