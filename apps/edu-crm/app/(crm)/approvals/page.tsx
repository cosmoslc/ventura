import { redirect } from "next/navigation";
import { PERMISSION_CATEGORIES } from "@ventura/auth/staff/policy";
import { listApprovalRequests } from "@/lib/server/approvals";
import { getTenantDb } from "@/lib/server/deps";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ApprovalsView } from "./approvals-view";

export const metadata = { title: uz.approvals.titleDirector };

const PERMISSION_NAMES: Record<string, string> = Object.fromEntries(
  PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => [p.id, p.name])),
);

/**
 * Tasdiqlar (ADR 0019): direktorga — barcha so'rovlar, "tasdiq bilan" ruxsati bor xodimga — "So'rovlarim".
 * Bo'lim emas (manifestda yo'q): har mijozda ishlaydi.
 */
export default async function ApprovalsPage() {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  const db = getTenantDb(tenant);
  const rows = await listApprovalRequests(db, staff.director ? {} : { mine: staff.id });
  if (!staff.director && staff.access.approvals.size === 0 && rows.length === 0) redirect("/?ruxsat=yoq");
  return (
    <ApprovalsView
      rows={rows.map((r) => ({ ...r, permissionName: PERMISSION_NAMES[r.permission] ?? r.permission }))}
      director={staff.director}
    />
  );
}
