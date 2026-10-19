import { recentMonths } from "@/lib/format";
import { getTenantDb } from "@/lib/server/deps";
import { kabinetStats } from "@/lib/server/kabinet";
import { todayTashkent } from "@/lib/server/memberships";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { StatsView } from "./stats-view";

export const metadata = { title: uz.kabinet.statsTitle };

/** Kabinet statistikasi (ADR 0062): oy bo'yicha (`?oy=`) — faqat o'z guruhlari va o'z hisobi */
export default async function KabinetStatsPage({ searchParams }: { searchParams: Promise<{ oy?: string }> }) {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const today = todayTashkent();
  const months = recentMonths(today);
  const { oy } = await searchParams;
  const month = months.find((m) => m === oy) ?? months[0]!;
  const stats = await kabinetStats(tenant, getTenantDb(tenant), staff.teacherId, month, today);
  return <StatsView stats={stats} month={month} months={months} />;
}
