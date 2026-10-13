import { displayPhone } from "@/lib/format";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { ensurePaymentMethods, getFinanceSettings } from "@/lib/server/finance";
import { todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listGroups } from "../groups/data";
import { listStudents } from "../students/data";
import { listPayments } from "./data";
import { PaymentsView } from "./payments-view";
import { financePerms } from "./perms";

export const metadata = { title: uz.payments.title };

/** Tanlovdagi oylar: joriy oydan 12 oy orqaga (to'lov bir yildan eski kiritilmaydi) */
function recentMonths(today: string, count = 13): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y!, m! - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
}
const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { tenant, staff } = await requirePage("payments", "/payments");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const sp = await searchParams;
  const months = recentMonths(today);
  const month = months.find((m) => m === sp.month) ?? months[0]!;
  const from = `${month}-01`;
  const to = monthEnd(month);
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
      month={month}
      months={months}
      methods={methods}
      students={students.map((s) => ({ id: s.id, title: s.name, subtitle: displayPhone(s.phone) ?? "" }))}
      groups={groups.map((g) => ({ id: g.id, name: g.name, left: false }))}
      perms={perms}
      maxDiscountPercent={fs.maxDiscountPercent}
    />
  );
}
