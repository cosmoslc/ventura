import "server-only";
import { eq } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/tenant";
import type { DayFlow } from "@/lib/dashboard";
import {
  type BalanceStream,
  OPENING_BALANCE_KEY,
  type OpeningBalances,
  parseOpeningBalances,
} from "@/lib/opening-balance";
import { loadFlows } from "./dashboard";

/*
 * Boshlang'ich qoldiq (E6j, ADR 0038): `settings` jadvalida `finance.opening_balance` kaliti ostida, filial → { amount, date }.
 * Pul oqimi hisobotidagi yig'ma qoldiq shundan boshlanadi.
 */

export async function getOpeningBalances(db: TenantDb): Promise<OpeningBalances> {
  const [row] = await db.select().from(settings).where(eq(settings.key, OPENING_BALANCE_KEY));
  return parseOpeningBalances(row?.value);
}

const keyOf = (f: DayFlow) => `${f.date}|${f.kind}|${f.category ?? ""}`;

/** Umumiy harakatlardan filiallarniki ayirilgan qoldiq (filialsiz yozuvlar ham saqlanadi) */
function without(all: readonly DayFlow[], parts: readonly (readonly DayFlow[])[]): DayFlow[] {
  const taken = new Map<string, { amount: number; count: number }>();
  for (const f of parts.flat()) {
    const t = taken.get(keyOf(f)) ?? { amount: 0, count: 0 };
    taken.set(keyOf(f), { amount: t.amount + f.amount, count: t.count + f.count });
  }
  return all
    .map((f) => {
      const t = taken.get(keyOf(f));
      return t ? { ...f, amount: f.amount - t.amount, count: f.count - t.count } : f;
    })
    .filter((f) => f.amount !== 0 || f.count !== 0);
}

/**
 * Yig'ma qoldiq uchun oqimlar: qoldig'i bor har filial alohida (sanasidan oldingi harakatlar qoldiqqa kirgan), qolgan
 * filiallar birgalikda. Xodim ko'rayotgan filiallardan birortasida qoldiq yo'q bo'lsa — bo'sh ro'yxat (hisob oldingidek).
 * `all` — hisobotning o'zi ishlatgan, filtr bo'yicha yuklangan harakatlar.
 */
export async function balanceStreams(
  db: TenantDb,
  filter: readonly string[] | null,
  openings: OpeningBalances,
  all: readonly DayFlow[],
): Promise<BalanceStream[]> {
  const withOpening = Object.keys(openings).filter((id) => !filter || filter.includes(id));
  if (!withOpening.length) return [];
  const own = await Promise.all(withOpening.map((id) => loadFlows(db, [id])));
  return [
    ...withOpening.map((id, i) => ({ opening: openings[id]!, flows: own[i]! })),
    { opening: null, flows: without(all, own) },
  ];
}
