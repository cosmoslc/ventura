import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { attendanceReport } from "@/lib/server/attendance-report";
import { getTenantDb } from "@/lib/server/deps";
import { monthStart, todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions } from "../students/data";
import { AttendanceReportView } from "./report-view";

export const metadata = { title: uz.attendance.title };

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const MAX_DAYS = 366;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { tenant, staff } = await requirePage("attendance", "/attendance");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const sp = await searchParams;
  const today = todayTashkent();
  let from = isDay(sp.from) ? sp.from : monthStart(today);
  let to = isDay(sp.to) ? sp.to : today;
  const invalid = from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_DAYS;
  if (invalid) [from, to] = [monthStart(today), today];
  const [rows, courses] = await Promise.all([
    attendanceReport(db, branch.filter, { from, to, today }),
    courseOptions(db),
  ]);
  return (
    <AttendanceReportView
      rows={rows}
      courses={courses}
      from={from}
      to={to}
      today={today}
      rangeInvalid={invalid}
      canMarkToday={can(staff.access, "attendance.student_mark")}
      canEditPast={can(staff.access, "attendance.student_edit_past")}
    />
  );
}
