import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { monthRange } from "@/lib/lessons";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { employeeRecords, listEmployees } from "./data";
import { StaffAttendanceView } from "./staff-attendance-view";

export const metadata = { title: uz.staffAttendance.title };

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd! + n)).toISOString().slice(0, 10);
};

export default async function StaffAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; oy?: string }>;
}) {
  const { tenant, staff } = await requirePage("attendance", "/staff-attendance");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const sp = await searchParams;
  const date = isDay(sp.date) && sp.date <= today ? sp.date : today;
  const historyFrom = addDays(today, -29);
  // Oylik hisobot: ?oy=YYYY-MM (kelajak oyi emas); berilmasa — joriy oy
  const monthOk = /^d{4}-(0[1-9]|1[0-2])$/.test(sp.oy ?? "") && sp.oy! <= today.slice(0, 7);
  const month = monthOk ? sp.oy! : today.slice(0, 7);
  const [monthFrom, monthTo] = monthRange(month);
  const [employees, history, day, monthRecords] = await Promise.all([
    listEmployees(db, staff, branch.filter),
    employeeRecords(db, historyFrom, today),
    employeeRecords(db, date, date),
    employeeRecords(db, monthFrom, monthTo),
  ]);
  const keys = new Set(employees.map((e) => e.key));
  return (
    <StaffAttendanceView
      employees={employees}
      day={day.filter((r) => keys.has(r.key))}
      history={history.filter((r) => keys.has(r.key))}
      monthRecords={monthRecords.filter((r) => keys.has(r.key))}
      month={month}
      initialTab={monthOk ? "month" : "day"}
      date={date}
      today={today}
      canMark={can(staff.access, "attendance.employee_mark")}
    />
  );
}
