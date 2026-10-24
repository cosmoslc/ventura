import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function WorkPage() {
  const { tenant } = await requireUser();
  if (!(await hasFeature(tenant, "work"))) {
    redirect("/bolim-yopiq");
  }

  return (
    <SectionPlaceholder
      title="Kunlik ishlar"
      stage="S3 Bosqich"
      description="Yakka va guruh ishlari, sartirofka va res nazorati."
    />
  );
}
