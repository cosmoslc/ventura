import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { attendance, groups, students } from "@ventura/db/schema/tenant";
import { type StaffAccess, canAny } from "@ventura/auth/staff/policy";
import { type Tenant, hasFeature } from "@ventura/tenants";
import { listDebtors } from "@/app/(crm)/debtors/data";
import { listGroups } from "@/app/(crm)/groups/data";
import { holidayRanges } from "@/app/(crm)/holidays/data";
import { listLeads, listStages } from "@/app/(crm)/leads/data";
import { PAGE_ACCESS } from "@/lib/access";
import { isHoliday, weekdayOf } from "@/lib/lessons";
import { dueFollowUps, endingGroups } from "@/lib/workbench";
import { getFinanceSettings } from "./finance";

/*
 * "Bugungi ishlar" ma'lumoti (E4d, ADR 0027). Har blok o'z ruxsati va bo'limi bilan: xodim ko'ra olmaydigan blok
 * umuman o'qilmaydi va brauzerga yuborilmaydi. Hammasi tepadagi filial tanlovi bo'yicha.
 */

export const WORKBENCH_BLOCKS = {
  leads: { feature: "leads", perms: PAGE_ACCESS["/leads"]! },
  absent: {
    feature: "attendance",
    perms: ["attendance.student_mark", "attendance.student_edit_past", "attendance.export", "groups.attendance_view"],
  },
  debtors: { feature: "debtors", perms: PAGE_ACCESS["/debtors"]! },
  groups: { feature: "groups", perms: PAGE_ACCESS["/groups"]! },
} as const;
export type WorkbenchBlock = keyof typeof WORKBENCH_BLOCKS;

export async function workbenchBlocks(tenant: Tenant, access: StaffAccess): Promise<Set<WorkbenchBlock>> {
  const out = new Set<WorkbenchBlock>();
  for (const [key, b] of Object.entries(WORKBENCH_BLOCKS) as [
    WorkbenchBlock,
    (typeof WORKBENCH_BLOCKS)[WorkbenchBlock],
  ][])
    if (canAny(access, b.perms) && (await hasFeature(tenant, b.feature))) out.add(key);
  return out;
}

export interface WbLead {
  id: string;
  name: string;
  phone: string;
  stage: string;
  color: string;
  course: string | null;
  assigned: string | null;
  source: string | null;
}

export interface WbFollowUp extends WbLead {
  targetDate: string;
  overdue: number;
}

export interface WbFirstLesson extends WbLead {
  group: string;
  time: string | null;
  status: "scheduled" | "came" | "absent";
}

export interface WbAbsent {
  studentId: string;
  name: string;
  phone: string;
  group: string;
  groupId: string;
  time: string;
  status: "absent" | "excused";
  reason: string | null;
}

export interface WbDebtor {
  studentId: string;
  name: string;
  phone: string;
  debt: number;
  groups: string;
  overdueDays: number;
}

export interface WbEnding {
  id: string;
  name: string;
  course: string;
  teacher: string;
  students: number;
  endDate: string;
  daysLeft: number;
  progress: number;
}

export interface WorkbenchData {
  leads: { followUps: WbFollowUp[]; firstLessons: WbFirstLesson[]; unassigned: WbLead[] } | null;
  absent: { list: WbAbsent[]; lessons: number; marked: number } | null;
  debtors: { top: WbDebtor[]; count: number; total: number } | null;
  ending: WbEnding[] | null;
}

