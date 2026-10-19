import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { coinLeaders, getCoinSettings } from "@/lib/server/coins";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { openGroupsByStudent } from "../groups/data";
import { CoinsView } from "./coins-view";

export const metadata = { title: uz.coins.title };

/** Coinlar reytingi (ADR 0061): kimda qancha coin bor, shu oy qancha berilgan. Coin qo'lda berilmaydi. */
export default async function CoinsPage() {
  const { tenant, staff } = await requirePage("coins", "/coins");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const [leaders, settings] = await Promise.all([
    coinLeaders(db, { branchIds: branch.filter, month: todayTashkent().slice(0, 7) }),
    getCoinSettings(db),
  ]);
  const groups = await openGroupsByStudent(
    db,
    leaders.map((l) => l.studentId),
  );
  return (
    <CoinsView
      rows={leaders.map((l) => ({
        ...l,
        groups: (groups.get(l.studentId) ?? []).map((g) => ({ id: g.id, name: g.name })),
      }))}
      anyRule={settings.prepay.enabled || settings.attendance.enabled || settings.homework.enabled}
      canSettings={can(staff.access, "settings.coins")}
    />
  );
}
