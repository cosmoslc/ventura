import { notFound } from "next/navigation";
import { z } from "zod";
import { can } from "@ventura/auth/staff/policy";
import { getTenantDb } from "@/lib/server/deps";
import { kabinetGroup } from "@/lib/server/kabinet";
import { todayTashkent } from "@/lib/server/memberships";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { GroupView, type KabinetTab } from "./group-view";

export const metadata = { title: uz.kabinet.navGroups };

const TABS: readonly KabinetTab[] = ["attendance", "grades", "students", "homework", "stats"];

/** Kabinet: o'z guruhi — Davomat, Baholash, O'quvchilar (coin berish), Statistika. Boshqa guruh — 404. */
export default async function KabinetGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const sp = await searchParams;
  const today = todayTashkent();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const data = await kabinetGroup(tenant, getTenantDb(tenant), staff.teacherId, id.data, month);
  if (!data) notFound();
  const requested = TABS.find((x) => x === sp.tab);
  const available = (tab: KabinetTab) =>
    tab === "attendance" ? !!data.attendance : tab === "grades" ? !!data.grades : true;
  const initialTab = requested && available(requested) ? requested : (TABS.find(available) ?? "students");
  return (
    <GroupView
      data={data}
      month={month}
      today={today}
      initialTab={initialTab}
      perms={{
        attendanceToday: can(staff.access, "attendance.student_mark"),
        attendancePast: can(staff.access, "attendance.student_edit_past"),
        gradesToday: can(staff.access, "grades.mark"),
        gradesPast: can(staff.access, "grades.edit_past"),
        giveCoins: can(staff.access, "bonuses.manage"),
      }}
    />
  );
}