async function leadBlocks(db: TenantDb, filter: readonly string[] | null, today: string) {
  const [rows, stages, groupRows] = await Promise.all([listLeads(db, filter), listStages(db), listGroups(db, filter)]);
  const stage = new Map(stages.map((s) => [s.id, s]));
  const open = rows.filter((l) => stage.get(l.stageId)?.kind === "open");
  const firstStage = stages.find((s) => s.kind === "open")?.id;
  const time = new Map(groupRows.map((g) => [g.id, g.startTime]));
  const base = (l: (typeof rows)[number]): WbLead => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    stage: stage.get(l.stageId)?.name ?? "—",
    color: stage.get(l.stageId)?.color ?? "#64748b",
    course: l.courseName,
    assigned: l.assignedName,
    source: l.source,
  });
  return {
    followUps: dueFollowUps(open, today).map((l) => ({ ...base(l), targetDate: l.targetDate, overdue: l.overdue })),
    firstLessons: open
      .filter((l) => l.firstLesson?.date === today)
      .map((l) => ({
        ...base(l),
        group: l.firstLesson!.groupName,
        time: time.get(l.firstLesson!.groupId) ?? null,
        status: l.firstLesson!.status,
      }))
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
    // Birinchi ustundagi mas'ulsiz lidlar (saytdan kelgan arizalar ham), yangisi birinchi
    unassigned: open.filter((l) => l.stageId === firstStage && !l.assignedTo).map(base),
  };
}

async function absentBlock(db: TenantDb, filter: readonly string[] | null, today: string) {
  const [rows, groupRows, marks, holidays] = await Promise.all([
    db
      .select({
        studentId: students.id,
        name: students.name,
        phone: students.phone,
        group: groups.name,
        groupId: groups.id,
        time: groups.startTime,
        status: attendance.status,
        reason: attendance.reason,
      })
      .from(attendance)
      .innerJoin(students, eq(students.id, attendance.studentId))
      .innerJoin(groups, eq(groups.id, attendance.groupId))
      .where(
        and(
          eq(attendance.date, today),
          inArray(attendance.status, ["absent", "excused"]),
          filter ? inArray(groups.branchId, [...filter]) : undefined,
        ),
      )
      .orderBy(asc(groups.startTime), asc(students.name)),
    listGroups(db, filter),
    db.selectDistinct({ groupId: attendance.groupId }).from(attendance).where(eq(attendance.date, today)),
    holidayRanges(db, today, today),
  ]);
  const day = weekdayOf(today);
  const lessonsToday = groupRows.filter(
    (g) => g.startDate <= today && g.days.includes(day) && !isHoliday(today, g.branchId, holidays),
  );
  const markedIds = new Set(marks.map((m) => m.groupId));
  return {
    list: rows.map((r) => ({
      ...r,
      phone: r.phone.replace(/\D/g, "").slice(-9),
      status: r.status as "absent" | "excused",
    })),
    lessons: lessonsToday.length,
    marked: lessonsToday.filter((g) => markedIds.has(g.id)).length,
  };
}

async function debtorBlock(db: TenantDb, filter: readonly string[] | null, today: string) {
  const fs = await getFinanceSettings(db);
  const rows = (await listDebtors(db, filter, today, fs)).filter((d) => !d.archived && d.debt > 0);
  return {
    count: rows.length,
    total: rows.reduce((s, d) => s + d.debt, 0),
    top: [...rows]
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 8)
      .map((d) => ({
        studentId: d.studentId,
        name: d.name,
        phone: d.phone,
        debt: d.debt,
        groups: d.groups.map((g) => g.name).join(", "),
        overdueDays: d.overdueDays,
      })),
  };
}

async function endingBlock(db: TenantDb, filter: readonly string[] | null, today: string): Promise<WbEnding[]> {
  return endingGroups(await listGroups(db, filter), today).map((e) => ({
    id: e.group.id,
    name: e.group.name,
    course: e.group.courseName,
    teacher: e.group.teacherName,
    students: e.group.studentIds.length,
    endDate: e.endDate,
    daysLeft: e.daysLeft,
    progress: e.progress,
  }));
}

export async function loadWorkbench(
  db: TenantDb,
  blocks: ReadonlySet<WorkbenchBlock>,
  filter: readonly string[] | null,
  today: string,
): Promise<WorkbenchData> {
  const [leads, absent, debtors, ending] = await Promise.all([
    blocks.has("leads") ? leadBlocks(db, filter, today) : null,
    blocks.has("absent") ? absentBlock(db, filter, today) : null,
    blocks.has("debtors") ? debtorBlock(db, filter, today) : null,
    blocks.has("groups") ? endingBlock(db, filter, today) : null,
  ]);
  return { leads, absent, debtors, ending };
}
