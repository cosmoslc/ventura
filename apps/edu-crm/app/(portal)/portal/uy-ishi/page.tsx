import { getTenantDb } from "@/lib/server/deps";
import { portalStudentHomeworks } from "@/lib/server/portal";
import { requireStudent, requireTenant } from "@/lib/server/session";
import { PortalHomeworkView } from "./homework-view";
import { uz } from "@/lib/uz";

export const metadata = { title: uz.portal.uyVazifalariOquvchiPortali };

/**
 * O'quvchi uy vazifalari sahifasi (ADR 0063).
 * Muallif / Agent: Google Gemini
 */
export default async function PortalHomeworkPage() {
  const tenant = await requireTenant();
  const staff = await requireStudent();
  const db = getTenantDb(tenant);

  const items = await portalStudentHomeworks(db, staff.studentId);

  return <PortalHomeworkView items={items} />;
}
