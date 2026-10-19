import "server-only";
import { and, asc, count, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  type MembershipStatus,
  type TeacherKind,
  type TeacherSalaryType,
  type Weekday,
  attendance,
  groupMemberships,
  groups,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { attendanceRate, monthBounds, retentionRate } from "@/lib/teacher-stats";

export interface TeacherRow {
  id: string;
  kind: TeacherKind;
  branchId: string;
  name: string;
  /** 9 ta mahalliy raqam */
  phone: string;
  gender: "male" | "female" | null;
  birthDate: string | null;
  assignedTeacherId: string | null;
  salaryType: TeacherSalaryType;
  revenueSharePercent: number;
  perStudentSalary: number;
  fixedSalary: number;
  /** Belgilangan oylik shu sanadan; null — avtomatik */
  salaryStartDate: string | null;
  workingDays: Weekday[];
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  /** Biriktirilgan guruhlar soni (support qatorlarida 0 — guruhga emas, o'qituvchiga biriktiriladi) */
  groups: number;
  students: number;
  /** Joriy oy retention sanoqlari (profildagi bilan bir xil hisob, ADR 0021) */
  retentionBase: number;
  retentionKept: number;
  /** Joriy oy hisoblangan ulushi (ish haqi hisobidan); ish haqini ko'rish ruxsati bo'lmasa — null */
  share: number | null;
  /** Kabinetga kirish hisobi bor (ADR 0062) */
  hasLogin: boolean;
}

/** Biriktirilgan ustoz nomi uchun (bo'shatilgan bo'lsa ham) */
export interface TeacherRef {
  id: string;
  name: string;
  archived: boolean;
}

const localPhone = (phone: string) => phone.replace(/\D/g, "").slice(-9);
const isWeekday = (d: string): d is Weekday => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(d);

function toRow(t: typeof teachers.$inferSelect): TeacherRow {
  return {
    id: t.id,
    kind: t.kind,
    branchId: t.branchId,
    name: t.name,
    phone: localPhone(t.phone),
    gender: t.gender,
    birthDate: t.birthDate,
    assignedTeacherId: t.assignedTeacherId,
    salaryType: t.salaryType,
    revenueSharePercent: t.revenueSharePercent,
    perStudentSalary: t.perStudentSalary,
    fixedSalary: t.fixedSalary,
    salaryStartDate: t.salaryStartDate,
    workingDays: t.workingDays.filter(isWeekday),
    startTime: t.startTime,
    endTime: t.endTime,
    note: t.note,
    hasLogin: t.userId !== null,
    groups: 0,
    students: 0,
    retentionBase: 0,
    retentionKept: 0,
    share: null,
  };
}

/** Faol o'qituvchilar; `filter` — getBranchContext().filter (null — cheklovsiz) */
export async function listTeachers(db: TenantDb, filter: readonly string[] | null, id?: string): Promise<TeacherRow[]> {
  const rows = await db
    .select()
    .from(teachers)
    .where(
      and(
        isNull(teachers.archivedAt),
        filter ? inArray(teachers.branchId, [...filter]) : undefined,
        id ? eq(teachers.id, id) : undefined,
      ),
    )
    .orderBy(asc(teachers.createdAt), asc(teachers.name));
  return rows.map(toRow);
}

/** Har o'qituvchi guruhlaridagi a'zolik davrlari (arxivdagi guruhlar ham) — ro'yxatdagi retention uchun */
export async function teacherSpans(
  db: TenantDb,
): Promise<Map<string, { enrolledAt: string; leftAt: string | null }[]>> {
  const rows = await db
    .select({ teacherId: groups.teacherId, enrolledAt: groupMemberships.enrolledAt, leftAt: groupMemberships.leftAt })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId));
  const map = new Map<string, { enrolledAt: string; leftAt: string | null }[]>();
  for (const r of rows) map.set(r.teacherId, [...(map.get(r.teacherId) ?? []), r]);
  return map;
}

export async function teacherRefs(db: TenantDb, ids: string[]): Promise<TeacherRef[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: teachers.id, name: teachers.name, archivedAt: teachers.archivedAt })
    .from(teachers)
    .where(inArray(teachers.id, ids));
  return rows.map((r) => ({ id: r.id, name: r.name, archived: !!r.archivedAt }));
}

export interface TeacherStudentRow {
  studentId: string;
  name: string;
  /** 9 ta mahalliy raqam */
  phone: string;
  groupId: string;
  groupName: string;
  status: MembershipStatus;
  enrolledAt: string;
}

export interface TeacherOverview {
  /** Hozirgi guruhlaridagi ochiq a'zoliklar (o'quvchi bir nechta guruhda bo'lsa — har biri alohida) */
  students: TeacherStudentRow[];
  /** Tanlangan oy: retention va davomat foizi; null — hisoblab bo'lmaydi */
  retention: number | null;
  attendance: number | null;
}

/**
 * O'qituvchi profili ko'rsatkichlari (ADR 0021) — guruhning hozirgi o'qituvchisi bo'yicha (o'qituvchi almashish
 * tarixi saqlanmaydi, ADR 0018). Arxivdagi guruhlar retention'ga kiradi (oy boshida bo'lgan bo'lishi mumkin).
 */
export async function teacherOverview(
  db: TenantDb,
  teacherId: string,
  month: string,
  today: string,
): Promise<TeacherOverview> {
  const { start, end } = monthBounds(month, today);
  const [open, spans, [att]] = await Promise.all([
    db
      .select({
        studentId: students.id,
        name: students.name,
        phone: students.phone,
        groupId: groups.id,
        groupName: groups.name,
        status: groupMemberships.status,
        enrolledAt: groupMemberships.enrolledAt,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .innerJoin(students, eq(students.id, groupMemberships.studentId))
      .where(
        and(
          eq(groups.teacherId, teacherId),
          isNull(groups.archivedAt),
          isNull(groupMemberships.leftAt),
          isNull(students.archivedAt),
        ),
      )
      .orderBy(asc(students.name)),
    db
      .select({ enrolledAt: groupMemberships.enrolledAt, leftAt: groupMemberships.leftAt })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(eq(groups.teacherId, teacherId)),
    db
      .select({
        ok: sql<number>`count(*) filter (where ${attendance.status} in ('present', 'late'))`.mapWith(Number),
        total: count(),
      })
      .from(attendance)
      .innerJoin(groups, eq(groups.id, attendance.groupId))
      .where(and(eq(groups.teacherId, teacherId), gte(attendance.date, start), lte(attendance.date, end))),
  ]);
  return {
    students: open.map((r) => ({ ...r, phone: localPhone(r.phone) })),
    retention: retentionRate(spans, month, today),
    attendance: attendanceRate(att?.ok ?? 0, att?.total ?? 0),
  };
}
