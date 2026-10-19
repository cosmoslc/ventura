import { getTenantDb } from "@/lib/server/deps";
import { kabinetGroups } from "@/lib/server/kabinet";
import { todayTashkent } from "@/lib/server/memberships";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { parseWeek } from "@/lib/kabinet-week";
import { uz } from "@/lib/uz";
import { GroupsView } from "./groups-view";

export const metadata = { title: uz.kabinet.navGroups };

/** Kabinet guruhlari (ADR 0062): haftalik jadval (`?hafta=`) va ro'yxat — faqat o'z guruhlari */
export default async function KabinetGroupsPage({ searchParams }: { searchParams: Promise<{ hafta?: string }> }) {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const today = todayTashkent();
  const monday = parseWeek((await searchParams).hafta, today);
  const groups = await kabinetGroups(getTenantDb(tenant), staff.teacherId);
  return <GroupsView groups={groups} monday={monday} today={today} />;
}
