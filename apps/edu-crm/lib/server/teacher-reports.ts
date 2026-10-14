import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { attendance, groupMemberships, groups, leadFirstLessons, leads, teachers } from "@ventura/db/schema/tenant";
import { holidayRanges } from "@/app/(crm)/holidays/data";
import { lessonDates } from "@/lib/lessons";
import type { ReportData, ReportRow } from "@/lib/reports";
import {
  type TeacherCounts,
  type TeacherRow,
  lessonMinutes,
  rankTeachers,
  teacherRow,
  teacherTotal,
} from "@/lib/teacher-reports";
import { uz } from "@/lib/uz";
import { tashkentDate } from "./memberships";
import { loadPayroll } from "./payroll";
import type { LoadArgs } from "./reports";

/*
 * O'qituvchi samaradorlik reytingi (E5d, ADR 0033). Hisob — lib/teacher-reports.ts. Darslar jadvaldan
 * (davomat hisobotidagi `lessonDates`, bayramlarsiz), davomat — belgilardan, maosh — ish haqi hisobidan (ADR 0018).
 */

const t = uz.reports.teachers;
const EPOCH = "2000-01-01";

const dayBefore = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd! - 1)).toISOString().slice(0, 10);
};

export async function teachersReport({ db, filter, period, today, finance }: LoadArgs): Promise<ReportData> {
  const from = period.range?.from ?? EPOCH;
  const toEx = period.range?.to ?? "9999-12-31";
  const last = period.range && dayBefore(period.range.to) < today ? dayBefore(period.range.to) : today;

  const groupRows = await db
    .select({
      id: groups.id,
      branchId: groups.branchId,
      teacherId: groups.teacherId,
      teacherName: teachers.name,
      days: groups.days,
      startTime: groups.startTime,
      endTime: groups.endTime,
      startDate: groups.startDate,
      archivedAt: groups.archivedAt,
    })
    .from(groups)
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(filter ? inArray(groups.branchId, [...filter]) : undefined);
  if (!groupRows.length) return empty(finance);
  const groupIds = groupRows.map((g) => g.id);

  const [holidays, marks, members, firsts] = await Promise.all([
    holidayRanges(db, from, last),
    db
      .select({ groupId: attendance.groupId, date: attendance.date, status: attendance.status })
      .from(attendance)
      .where(and(inArray(attendance.groupId, groupIds), gte(attendance.date, from), lte(attendance.date, last))),
    db
      .select({
        groupId: groupMemberships.groupId,
        studentId: groupMemberships.studentId,
        status: groupMemberships.status,
        enrolledAt: groupMemberships.enrolledAt,
        activatedAt: groupMemberships.activatedAt,
        leftAt: groupMemberships.leftAt,
      })
      .from(groupMemberships)
      .where(inArray(groupMemberships.groupId, groupIds)),
    db
      .select({ groupId: leadFirstLessons.groupId, studentId: leads.studentId })
      .from(leadFirstLessons)
      .innerJoin(leads, eq(leads.id, leadFirstLessons.leadId))
      .where(
        and(
          inArray(leadFirstLessons.groupId, groupIds),
          eq(leadFirstLessons.status, "came"),
          gte(leadFirstLessons.lessonDate, from),
          lte(leadFirstLessons.lessonDate, last),
        ),
      ),
  ]);

  // Hisoblangan maosh: davrdagi o'tgan oylar bo'yicha (barcha davrda — yo'q). O'qituvchi tizimga qo'shilishidan
  // oldingi oylar sanalmaydi (ish haqi hisobi belgilangan oylikni har oyga yozadi)
  const salary = new Map<string, number>();
  const months = finance && period.months ? period.months.filter((m) => m <= today.slice(0, 7)) : [];
  const since = new Map(
    (months.length ? await db.select({ id: teachers.id, createdAt: teachers.createdAt }).from(teachers) : []).map(
      (x) => [x.id, tashkentDate(x.createdAt).slice(0, 7)],
    ),
  );
  for (const month of months) {
    const payroll = await loadPayroll(db, filter, month, today);
    for (const r of payroll.rows)
      if (r.kind === "teacher" && month >= (since.get(r.id) ?? month))
        salary.set(r.id, (salary.get(r.id) ?? 0) + r.accrual.total);
  }

  const counts = new Map<string, TeacherCounts & { studentSet: Set<string> }>();
  const of = (teacherId: string, name: string) => {
    let c = counts.get(teacherId);
    if (!c)
      counts.set(
        teacherId,
        (c = {
          teacherId,
          name,
          groups: 0,
          students: 0,
          studentSet: new Set(),
          lessons: 0,
          minutes: 0,
          markedLessons: 0,
          attended: 0,
          marks: 0,
          base: 0,
          left: 0,
          activated: 0,
          trialLeft: 0,
          firstCame: 0,
          firstWon: 0,
          salary: finance && months.length ? (salary.get(teacherId) ?? 0) : null,
        }),
      );
    return c;
  };

  const markedDays = new Map<string, Set<string>>();
  for (const m of marks) markedDays.set(m.groupId, (markedDays.get(m.groupId) ?? new Set()).add(m.date));
  const groupById = new Map(groupRows.map((g) => [g.id, g]));

  for (const g of groupRows) {
    const c = of(g.teacherId, g.teacherName);
    // Arxivlangan guruh — arxiv kunidan keyin dars yo'q
    const end = g.archivedAt ? dayBefore(tashkentDate(g.archivedAt)) : last;
    const dates = lessonDates(g, from, end < last ? end : last, holidays);
    c.lessons += dates.length;
    c.minutes += dates.length * lessonMinutes(g.startTime, g.endTime);
    const marked = markedDays.get(g.id);
    c.markedLessons += dates.filter((d) => marked?.has(d)).length;
    if (!g.archivedAt) c.groups++;
  }
  for (const m of marks) {
    const c = of(groupById.get(m.groupId)!.teacherId, groupById.get(m.groupId)!.teacherName);
    c.marks++;
    if (m.status === "present" || m.status === "late") c.attended++;
  }
  for (const m of members) {
    const g = groupById.get(m.groupId)!;
    const c = of(g.teacherId, g.teacherName);
    if (!g.archivedAt && m.leftAt === null && (m.status === "trial" || m.status === "active"))
      c.studentSet.add(m.studentId);
    // Ushlab turish: davr boshida guruhda bo'lgan faollashtirilganlar (barcha davrda — barcha faollashtirilganlar)
    const inBase = period.range
      ? m.activatedAt !== null && m.activatedAt <= from && (m.leftAt === null || m.leftAt >= from)
      : m.activatedAt !== null;
    if (inBase) {
      c.base++;
      if (m.leftAt !== null && m.leftAt < toEx) c.left++;
    }
    // Sinovdan o'tish: davrda qo'shilganlar
    if (m.enrolledAt >= from && m.enrolledAt < toEx) {
      if (m.activatedAt !== null) c.activated++;
      else if (m.leftAt !== null) c.trialLeft++;
    }
  }
  for (const f of firsts) {
    const g = groupById.get(f.groupId)!;
    const c = of(g.teacherId, g.teacherName);
    c.firstCame++;
    if (f.studentId) c.firstWon++;
  }

  const list: TeacherCounts[] = [...counts.values()]
    .map(({ studentSet, ...c }) => ({ ...c, students: studentSet.size }))
    // Davrda hech qanday faoliyati yo'q o'qituvchi chiqmaydi
    .filter((c) => c.groups || c.lessons || c.base || c.activated || c.trialLeft || c.firstCame);
  const rows = rankTeachers(list.map(teacherRow));
  const total = teacherTotal(list, uz.reports.total);
  return build(rows, total, !!finance && months.length > 0);
}

