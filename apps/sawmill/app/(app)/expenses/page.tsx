import { redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getGeneralExpensesData } from "./actions";
import { ExpensesClient } from "./expenses-client";

export default async function ExpensesPage() {
  const { user, tenant } = await requireUser();
  if (!(await hasFeature(tenant, "general_expenses"))) {
    redirect("/bolim-yopiq");
  }

  const { deps } = await currentDeps();
  if (!deps) return null;

  const canManage = can(user.role, "expenses.manage");
  const locale = user.locale ?? "uz";

  const { expenses, categories } = await getGeneralExpensesData(deps.db);

  return (
    <ExpensesClient
      initialExpenses={expenses}
      categories={categories}
      canManage={canManage}
      locale={locale}
    />
  );
}
