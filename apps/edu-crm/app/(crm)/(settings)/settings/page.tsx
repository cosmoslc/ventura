import { getTenantDb } from "@/lib/server/deps";
import { getCenterSettings } from "@/lib/server/center";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { CenterSettingsView } from "./settings-view";

export const metadata = { title: uz.settingsCenter.title };

/** Markaz ma'lumotlari (E6a, ADR 0036): brending (ko'rish uchun), aloqa, ish vaqti. Nom va logotip — Ventura panelida. */
export default async function CenterSettingsPage() {
  const { tenant } = await requirePage("students", "/settings");
  const settings = await getCenterSettings(getTenantDb(tenant));
  // Platforma manzili: mijozning haqiqiy domeni (localhost emas), bo'lmasa — birinchisi
  const host = tenant.hosts.find((h) => h.includes(".") && !/^\d/.test(h)) ?? tenant.hosts[0];
  return (
    <CenterSettingsView
      settings={settings}
      centerName={tenant.name}
      platformUrl={host ? `https://${host}` : null}
      logoUrl={tenant.brand.logoUrl ?? null}
    />
  );
}