function columns(withSalary: boolean) {
  return [
    { key: "name", label: t.teacher, kind: "text" as const },
    { key: "groups", label: t.groups, kind: "number" as const },
    { key: "students", label: t.students, kind: "number" as const },
    { key: "lessons", label: t.lessons, kind: "number" as const },
    { key: "hours", label: t.hours, kind: "number" as const },
    { key: "markedRate", label: t.markedRate, kind: "percent" as const },
    { key: "attendance", label: t.attendance, kind: "percent" as const },
    { key: "retention", label: t.retention, kind: "percent" as const },
    { key: "left", label: t.left, kind: "number" as const },
    { key: "trialConv", label: t.trialConv, kind: "percent" as const },
    { key: "firstConv", label: t.firstConv, kind: "percent" as const },
    ...(withSalary ? [{ key: "salary", label: t.salary, kind: "money" as const }] : []),
  ];
}

const cells = (r: TeacherRow, withSalary: boolean) => ({
  name: r.name,
  groups: r.groups,
  students: r.students,
  lessons: r.lessons,
  hours: Math.round(r.hours),
  markedRate: r.markedRate,
  attendance: r.attendance,
  retention: r.retention,
  left: r.left,
  trialConv: r.trialConv,
  firstConv: r.firstConv,
  ...(withSalary ? { salary: r.salary } : {}),
});

function build(rows: TeacherRow[], total: TeacherRow, withSalary: boolean): ReportData {
  return {
    metrics: [
      { label: t.count, value: rows.length, kind: "number", tone: "primary" },
      {
        label: t.lessons,
        value: total.lessons,
        kind: "number",
        foot: total.lessons ? t.hoursFoot(Math.round(total.hours)) : undefined,
      },
      { label: t.attendance, value: total.attendance, kind: "percent", tone: "success" },
      { label: t.retention, value: total.retention, kind: "percent", foot: t.leftFoot(total.left) },
    ],
    table: {
      columns: columns(withSalary),
      rows: [
        ...rows.map((r): ReportRow => ({ href: `/teachers/${r.teacherId}`, cells: cells(r, withSalary) })),
        { kind: "total", cells: cells(total, withSalary) },
      ],
    },
    note: withSalary ? `${t.footnote} ${t.salaryNote}` : t.footnote,
  };
}

function empty(finance: boolean | undefined): ReportData {
  return build([], teacherTotal([], uz.reports.total), !!finance);
}
