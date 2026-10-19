import { getTenantDb } from "@/lib/server/deps";
import { kabinetStudents } from "@/lib/server/kabinet";
import { todayTashkent } from "@/lib/server/memberships";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { StudentsView } from "./students-view";

export const metadata = { title: uz.kabinet.studentsTitle };

/** Kabinet o'quvchilari (ADR 0062): admin jadvali uslubida, faqat o'z guruhlaridagi o'quvchilar, faqat ko'rish */
export default async function KabinetStudentsPage() {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const rows = await kabinetStudents(tenant, getTenantDb(tenant), staff.teacherId, todayTashkent());
  return <StudentsView rows={rows} />;
}
