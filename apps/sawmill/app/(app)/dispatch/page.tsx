import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function DispatchPage() {
  const { tenant } = await requireUser();
  if (!(await hasFeature(tenant, "dispatch"))) {
    redirect("/bolim-yopiq");
  }

  return (
    <SectionPlaceholder
      title="Yuk chiqarish (Sotuv)"
      stage="S4 Bosqich"
      description="Ombordan mijozlarga yuk jo'natish, qoldiq tekshiruvi va yuk mashinalari."
    />
  );
}
