import { can } from "@ventura/auth/staff/policy";
import { getTenantDb } from "@/lib/server/deps";
import { getGradingSettings } from "@/lib/server/grades";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { GradingSettingsView } from "./grading-view";

export const metadata = { title: uz.gradingSettings.title };

/** Baholash shkalasi (ADR 0061): 5, 10 yoki 100 ballik */
export default async function GradingSettingsPage() {
  const { tenant, staff } = await requirePage("grades", "/grading");
  const settings = await getGradingSettings(getTenantDb(tenant));
  return <GradingSettingsView settings={settings} canEdit={can(staff.access, "settings.courses")} />;
}
