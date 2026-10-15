import { getTenantDb } from "@/lib/server/deps";
import { getCenterSettings } from "@/lib/server/center";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { CenterSettingsView } from "./settings-view";

export const metadata = { title: uz.settingsCenter.title };

/** Markaz sozlamalari (E6a, ADR 0036): aloqa, ijtimoiy tarmoqlar, ish vaqti. Nom va logotip — Ventura panelida. */
export default async function CenterSettingsPage() {
  const { tenant } = await requirePage("students", "/settings");
  const settings = await getCenterSettings(getTenantDb(tenant));
  return <CenterSettingsView settings={settings} centerName={tenant.name} />;
}
