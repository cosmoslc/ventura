import { eq } from "drizzle-orm";
import { users } from "@ventura/db/schema/tenant";
import { getTenantDb } from "@/lib/server/deps";
import { requireStudent, requireTenant } from "@/lib/server/session";
import { PortalSettingsView } from "./settings-view";
import { uz } from "@/lib/uz";

export const metadata = { title: uz.portal.sozlamalarOquvchiPortali };

/**
 * O'quvchi xavfsizlik va sozlamalar sahifasi (ADR 0063).
 * Muallif / Agent: Google Gemini
 */
export default async function PortalSettingsPage() {
  const tenant = await requireTenant();
  const staff = await requireStudent();
  const db = getTenantDb(tenant);

  const [u] = await db
    .select({
      twoFactorEnabled: users.twoFactorEnabled,
      telegramChatId: users.telegramChatId,
    })
    .from(users)
    .where(eq(users.id, staff.id))
    .limit(1);

  return (
    <PortalSettingsView
      initialName={staff.name}
      phone={staff.phone}
      twoFactorEnabled={!!u?.twoFactorEnabled}
      hasTelegram={!!u?.telegramChatId}
    />
  );
}
