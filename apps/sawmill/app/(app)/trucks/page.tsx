import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function TrucksPage() {
  const { tenant } = await requireUser();
  if (!(await hasFeature(tenant, "trucks"))) {
    redirect("/bolim-yopiq");
  }

  return (
    <SectionPlaceholder
      title="Yuk mashinalari"
      stage="S4 Bosqich"
      description="Yuk mashinalari katalogi va tashish xarajatlari."
    />
  );
}
