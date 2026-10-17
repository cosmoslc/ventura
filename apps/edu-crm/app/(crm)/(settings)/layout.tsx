import { settingsFor } from "@/lib/server/settings-access";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { SettingsFrame } from "./settings-frame";

/** Sozlamalar sahifalari (ADR 0051): chapda o'z navbari, o'ngda sahifa. Manzillar o'zgarmagan. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  return <SettingsFrame groups={settingsFor(tenant, staff)}>{children}</SettingsFrame>;
}
