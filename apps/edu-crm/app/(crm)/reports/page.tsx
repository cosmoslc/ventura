import { redirect } from "next/navigation";
import { visibleReports } from "@/lib/server/reports";
import { requirePage } from "@/lib/server/session";

/**
 * /reports manzili to'g'ridan-to'g'ri birinchi hisobotga (masalan /reports/cashflow) yo'naltiradi.
 */
export default async function ReportsPage() {
  const { tenant, staff } = await requirePage("reports", "/reports");
  const visible = await visibleReports(tenant, staff.access);
  const first = visible[0] ?? "cashflow";
  redirect(`/reports/${first}`);
}
