import { can } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { REASON_CATEGORY_LIST } from "@/lib/reasons";
import { getTenantDb } from "@/lib/server/deps";
import { getReasonsConfig } from "@/lib/server/reasons";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ReasonsView } from "./reasons-view";

export const metadata = { title: uz.reasons.title };

export default async function ReasonsPage() {
  const { tenant, staff } = await requirePage("students", "/reasons");
  const config = await getReasonsConfig(getTenantDb(tenant));
  // Faqat yoqilgan bo'limlarning turlari; tahrirlash — shu bo'limning tahrirlash ruxsati bilan
  const features = new Set<string>(["students"]);
  for (const f of ["groups", "leads"] as const) if (await hasFeature(tenant, f)) features.add(f);
  const categories = REASON_CATEGORY_LIST.filter((c) => features.has(c.feature)).map((c) => ({
    id: c.id,
    feature: c.feature,
    switchable: c.switchable,
    canEdit: can(staff.access, c.permission),
  }));
  return <ReasonsView categories={categories} config={config} />;
}
