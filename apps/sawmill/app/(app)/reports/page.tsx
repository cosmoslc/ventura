import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function ReportsPage() {
  const { tenant } = await requireUser();
  if (!(await hasFeature(tenant, "reports"))) {
    redirect("/bolim-yopiq");
  }

  return (
    <SectionPlaceholder
      title="Tahlil va Hisobotlar"
      stage="S5 Bosqich"
      description="Sof foyda, terak rentabelligi, ish haqi va yuk chiqarish hisobotlari."
    />
  );
}
