import { getTenantDb } from "@/lib/server/deps";
import { monthStart, todayTashkent } from "@/lib/server/memberships";
import { listMoneyAudit } from "@/lib/server/money-audit";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { MoneyAuditView } from "./money-audit-view";

export const metadata = { title: uz.moneyAudit.title };

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** Pul amallari tarixi — faqat direktor (lib/access.ts da ruxsat ro'yxati yo'q), "To'lovlar" bo'limi bilan */
export default async function MoneyAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { tenant } = await requirePage("payments", "/money-audit");
  const today = todayTashkent();
  const sp = await searchParams;
  let from = isDay(sp.from) ? sp.from : monthStart(today);
  let to = isDay(sp.to) ? sp.to : today;
  const rangeInvalid = from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 366;
  if (rangeInvalid) [from, to] = [monthStart(today), today];
  const rows = await listMoneyAudit(getTenantDb(tenant), { from, to });
  return <MoneyAuditView rows={rows} from={from} to={to} rangeInvalid={rangeInvalid} />;
}
