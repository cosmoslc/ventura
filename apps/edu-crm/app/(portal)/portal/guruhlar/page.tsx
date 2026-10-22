import { getTenantDb } from "@/lib/server/deps";
import { portalStudentGroups } from "@/lib/server/portal";
import { requireStudent, requireTenant } from "@/lib/server/session";
import { PortalGroupsView } from "./groups-view";

export const metadata = { title: "Mening guruhlarim — O'quvchi portali" };

/**
 * O'quvchi guruhlari sahifasi (ADR 0063).
 * Muallif / Agent: Google Gemini
 */
export default async function PortalGroupsPage() {
  const tenant = await requireTenant();
  const staff = await requireStudent();
  const db = getTenantDb(tenant);

  const groups = await portalStudentGroups(db, staff.studentId);

  return <PortalGroupsView groups={groups} />;
}
