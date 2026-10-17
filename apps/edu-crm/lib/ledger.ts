import type { MonthCharge } from "./billing";

/*
 * O'quvchi hisobi (ADR 0015): yagona balans = to'lovlar + chegirmalar ± tuzatishlar − qaytarishlar − oylik
 * hisoblar. Qarz oydan oyga yig'iladi, ortiqcha to'lov keyingi oylarga o'tadi (eski tizimda faqat joriy oy
 * ko'rinar, ortiqcha to'lov yo'qolar edi).
 *
 * Oylar bo'yicha holat (ko'rsatish uchun) — eng eski oydan to'ldiriladi:
 *  1) har guruhga belgilangan to'lovlar avval o'sha guruh oylarini yopadi;
 *  2) qolgan pul (guruhsiz to'lovlar, guruhlardagi ortiqcha) qolgan oylarni oy tartibida yopadi.
 * Natija har doim balans bilan mos: yopilmagan oylar yig'indisi + boshqa qarz = max(0, −balans).
 */

export type EntryKind = "payment" | "refund" | "discount" | "correction" | "writeoff";

export interface LedgerEntry {
  id: string;
  kind: EntryKind;
  /** payment/refund/discount — musbat; correction — ishorali (+ kredit, − qarz) */
  amount: number;
  groupId: string | null;
  /** Qaysi oy uchun (to'lov) — "YYYY-MM" */
  month: string | null;
  date: string;
}

/** Hisobga ta'siri: + o'quvchi foydasiga */
export function signed(e: Pick<LedgerEntry, "kind" | "amount">): number {
  switch (e.kind) {
    case "payment":
    case "discount":
    case "writeoff":
      return e.amount;
    case "refund":
      return -e.amount;
    case "correction":
      return e.amount;
  }
}

/** Naqd pul harakati (kassa): to'lov +, qaytarish −; chegirma, tuzatish va kechilgan qarz — pul emas */
export function cash(e: Pick<LedgerEntry, "kind" | "amount">): number {
  return e.kind === "payment" ? e.amount : e.kind === "refund" ? -e.amount : 0;
}

export interface MonthStatus extends MonthCharge {
  covered: number;
  due: number;
  status: "paid" | "partial" | "unpaid" | "free";
}

export interface GroupLedger {
  groupId: string;
  charged: number;
  /** Shu guruhga belgilangan yozuvlar (ishorali) */
  credited: number;
  /** credited − charged */
  balance: number;
  months: MonthStatus[];
}

export interface LedgerSummary {
  charged: number;
  credited: number;
  /** credited − charged; manfiy — qarz */
  balance: number;
  debt: number;
  /** Oylarga bog'lanmagan qarz (masalan, ortiqcha qaytarish yoki manfiy tuzatish) */
  otherDebt: number;
  groups: GroupLedger[];
  /** Eng eski yopilmagan oy */
  oldestUnpaid: string | null;
}

