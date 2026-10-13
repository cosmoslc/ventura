import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { listCategories } from "@/lib/server/expenses";
import { ensurePaymentMethods } from "@/lib/server/finance";
import { monthStart, todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listIncomes } from "./data";
import { IncomesView } from "./incomes-view";

export const metadata = { title: uz.incomes.title };

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** Qo'shimcha daromadlar — Xarajatlar bo'limining bir qismi (manifestda `expenses` → `/additional-income`) */
export default async function AdditionalIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { tenant, staff } = await requirePage("expenses", "/additional-income");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const sp = await searchParams;
  let from = isDay(sp.from) ? sp.from : monthStart(today);
  let to = isDay(sp.to) ? sp.to : today;
  const rangeInvalid = from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 366;
  if (rangeInvalid) [from, to] = [monthStart(today), today];

  const [rows, categories, methods] = await Promise.all([
    listIncomes(db, branch.filter, { from, to }),
    listCategories(db),
    ensurePaymentMethods(db),
  ]);
  return (
    <IncomesView
      rows={rows}
      from={from}
      to={to}
      rangeInvalid={rangeInvalid}
      categories={categories.filter((c) => c.kind === "income")}
      methods={methods}
      branches={branch.options}
      selectedBranch={branch.selected}
      canWrite={can(staff.access, "additional_income.create")}
    />
  );
}
