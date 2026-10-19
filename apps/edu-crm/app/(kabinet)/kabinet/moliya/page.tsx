import { recentMonths } from "@/lib/format";
import { getTenantDb } from "@/lib/server/deps";
import { kabinetFinance } from "@/lib/server/kabinet";
import { todayTashkent } from "@/lib/server/memberships";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { FinanceView } from "./finance-view";

export const metadata = { title: uz.kabinet.financeTitle };

/** Kabinet moliyasi (ADR 0062): o'z oy hisobi — Ish haqi bo'limi bilan bir manba, faqat ko'rish */
export default async function KabinetFinancePage({ searchParams }: { searchParams: Promise<{ oy?: string }> }) {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const today = todayTashkent();
  const months = recentMonths(today);
  const { oy } = await searchParams;
  const month = months.find((m) => m === oy) ?? months[0]!;
  const data = await kabinetFinance(tenant, getTenantDb(tenant), staff.teacherId, month, today);
  return <FinanceView data={data} month={month} months={months} />;
}