export function summarize(charges: readonly MonthCharge[], entries: readonly LedgerEntry[]): LedgerSummary {
  const charged = charges.reduce((s, c) => s + c.amount, 0);
  const credited = entries.reduce((s, e) => s + signed(e), 0);

  const groupIds = [
    ...new Set([...charges.map((c) => c.groupId), ...entries.flatMap((e) => (e.groupId ? [e.groupId] : []))]),
  ];
  const byMonth = (a: MonthCharge, b: MonthCharge) => a.month.localeCompare(b.month);
  const statuses = new Map<string, MonthStatus>();
  const keyOf = (c: MonthCharge) => `${c.membershipId}|${c.month}`;
  for (const c of charges) statuses.set(keyOf(c), { ...c, covered: 0, due: c.amount, status: "unpaid" });

  // 1) Har guruh o'z to'lovlari bilan
  let pool = entries.filter((e) => !e.groupId).reduce((s, e) => s + signed(e), 0);
  const groups: GroupLedger[] = [];
  for (const groupId of groupIds) {
    const own = charges.filter((c) => c.groupId === groupId).sort(byMonth);
    const groupCredited = entries.filter((e) => e.groupId === groupId).reduce((s, e) => s + signed(e), 0);
    let left = Math.max(0, groupCredited);
    for (const c of own) {
      const st = statuses.get(keyOf(c))!;
      const take = Math.min(left, st.due);
      st.covered += take;
      st.due -= take;
      left -= take;
    }
    // Ortiqcha (yoki manfiy kredit) umumiy hovuzga
    pool += groupCredited - (Math.max(0, groupCredited) - left);
    const groupCharged = own.reduce((s, c) => s + c.amount, 0);
    groups.push({
      groupId,
      charged: groupCharged,
      credited: groupCredited,
      balance: groupCredited - groupCharged,
      months: [],
    });
  }

  // 2) Qolgan pul — barcha guruhlarning yopilmagan oylariga, oy tartibida
  const open = [...statuses.values()]
    .filter((s) => s.due > 0)
    .sort((a, b) => a.month.localeCompare(b.month) || a.groupId.localeCompare(b.groupId));
  if (pool > 0) {
    for (const st of open) {
      if (pool <= 0) break;
      const take = Math.min(pool, st.due);
      st.covered += take;
      st.due -= take;
      pool -= take;
    }
  }

  for (const st of statuses.values()) {
    st.status = st.amount === 0 ? "free" : st.due === 0 ? "paid" : st.covered > 0 ? "partial" : "unpaid";
  }
  for (const g of groups) {
    g.months = [...statuses.values()]
      .filter((s) => s.groupId === g.groupId)
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  const balance = credited - charged;
  const monthDue = [...statuses.values()].reduce((s, st) => s + st.due, 0);
  const debt = Math.max(0, -balance);
  const oldest = [...statuses.values()].filter((s) => s.due > 0).sort((a, b) => a.month.localeCompare(b.month))[0];
  return {
    charged,
    credited,
    balance,
    debt,
    otherDebt: Math.max(0, debt - monthDue),
    groups,
    oldestUnpaid: oldest?.month ?? null,
  };
}

/** Joriy oydan oldingi oylardagi to'lanmagan qoldiq — profildagi "O'tgan oydan qarz" kartasi */
export function pastDebt(summary: LedgerSummary, currentMonth: string): { amount: number; months: string[] } {
  const months = summary.groups.flatMap((g) => g.months).filter((m) => m.month < currentMonth && m.due > 0);
  return {
    amount: months.reduce((s, m) => s + m.due, 0),
    months: [...new Set(months.map((m) => m.month))].sort(),
  };
}

/** Guruh uchun to'lov formasida taklif qilinadigan oy: eng eski yopilmagan oy, bo'lmasa joriy oy */
export function suggestedMonth(summary: LedgerSummary, groupId: string, currentMonth: string): string {
  const g = summary.groups.find((x) => x.groupId === groupId);
  return g?.months.find((m) => m.due > 0)?.month ?? currentMonth;
}

/** Guruh bo'yicha to'lanishi kerak bo'lgan summa: yopilmagan oylar (umumiy balansdagi pul hisobga olingan) */
export function suggestedAmount(summary: LedgerSummary, groupId: string): number {
  const g = summary.groups.find((x) => x.groupId === groupId);
  return g ? g.months.reduce((s, m) => s + m.due, 0) : 0;
}

/**
 * Eng eski yopilmagan oy muddatidan necha kun o'tgan: muddat — o'sha oyning `dueDay`-sanasi (sozlamada,
 * eski tizimda 10 qattiq yozilgan edi). Muddat kelmagan bo'lsa 0.
 */
export function overdueDays(oldestUnpaid: string | null, dueDay: number, today: string): number {
  if (!oldestUnpaid) return 0;
  const due = `${oldestUnpaid}-${String(dueDay).padStart(2, "0")}`;
  if (today <= due) return 0;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86_400_000);
}

/**
 * Guruh bo'yicha haqiqiy qarz (guruhdan chiqarish, ADR 0050): shu guruh oylarining yopilmagan qismi, lekin umumiy
 * qarzdan ko'p emas (boshqa guruhdagi ortiqcha pul avval shu qarzni yopgan bo'ladi).
 */
export function groupDebt(summary: Pick<LedgerSummary, "balance" | "groups">, groupId: string): number {
  const g = summary.groups.find((x) => x.groupId === groupId);
  const due = g ? g.months.reduce((s, m) => s + m.due, 0) : 0;
  return Math.max(0, Math.min(due, -summary.balance));
}
