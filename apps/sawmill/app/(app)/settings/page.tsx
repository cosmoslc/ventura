import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getSettingsData } from "./actions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return null;

  const { settings, workTypes } = await getSettingsData(deps.db);
  const canManage = can(user.role, "settings.manage");
  const locale = user.locale ?? "uz";

  return <SettingsClient initialSettings={settings} workTypes={workTypes} canManage={canManage} locale={locale} />;
}
