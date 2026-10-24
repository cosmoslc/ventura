import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function MaterialsPage() {
  const { tenant } = await requireUser();
  if (!(await hasFeature(tenant, "stock"))) {
    redirect("/bolim-yopiq");
  }

  return (
    <SectionPlaceholder
      title="Materiallar katalogi va ombor"
      stage="S1 / S2 Bosqich"
      description="Material turlari, o'lchamlar, narxlar va qoldiqlar harakati."
    />
  );
}
