import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  type MembershipStatus,
  type TeacherSalaryType,
  type Weekday,
  attendance,
  courses,
  groupMemberships,
  groups,
  rooms,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { type AttendanceStat, type MemberMoney, attendanceStat, daysAgo, memberMoney } from "@/lib/group-profile";
import { loadAccounts } from "@/lib/server/finance";
import type { GroupFinance } from "../payments/data";

export interface GroupRow {
  id: string;
  branchId: string;
  name: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  teacherId: string;
  teacherName: string;
  roomId: string | null;
  roomName: string | null;
  roomCapacity: number | null;
  price: number;
  durationMonths: number;
  days: Weekday[];
  startTime: string;
  endTime: string;
  startDate: string;
  color: string;
  teacherSalaryType: TeacherSalaryType | null;
  teacherSalaryPercent: number | null;
  teacherSalaryAmount: number | null;
  /** Belgilangan summa shu sanadan; null — guruh boshlangan sana */
  teacherSalaryFrom: string | null;
  note: string | null;
  /** Ochiq a'zoliklar soni holat bo'yicha */
  members: { trial: number; active: number; paused: number };
  /** Ochiq a'zolikdagi o'quvchilar (takrorsiz sanash uchun) */
  studentIds: string[];
}

const WEEK: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const sortDays = (days: readonly string[]) => WEEK.filter((d) => days.includes(d));

