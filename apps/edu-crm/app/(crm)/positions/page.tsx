import { can } from "@ventura/auth/staff/policy";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listPositions } from "./data";
import { PositionsView } from "./positions-view";

export const metadata = { title: uz.positions.title };

export default async function PositionsPage() {
  const { tenant, staff } = await requirePage("teachers", "/positions");
  const rows = await listPositions(getTenantDb(tenant));
  return (
    <PositionsView
      rows={rows}
      canWrite={can(staff.access, "settings.roles_permissions")}
      // Direktor bo'lmagan xodim faqat o'zida bor ruxsatlarni bera oladi
      grantable={staff.director ? null : [...staff.access.permissions]}
    />
  );
}
