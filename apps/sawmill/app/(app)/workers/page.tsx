import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function WorkersPage() {
  const { tenant } = await requireUser();
  if (!(await hasFeature(tenant, "workers"))) {
    redirect("/bolim-yopiq");
  }

  return (
    <SectionPlaceholder
      title="Ishchilar va ish haqi"
      stage="S1 / S3 Bosqich"
      description="Ishchilar ro'yxati, balanslar, to'lovlar va maosh hisoblash."
    />
  );
}
