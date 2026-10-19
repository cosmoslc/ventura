import { can } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { getCoinSettings } from "@/lib/server/coins";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { CoinSettingsView } from "./coin-settings-view";

export const metadata = { title: uz.coinSettings.title };

/** Coin qoidalari (ADR 0061): oldindan to'lov, davomat, uy vazifasi — har biri yoqiladi va miqdori beriladi */
export default async function CoinSettingsPage() {
  const { tenant, staff } = await requirePage("coins", "/coin-settings");
  const settings = await getCoinSettings(getTenantDb(tenant));
  return (
    <CoinSettingsView
      settings={settings}
      homeworkAvailable={await hasFeature(tenant, "grades")}
      canEdit={can(staff.access, "settings.coins")}
    />
  );
}
