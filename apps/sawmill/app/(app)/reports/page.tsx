import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import { teraks } from "@ventura/db/schema/sawmill";
import { hasFeature } from "@ventura/tenants";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/server/session";
import { getDispatchReportData, getProfitReportData, getWagesReportData } from "./actions";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const { tenant, user, deps } = await requireUser();
  if (!(await hasFeature(tenant, "reports"))) {
    redirect("/bolim-yopiq");
  }

  if (!can(user.role, "reports.view")) {
    redirect("/");
  }

  const [profitData, wagesData, dispatchData, teraksList] = await Promise.all([
    getProfitReportData(deps.db),
    getWagesReportData(deps.db),
    getDispatchReportData(deps.db),
    deps.db
      .select({ id: teraks.id, name: teraks.name })
      .from(teraks)
      .where(isNull(teraks.deletedAt))
      .orderBy(desc(teraks.createdAt)),
  ]);

  return (
    <ReportsClient
      initialProfit={profitData}
      initialWages={wagesData}
      initialDispatches={dispatchData}
      teraksList={teraksList}
      locale={user.locale}
    />
  );
}
