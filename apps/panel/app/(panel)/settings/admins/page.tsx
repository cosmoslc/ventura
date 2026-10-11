import { asc } from "drizzle-orm";
import { ROLE_LABELS, accessState, formatPhone } from "@ventura/auth";
import { users } from "@ventura/db/schema/panel";
import { PageHeader } from "@ventura/ui/page-header";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AdminsView } from "./admins-view";

export const metadata = { title: `${uz.settings.adminsTitle} · ${uz.app.name}` };

export default async function AdminsPage() {
  const viewer = await requireViewer("admins.manage");
  const { db } = deps();
  const rows = await db.select().from(users).orderBy(asc(users.createdAt));
  return (
    <>
      <PageHeader title={uz.settings.adminsTitle} description={uz.settings.adminsDescription} />
      <AdminsView
        meId={viewer.id}
        rows={rows.map((u) => ({
          id: u.id,
          name: u.name,
          phone: formatPhone(u.phoneNumber ?? ""),
          role: u.role,
          roleLabel: ROLE_LABELS[u.role],
          state: accessState({
            lockedAt: u.lockedAt,
            mustChangePassword: u.mustChangePassword,
            twoFactorEnabled: u.twoFactorEnabled,
            telegramChatId: u.telegramChatId,
          }),
        }))}
      />
    </>
  );
}
