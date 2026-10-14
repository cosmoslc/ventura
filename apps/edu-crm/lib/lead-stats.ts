import { type Range, inRange, monthRange } from "./dashboard";

/*
 * Bosh paneldagi lid kartalari (E4d, ADR 0027) — toza funksiyalar, Vitest bilan. Eski tizimdagi DashboardHome
 * leadStats bilan bir xil ma'no, lekin bosqichlar tarixiga tayanadi:
 *  - yangi lidlar — davrda qo'shilgan (arxivdagilar kirmaydi);
 *  - konversiya — davrda qo'shilganlardan hozir "O'quvchi bo'ldi" bosqichidagilar ulushi;
 *  - eng ko'p yo'qotilgan bosqich — davr lidlaridan yo'qotilganlar qaysi bosqichdan ketgani (eski tizim voronkadagi
 *    eng katta tushishni taxmin qilar edi; bu yerda bosqich aniq yozilgan);
 *  - birinchi to'lov — o'quvchiga aylanganlardan kamida bitta to'lov qilganlar.
 */

export interface LeadStatRow {
  /** Qo'shilgan kun (Toshkent) */
  date: string;
  source: string | null;
  kind: "open" | "won" | "lost";
  lostFromStageId: string | null;
  /** O'quvchiga aylangan va to'lov qilgan */
  paid: boolean;
}

export interface LeadStats {
  count: number;
  prevCount: number | null;
  /** 12 oy (berilgan oylar tartibida) */
  spark: number[];
  sources: [string, number][];
  /** Foiz; davrda lid bo'lmasa null */
  conv: number | null;
  prevConv: number | null;
  converted: number;
  firstPaid: number;
  lostTop: { stageId: string; count: number; pct: number } | null;
}

const OTHER_SOURCE = "Boshqa";

const conversion = (list: readonly LeadStatRow[]) =>
  list.length ? (list.filter((l) => l.kind === "won").length / list.length) * 100 : null;

export function leadStats(
  rows: readonly LeadStatRow[],
  period: { cur: Range; prev: Range },
  months: readonly string[],
): LeadStats {
  const cur = rows.filter((r) => inRange(r.date, period.cur));
  const prev = period.prev ? rows.filter((r) => inRange(r.date, period.prev)) : null;

  const sources = new Map<string, number>();
  for (const r of cur) {
    const s = r.source?.trim() || OTHER_SOURCE;
    sources.set(s, (sources.get(s) ?? 0) + 1);
  }

  const lostBy = new Map<string, number>();
  for (const r of cur)
    if (r.kind === "lost" && r.lostFromStageId) lostBy.set(r.lostFromStageId, (lostBy.get(r.lostFromStageId) ?? 0) + 1);
  const top = [...lostBy].sort((a, b) => b[1] - a[1])[0];

  const won = cur.filter((r) => r.kind === "won");
  return {
    count: cur.length,
    prevCount: prev ? prev.length : null,
    spark: months.map((m) => rows.filter((r) => inRange(r.date, monthRange(m))).length),
    sources: [...sources].sort((a, b) => b[1] - a[1]),
    conv: conversion(cur),
    prevConv: prev ? conversion(prev) : null,
    converted: won.length,
    firstPaid: won.filter((r) => r.paid).length,
    lostTop: top ? { stageId: top[0], count: top[1], pct: (top[1] / cur.length) * 100 } : null,
  };
}
