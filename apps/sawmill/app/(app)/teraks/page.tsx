import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function TeraksPage() {
  const { tenant } = await requireUser();
  if (!(await hasFeature(tenant, "teraks"))) {
    redirect("/bolim-yopiq");
  }

  return (
    <SectionPlaceholder
      title="Teraklar (Yog'och partiyalari)"
      stage="S2 Bosqich"
      description="Yog'och partiyalarini xarid qilish, narxlar, ombor va xarajatlar tahlili."
    />
  );
}
