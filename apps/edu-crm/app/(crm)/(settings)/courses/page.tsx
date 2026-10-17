import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { CoursesView } from "./courses-view";
import { listCourses } from "./data";

export const metadata = { title: uz.courses.title };

export default async function CoursesPage() {
  const { tenant, staff } = await requirePage("courses", "/courses");
  const branch = await getBranchContext();
  const rows = await listCourses(getTenantDb(tenant), branch);
  return (
    <CoursesView
      rows={rows}
      branches={branch.options}
      selectedBranch={branch.selected}
      canWrite={can(staff.access, "settings.courses")}
    />
  );
}