/** Faol (arxivlanmagan) guruhlar; `filter` — getBranchContext().filter */
export async function listGroups(db: TenantDb, filter: readonly string[] | null, id?: string): Promise<GroupRow[]> {
  const rows = await db
    .select({
      g: groups,
      courseName: courses.name,
      courseColor: courses.color,
      teacherName: teachers.name,
      roomName: rooms.name,
      roomCapacity: rooms.capacity,
    })
    .from(groups)
    .innerJoin(courses, eq(courses.id, groups.courseId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .leftJoin(rooms, eq(rooms.id, groups.roomId))
    .where(
      and(
        isNull(groups.archivedAt),
        filter ? inArray(groups.branchId, [...filter]) : undefined,
        id ? eq(groups.id, id) : undefined,
      ),
    )
    .orderBy(asc(groups.name));
  if (!rows.length) return [];
  const counts = await db
    .select({
      groupId: groupMemberships.groupId,
      status: groupMemberships.status,
      studentId: groupMemberships.studentId,
    })
    .from(groupMemberships)
    .innerJoin(students, eq(students.id, groupMemberships.studentId))
    .where(
      and(
        inArray(
          groupMemberships.groupId,
          rows.map((r) => r.g.id),
        ),
        isNull(groupMemberships.leftAt),
        isNull(students.archivedAt),
      ),
    );
  return rows.map(({ g, ...r }) => {
    const mine = counts.filter((c) => c.groupId === g.id);
    return {
      id: g.id,
      branchId: g.branchId,
      name: g.name,
      courseId: g.courseId,
      courseName: r.courseName,
      courseColor: r.courseColor,
      teacherId: g.teacherId,
      teacherName: r.teacherName,
      roomId: g.roomId,
      roomName: r.roomName,
      roomCapacity: r.roomCapacity,
      price: g.price,
      durationMonths: g.durationMonths,
      days: sortDays(g.days),
      startTime: g.startTime,
      endTime: g.endTime,
      startDate: g.startDate,
      color: g.color,
      teacherSalaryType: g.teacherSalaryType,
      teacherSalaryPercent: g.teacherSalaryPercent,
      teacherSalaryAmount: g.teacherSalaryAmount,
      teacherSalaryFrom: g.teacherSalaryFrom,
      note: g.note,
      members: {
        trial: mine.filter((c) => c.status === "trial").length,
        active: mine.filter((c) => c.status === "active").length,
        paused: mine.filter((c) => c.status === "paused").length,
      },
      studentIds: mine.map((c) => c.studentId),
    };
  });
}

export interface MemberRow {
  /** A'zolik (davr) id */
  id: string;
  studentId: string;
  name: string;
  phone: string;
  parentName: string | null;
  gender: "male" | "female" | null;
  status: MembershipStatus;
  enrolledAt: string;
  activatedAt: string | null;
  pausedAt: string | null;
  leftAt: string | null;
  leftReason: string | null;
  leftNote: string | null;
  /** Qarz bilan chiqarish kutilmoqda (ADR 0050): shu sana bilan chiqadi */
  leavePendingAt: string | null;
}

const localPhone = (p: string) => p.replace(/\D/g, "").slice(-9);

/** Guruh a'zolari: ochiq davrlar va yopilganlar (chiqqanlar) */
export async function groupMembers(db: TenantDb, groupId: string): Promise<{ open: MemberRow[]; left: MemberRow[] }> {
  const rows = await db
    .select({ m: groupMemberships, s: students })
    .from(groupMemberships)
    .innerJoin(students, eq(students.id, groupMemberships.studentId))
    .where(eq(groupMemberships.groupId, groupId))
    .orderBy(asc(students.name), desc(groupMemberships.enrolledAt));
  const all = rows.map(({ m, s }) => ({
    id: m.id,
    studentId: s.id,
    name: s.name,
    phone: localPhone(s.phone),
    parentName: s.parentName,
    gender: s.gender,
    status: m.status,
    enrolledAt: m.enrolledAt,
    activatedAt: m.activatedAt,
    pausedAt: m.pausedAt,
    leftAt: m.leftAt,
    leftReason: m.leftReason,
    leftNote: m.leftNote,
    leavePendingAt: m.leavePendingAt,
    archived: !!s.archivedAt,
  }));
  return {
    open: all.filter((r) => !r.leftAt && !r.archived),
    left: all.filter((r) => !!r.leftAt).sort((a, b) => (b.leftAt ?? "").localeCompare(a.leftAt ?? "")),
  };
}

export interface StudentMembershipRow {
  id: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  groupArchived: boolean;
  courseName: string;
  teacherName: string;
  days: Weekday[];
  startTime: string;
  endTime: string;
  price: number;
  startDate: string;
  status: MembershipStatus;
  enrolledAt: string;
  activatedAt: string | null;
  pausedAt: string | null;
  leftAt: string | null;
  leftReason: string | null;
  leftNote: string | null;
  /** Qarz bilan chiqarish kutilmoqda (ADR 0050): shu sana bilan chiqadi */
  leavePendingAt: string | null;
}

/** O'quvchining barcha a'zolik davrlari (ochiqlari oldin) */
export async function studentMemberships(db: TenantDb, studentId: string): Promise<StudentMembershipRow[]> {
  const rows = await db
    .select({ m: groupMemberships, g: groups, courseName: courses.name, teacherName: teachers.name })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .innerJoin(courses, eq(courses.id, groups.courseId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(eq(groupMemberships.studentId, studentId))
    .orderBy(desc(groupMemberships.enrolledAt));
  return rows
    .map(({ m, g, courseName, teacherName }) => ({
      id: m.id,
      groupId: g.id,
      groupName: g.name,
      groupColor: g.color,
      groupArchived: !!g.archivedAt,
      courseName,
      teacherName,
      days: sortDays(g.days),
      startTime: g.startTime,
      endTime: g.endTime,
      price: g.price,
      startDate: g.startDate,
      status: m.status,
      enrolledAt: m.enrolledAt,
      activatedAt: m.activatedAt,
      pausedAt: m.pausedAt,
      leftAt: m.leftAt,
      leftReason: m.leftReason,
      leftNote: m.leftNote,
      leavePendingAt: m.leavePendingAt,
    }))
    .sort((a, b) => Number(!!a.leftAt) - Number(!!b.leftAt));
}

/** O'quvchilar ro'yxati uchun: har o'quvchining ochiq guruhlari */
export async function openGroupsByStudent(db: TenantDb, studentIds: string[]) {
  if (!studentIds.length)
    return new Map<string, { id: string; name: string; teacher: string; status: MembershipStatus }[]>();
  const rows = await db
    .select({
      studentId: groupMemberships.studentId,
      id: groups.id,
      name: groups.name,
      teacher: teachers.name,
      status: groupMemberships.status,
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(
      and(inArray(groupMemberships.studentId, studentIds), isNull(groupMemberships.leftAt), isNull(groups.archivedAt)),
    )
    .orderBy(asc(groups.name));
  const map = new Map<string, { id: string; name: string; teacher: string; status: MembershipStatus }[]>();
  for (const r of rows) {
    const list = map.get(r.studentId) ?? [];
    list.push({ id: r.id, name: r.name, teacher: r.teacher, status: r.status });
    map.set(r.studentId, list);
  }
  return map;
}

/** O'quvchini qo'shish oynasi uchun: faol o'quvchilar (filial cheklovi bilan) */
export async function studentCandidates(db: TenantDb, filter: readonly string[] | null) {
  const rows = await db
    .select({ id: students.id, name: students.name, phone: students.phone, branchId: students.branchId })
    .from(students)
    .where(and(isNull(students.archivedAt), filter ? inArray(students.branchId, [...filter]) : undefined))
    .orderBy(asc(students.name));
  return rows.map((r) => ({ ...r, phone: localPhone(r.phone) }));
}

/** Arxivlangan guruhlar (Arxiv sahifasi uchun) */
export async function archivedGroups(db: TenantDb, filter: readonly string[] | null) {
  return db
    .select({ id: groups.id, name: groups.name, branchId: groups.branchId, archivedAt: groups.archivedAt })
    .from(groups)
    .where(and(isNotNull(groups.archivedAt), filter ? inArray(groups.branchId, [...filter]) : undefined))
    .orderBy(desc(groups.archivedAt));
}

/** Guruh formasi uchun tanlovlar: faol kurslar, asosiy o'qituvchilar, xonalar */
export async function groupFormOptions(db: TenantDb, filter: readonly string[] | null) {
  const [cs, ts, rs] = await Promise.all([
    db
      .select({
        id: courses.id,
        name: courses.name,
        price: courses.price,
        durationMonths: courses.durationMonths,
        branchId: courses.branchId,
        color: courses.color,
      })
      .from(courses)
      .where(isNull(courses.archivedAt))
      .orderBy(asc(courses.name)),
    db
      .select({
        id: teachers.id,
        name: teachers.name,
        branchId: teachers.branchId,
        salaryType: teachers.salaryType,
        revenueSharePercent: teachers.revenueSharePercent,
        perStudentSalary: teachers.perStudentSalary,
        fixedSalary: teachers.fixedSalary,
      })
      .from(teachers)
      .where(
        and(
          isNull(teachers.archivedAt),
          eq(teachers.kind, "teacher"),
          filter ? inArray(teachers.branchId, [...filter]) : undefined,
        ),
      )
      .orderBy(asc(teachers.name)),
    db
      .select({ id: rooms.id, name: rooms.name, capacity: rooms.capacity, branchId: rooms.branchId })
      .from(rooms)
      .orderBy(asc(rooms.name)),
  ]);
  const visible = (b: string | null) => !b || !filter || filter.includes(b);
  return { courses: cs.filter((c) => visible(c.branchId)), teachers: ts, rooms: rs.filter((r) => visible(r.branchId)) };
}

/** Guruh tanlash ro'yxati (qidiruvli tanlov uchun): arxivda bo'lmagan guruhlar, kurs, o'qituvchi va vaqt bilan */
export async function groupPickOptions(
  db: TenantDb,
  filter: readonly string[] | null,
): Promise<{ value: string; label: string; hint: string; branchId: string }[]> {
  const rows = await listGroups(db, filter);
  return rows.map((g) => ({
    value: g.id,
    label: g.name,
    hint: `${g.courseName} · ${g.teacherName} · ${g.startTime}`,
    branchId: g.branchId,
  }));
}

/* ---------- Guruh profili: a'zolar bo'yicha pul va davomat ---------- */

/** Davomat foizi shu necha kun ichidagi belgilangan darslardan hisoblanadi */
export const ATTENDANCE_DAYS = 30;

export interface MemberStat {
  /** null — moliya bo'limi o'chiq yoki ruxsat yo'q */
  money: MemberMoney | null;
  /** null — Davomat bo'limi o'chiq */
  attendance: AttendanceStat | null;
}

export interface GroupProfileStats {
  /** Guruh yig'indisi (shu oy hisoblangan/yig'ilgan, jami qarz); null — moliya yo'q */
  finance: GroupFinance | null;
  /** Ochiq a'zolikdagi o'quvchi id → ko'rsatkichlar */
  members: Record<string, MemberStat>;
}

const NO_MONEY = (groupId: string, month: string) => memberMoney({ groups: [] }, [], groupId, month);

/**
 * Guruh a'zolarining shu guruh bo'yicha puli (bitta hisob yuklash — kartalar ham, qatorlar ham shundan) va
 * so'nggi `ATTENDANCE_DAYS` kundagi davomati. Faqat o'qish: yozuv yo'q, yangi hisob qoidasi yo'q.
 */
export async function groupProfileStats(
  db: TenantDb,
  groupId: string,
  today: string,
  open: readonly { studentId: string; enrolledAt: string }[],
  on: { finance: boolean; attendance: boolean },
): Promise<GroupProfileStats> {
  const month = today.slice(0, 7);
  const members: Record<string, MemberStat> = Object.fromEntries(
    open.map((m) => [m.studentId, { money: null, attendance: null }]),
  );
  let finance: GroupFinance | null = null;

  if (on.finance) {
    // Chiqqanlar ham: ularning qarzi guruh qarziga kiradi (to'lov sahifalaridagi hisob bilan bir xil)
    const all = await db
      .select({ studentId: groupMemberships.studentId })
      .from(groupMemberships)
      .where(eq(groupMemberships.groupId, groupId));
    const accounts = await loadAccounts(
      db,
      all.map((r) => r.studentId),
      today,
    );
    const total = { month, charged: 0, collected: 0, due: 0 };
    for (const [studentId, { summary, entries }] of accounts) {
      const money = memberMoney(summary, entries, groupId, month);
      total.charged += money.monthCharged;
      total.collected += money.collected;
      total.due += money.due;
      const row = members[studentId];
      if (row) row.money = money;
    }
    // Sinovdagilar hisobga kirmaydi (faollashtirilmagan) — ularning puli nol
    for (const row of Object.values(members)) row.money ??= NO_MONEY(groupId, month);
    finance = total;
  }

  if (on.attendance && open.length) {
    const from = daysAgo(today, ATTENDANCE_DAYS);
    const rows = await db
      .select({ studentId: attendance.studentId, date: attendance.date, status: attendance.status })
      .from(attendance)
      .where(
        and(
          eq(attendance.groupId, groupId),
          gte(attendance.date, from),
          lte(attendance.date, today),
          inArray(
            attendance.studentId,
            open.map((m) => m.studentId),
          ),
        ),
      );
    for (const m of open) {
      const marks = rows.filter((r) => r.studentId === m.studentId);
      members[m.studentId]!.attendance = attendanceStat(marks, m.enrolledAt > from ? m.enrolledAt : from);
    }
  }
  return { finance, members };
}
