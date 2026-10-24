import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function ExpensesPage() {
  const { tenant } = await requireUser();
  if (!(await hasFeature(tenant, "general_expenses"))) {
    redirect("/bolim-yopiq");
  }

  return (
    <SectionPlaceholder
      title="Umumiy xarajatlar"
      stage="S5 Bosqich"
      description="Ijara, elektr, soliq va boshqa umumiy xarajatlarni hisobga olish."
    />
  );
}
