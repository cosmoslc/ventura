import { displayPhone } from "@/lib/format";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { ensurePaymentMethods, getFinanceSettings } from "@/lib/server/finance";
import { monthStart, todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listGroups } from "../groups/data";
import { listStudents } from "../students/data";
import { listPayments } from "./data";
import { PaymentsView } from "./payments-view";
import { financePerms } from "./perms";

export const metadata = { title: uz.payments.title };

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { tenant, staff } = await requirePage("payments", "/payments");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const sp = await searchParams;
  let from = isDay(sp.from) ? sp.from : monthStart(today);
  let to = isDay(sp.to) ? sp.to : today;
  const invalid = from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 366;
  if (invalid) [from, to] = [monthStart(today), today];
  const perms = financePerms(staff.access);
  const [rows, todayRows, methods, fs, students, groups] = await Promise.all([
    listPayments(db, branch.filter, { from, to }),
    from <= today && today <= to ? Promise.resolve(null) : listPayments(db, branch.filter, { from: today, to: today }),
    ensurePaymentMethods(db),
    getFinanceSettings(db),
    perms.create ? listStudents(db, branch.filter) : Promise.resolve([]),
    listGroups(db, branch.filter),
  ]);
  const todays = (todayRows ?? rows).filter((r) => r.date === today && !r.voided);
  return (
    <PaymentsView
      rows={rows}
      today={today}
      todayIncome={{
        sum: todays.reduce((s, r) => s + Math.max(0, r.cash), 0),
        count: todays.filter((r) => r.kind === "payment").length,
      }}
      from={from}
      to={to}
      rangeInvalid={invalid}
      methods={methods}
      students={students.map((s) => ({ id: s.id, title: s.name, subtitle: displayPhone(s.phone) ?? "" }))}
      groups={groups.map((g) => ({ id: g.id, name: g.name, left: false }))}
      perms={perms}
      maxDiscountPercent={fs.maxDiscountPercent}
    />
  );
}
