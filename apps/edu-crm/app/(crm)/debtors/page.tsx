import { canAny } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { ensurePaymentMethods, getFinanceSettings } from "@/lib/server/finance";
import { todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { financePerms } from "../payments/perms";
import { listDebtors } from "./data";
import { DebtorsView } from "./debtors-view";

export const metadata = { title: uz.debtors.title };

export default async function DebtorsPage() {
  const { tenant, staff } = await requirePage("debtors", "/debtors");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const fs = await getFinanceSettings(db);
  const [rows, methods] = await Promise.all([listDebtors(db, branch.filter, today, fs), ensurePaymentMethods(db)]);
  return (
    <DebtorsView
      rows={rows}
      dueDay={fs.dueDay}
      methods={methods}
      canPay={financePerms(staff.access).create}
      canNote={canAny(staff.access, ["finance.debtors_remind", "students.edit"])}
      maxDiscountPercent={fs.maxDiscountPercent}
    />
  );
}
