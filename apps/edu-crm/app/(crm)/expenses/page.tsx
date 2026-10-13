import { can, canAny } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { listCategories, listPeople } from "@/lib/server/expenses";
import { ensurePaymentMethods } from "@/lib/server/finance";
import { monthStart, todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listExpenses, listPlans } from "./data";
import { ExpensesView } from "./expenses-view";
import { EXPENSE_TABS, type ExpenseTab } from "./tabs";

export const metadata = { title: uz.expenses.title };

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const isMonth = (v: string | undefined): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string; month?: string }>;
}) {
  const { tenant, staff } = await requirePage("expenses", "/expenses");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const sp = await searchParams;

  let from = isDay(sp.from) ? sp.from : monthStart(today);
  let to = isDay(sp.to) ? sp.to : today;
  const rangeInvalid = from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 366;
  if (rangeInvalid) [from, to] = [monthStart(today), today];
  const month = isMonth(sp.month) ? sp.month : today.slice(0, 7);

  const perms = {
    /** Ro'yxat va rejalarni ko'rish (faqat toifalar ruxsati bor xodim — faqat Toifalar tabi) */
    view: canAny(staff.access, ["expenses.view", "expenses.create", "expenses.edit_delete"]),
    create: can(staff.access, "expenses.create"),
    edit: can(staff.access, "expenses.edit_delete"),
    categories: can(staff.access, "expenses.categories"),
  };
  const wanted = EXPENSE_TABS.find((x) => x === sp.tab);
  const tab: ExpenseTab = !perms.view ? "categories" : (wanted ?? "variable");

  const [rows, plans, categories, methods, people] = await Promise.all([
    perms.view ? listExpenses(db, branch.filter, { from, to }) : Promise.resolve([]),
    perms.view ? listPlans(db, branch.filter, month) : Promise.resolve([]),
    listCategories(db),
    ensurePaymentMethods(db),
    perms.view ? listPeople(db, branch.filter) : Promise.resolve([]),
  ]);

  return (
    <ExpensesView
      tab={tab}
      from={from}
      to={to}
      month={month}
      rangeInvalid={rangeInvalid}
      rows={rows}
      plans={plans}
      categories={categories}
      methods={methods}
      people={people}
      branches={branch.options}
      selectedBranch={branch.selected}
      canAllBranches={staff.scope === "all"}
      perms={perms}
    />
  );
}
