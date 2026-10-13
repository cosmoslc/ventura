import "server-only";
import { and, desc, gte, like, lt, or } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { auditEvents } from "@ventura/db/schema/tenant";
import { MONEY_GROUPS, type MoneyGroup } from "@/lib/money-audit";

/*
 * Pul amallari tarixi (ADR 0019): faoliyat jurnalidan (xesh zanjiri bilan himoyalangan, ADR 0002) to'lov, chegirma,
 * xarajat, qo'shimcha daromad, ish haqi va tasdiq so'rovlari bilan bog'liq yozuvlar. Alohida jadval yo'q — jurnal
 * yagona manba. Eski tizimda bunday sahifa umuman yo'q edi.
 */

const PREFIXES: Record<MoneyGroup, readonly string[]> = {
  payment: ["payment.", "discount."],
  expense: ["expense.", "expense_plan."],
  additional_income: ["additional_income."],
  salary_entry: ["salary_entry."],
  approval: ["approval."],
};

export interface MoneyAuditRow {
  id: string;
  at: string;
  actorName: string | null;
  action: string;
  group: MoneyGroup;
  /** Amal fe'li (create, void, refund...) */
  verb: string;
  amount: number | null;
  /** Qisqa tafsilot: sana, oy, sabab, izoh, nom */
  details: string;
}

const groupOf = (action: string): MoneyGroup =>
  MONEY_GROUPS.find((g) => PREFIXES[g].some((p) => action.startsWith(p))) ?? "payment";

function detailsOf(m: Record<string, unknown>): string {
  const parts: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string" && v) parts.push(v.slice(0, 120));
  };
  add(m.title);
  add(m.name);
  add(m.kind);
  add(m.month);
  add(m.date);
  add(m.reason);
  add(m.voidReason);
  add(m.note);
  add(m.error);
  return parts.join(" · ");
}

/** Toshkent kunlari bo'yicha [from, to] (ikkalasi ham kiradi) */
export async function listMoneyAudit(db: TenantDb, range: { from: string; to: string }): Promise<MoneyAuditRow[]> {
  const start = new Date(`${range.from}T00:00:00+05:00`);
  const end = new Date(new Date(`${range.to}T00:00:00+05:00`).getTime() + 86_400_000);
  const prefixes = MONEY_GROUPS.flatMap((g) => PREFIXES[g]);
  const rows = await db
    .select({
      id: auditEvents.id,
      at: auditEvents.at,
      actorName: auditEvents.actorName,
      action: auditEvents.action,
      metadata: auditEvents.metadata,
    })
    .from(auditEvents)
    .where(
      and(
        gte(auditEvents.at, start),
        lt(auditEvents.at, end),
        or(...prefixes.map((p) => like(auditEvents.action, `${p}%`))),
      ),
    )
    .orderBy(desc(auditEvents.seq))
    .limit(5000);
  return rows.map((r) => {
    const m = r.metadata ?? {};
    const before = (m.before ?? null) as Record<string, unknown> | null;
    const after = (m.after ?? null) as Record<string, unknown> | null;
    const amount =
      typeof m.amount === "number"
        ? m.amount
        : typeof after?.amount === "number"
          ? after.amount
          : typeof before?.amount === "number"
            ? before.amount
            : null;
    return {
      id: r.id,
      at: r.at.toISOString(),
      actorName: r.actorName,
      action: r.action,
      group: groupOf(r.action),
      verb: r.action.split(".").pop() ?? r.action,
      amount,
      details: detailsOf({ ...(after ?? {}), ...m }),
    };
  });
}
