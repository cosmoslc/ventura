import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { type TeacherKind, type TeacherSalaryType, type Weekday, teachers } from "@ventura/db/schema/tenant";

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
  workingDays: Weekday[];
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  /** Guruhlar bo'limi (E1d) bilan to'ladi; hozircha 0 */
  groups: number;
  students: number;
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
    workingDays: t.workingDays.filter(isWeekday),
    startTime: t.startTime,
    endTime: t.endTime,
    note: t.note,
    groups: 0,
    students: 0,
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

export async function teacherRefs(db: TenantDb, ids: string[]): Promise<TeacherRef[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: teachers.id, name: teachers.name, archivedAt: teachers.archivedAt })
    .from(teachers)
    .where(inArray(teachers.id, ids));
  return rows.map((r) => ({ id: r.id, name: r.name, archived: !!r.archivedAt }));
}
