import { eq } from "drizzle-orm";
import { PERMISSION_CATEGORIES } from "@ventura/auth/staff/policy";
import { users } from "@ventura/db/schema/tenant";
import { permissionGroups } from "@/lib/devices";
import { displayPhone } from "@/lib/format";
import { getTenantDb, resolveTelegramBot, tenantDeps } from "@/lib/server/deps";
import { ownDevices } from "@/lib/server/devices";
import { currentDeviceId } from "@/lib/server/request";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AccountView } from "./account-view";

export const metadata = { title: uz.account.title };

/** Profil (E6g): har xodim o'z hisobini ko'radi — alohida ruxsat kerak emas */
export default async function AccountPage() {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  const db = getTenantDb(tenant);
  const deps = tenantDeps(tenant);

  const [userRow, tgBot, { devices, sessionCount }] = await Promise.all([
    db
      .select({
        twoFactorEnabled: users.twoFactorEnabled,
        telegramChatId: users.telegramChatId,
      })
      .from(users)
      .where(eq(users.id, staff.id))
      .limit(1)
      .then((r) => r[0]),
    deps ? resolveTelegramBot(deps) : null,
    ownDevices(db, staff.id, await currentDeviceId()),
  ]);

  const hasTelegramBot = !!tgBot;
  const telegramLinked = !!userRow?.telegramChatId;
  const twoFactorEnabled = !!userRow?.twoFactorEnabled;

  return (
    <AccountView
      name={staff.name}
      phone={displayPhone(staff.phone) ?? staff.phone}
      director={staff.director}
      positions={staff.positions}
      telegramLinked={telegramLinked}
      twoFactorEnabled={twoFactorEnabled}
      hasTelegramBot={hasTelegramBot}
      groups={
        staff.director ? [] : permissionGroups(PERMISSION_CATEGORIES, staff.access.permissions, staff.access.approvals)
      }
      devices={devices}
      sessionCount={sessionCount}
    />
  );
}
