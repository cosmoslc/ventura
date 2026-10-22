import { getTenantDb } from "@/lib/server/deps";
import { kabinetGroups, kabinetHomeworks } from "@/lib/server/kabinet";
import { todayTashkent } from "@/lib/server/memberships";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { TeacherHomeworksView } from "./homeworks-view";

export const metadata = { title: "Uy ishlari · Kabinet" };

/**
 * O'qituvchi kabineti: Uy ishlari sahifasi (ADR 0063).
 * Barcha guruhlar bo'yicha berilgan topshiriqlar, guruh filtri va yangi vazifa berish.
 * Muallif / Agent: Google Gemini
 */
export default async function KabinetHomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const sp = await searchParams;
  const db = getTenantDb(tenant);
  const [groups, homeworks] = await Promise.all([
    kabinetGroups(db, staff.teacherId),
    kabinetHomeworks(db, staff.teacherId, sp.groupId),
  ]);
  const today = todayTashkent();

  return (
    <TeacherHomeworksView
      groups={groups}
      homeworks={homeworks}
      selectedGroupId={sp.groupId}
      today={today}
    />
  );
}
