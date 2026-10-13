import { canAny } from "@ventura/auth/staff/policy";
import { recentMonths } from "@/lib/format";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { listPeople } from "@/lib/server/expenses";
import { ensurePaymentMethods } from "@/lib/server/finance";
import { monthStart, todayTashkent } from "@/lib/server/memberships";
import { loadPayroll } from "@/lib/server/payroll";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listSalaryEntries } from "./data";
import { SalariesView } from "./salaries-view";

export const metadata = { title: uz.salaries.title };

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string; month?: string }>;
}) {
  const { tenant, staff } = await requirePage("salaries", "/salaries");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const sp = await searchParams;
  let from = isDay(sp.from) ? sp.from : monthStart(today);
  let to = isDay(sp.to) ? sp.to : today;
  const rangeInvalid = from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 366;
  if (rangeInvalid) [from, to] = [monthStart(today), today];
  const months = recentMonths(today);
  const month = months.find((m) => m === sp.month) ?? months[0]!;

  const [entries, payroll, people, methods] = await Promise.all([
    listSalaryEntries(db, { from, to }),
    loadPayroll(db, branch.filter, month, today),
    listPeople(db, branch.filter),
    ensurePaymentMethods(db),
  ]);
  // Filial cheklovi: faqat xodim ko'ra oladigan odamlar yozuvlari
  const visible = new Set(people.map((p) => p.value));
  const rows = branch.filter === null ? entries : entries.filter((e) => visible.has(e.person));

  return (
    <SalariesView
      tab={sp.tab === "calc" ? "calc" : "list"}
      from={from}
      to={to}
      rangeInvalid={rangeInvalid}
      month={month}
      months={months}
      entries={rows}
      payroll={payroll}
      people={people}
      methods={methods}
      perms={{
        salary: canAny(staff.access, ["salaries.pay"]),
        advance: canAny(staff.access, ["salaries.advance_manage", "finance.advance_give"]),
        adjust: canAny(staff.access, ["salaries.kpi_edit"]),
      }}
    />
  );
}
