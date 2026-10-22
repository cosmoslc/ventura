import { notFound } from "next/navigation";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { portalDashboardData } from "@/lib/server/portal";
import { requireStudent, requireTenant } from "@/lib/server/session";
import { PortalDashboardView } from "./dashboard-view";

export const metadata = { title: "Bosh sahifa — O'quvchi portali" };

/**
 * O'quvchi kabineti bosh sahifasi (ADR 0063).
 * Muallif / Agent: Google Gemini
 */
export default async function PortalDashboardPage() {
  const tenant = await requireTenant();
  const staff = await requireStudent();
  const db = getTenantDb(tenant);
  const today = todayTashkent();

  const data = await portalDashboardData(db, staff.studentId, today);
  if (!data) notFound();

  return <PortalDashboardView data={data} />;
}
