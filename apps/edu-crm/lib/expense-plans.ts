/*
 * Xarajat rejasi (limit) bajarilishi (ADR 0016) — toza funksiyalar. Haqiqiy sarf bazada saqlanmaydi: har safar shu
 * yerda xarajatlardan hisoblanadi. Rejalashtirish sahifasi va (E5) hisobotlar shu funksiyalardan oladi.
 *
 * Rejaga tushadigan xarajat: o'sha filial, o'sha toifa, sanasi rejaning oyida, bekor qilinmagan; rejada to'lov
 * usuli yoki xodim tanlangan bo'lsa — faqat shular. Eski tizimdan farqi: xodim nomi bo'yicha emas, id bo'yicha
 * solishtiriladi; "oshib ketdi" foizni yaxlitlashdan oldin aniqlanadi (eski tizimda 100,4% "100%" bo'lib sariq
 * ko'rinar edi).
 */

export interface PlanScope {
  branchId: string;
  categoryId: string;
  /** "YYYY-MM" */
  month: string;
  /** Limit, so'm (> 0) */
  amount: number;
  /** null — barcha to'lov usullari */
  methodId: string | null;
  /** ikkalasi null — barcha xodimlar */
  userId: string | null;
  teacherId: string | null;
}

export interface SpendEntry {
  branchId: string;
  categoryId: string;
  /** "YYYY-MM-DD" */
  date: string;
  amount: number;
  methodId: string;
  userId: string | null;
  teacherId: string | null;
  voided: boolean;
}

/** Sariq — limitning shu ulushidan boshlab */
export const PLAN_WARN_RATIO = 0.8;

export type PlanState = "ok" | "near" | "over";

export interface PlanUsage {
  spent: number;
  count: number;
  /** Butun foiz (100 dan oshishi mumkin) */
  percent: number;
  /** Limit − sarf; manfiy — oshib ketgan */
  remaining: number;
  state: PlanState;
}

export function planMatches(plan: PlanScope, e: SpendEntry): boolean {
  if (e.voided) return false;
  if (e.branchId !== plan.branchId || e.categoryId !== plan.categoryId) return false;
  if (e.date.slice(0, 7) !== plan.month) return false;
  if (plan.methodId && e.methodId !== plan.methodId) return false;
  if (plan.userId && e.userId !== plan.userId) return false;
  if (plan.teacherId && e.teacherId !== plan.teacherId) return false;
  return true;
}

export function planState(spent: number, limit: number): PlanState {
  if (spent > limit) return "over";
  if (limit > 0 && spent >= limit * PLAN_WARN_RATIO) return "near";
  return "ok";
}

export const percentOf = (spent: number, limit: number) => (limit > 0 ? Math.round((spent * 100) / limit) : 0);

export function planUsage(plan: PlanScope, entries: readonly SpendEntry[]): PlanUsage {
  let spent = 0;
  let count = 0;
  for (const e of entries) {
    if (!planMatches(plan, e)) continue;
    spent += e.amount;
    count++;
  }
  return {
    spent,
    count,
    percent: percentOf(spent, plan.amount),
    remaining: plan.amount - spent,
    state: planState(spent, plan.amount),
  };
}

/** Ko'rsatilgan rejalar bo'yicha jami: limit, sarf va umumiy foiz */
export function plansTotal(rows: readonly { amount: number; usage: PlanUsage }[]) {
  const planned = rows.reduce((s, r) => s + r.amount, 0);
  const spent = rows.reduce((s, r) => s + r.usage.spent, 0);
  return { planned, spent, percent: percentOf(spent, planned), state: planState(spent, planned) };
}
