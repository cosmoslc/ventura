import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import type { SearchSelectOption } from "@ventura/ui/search-select";
import {
  type StudentStatus,
  auditEvents,
  courses,
  groups,
  settings,
  studentNotes,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { DEFAULT_STUDENT_FIELDS, type FormField, STUDENT_FIELDS_KEY, parseFormFields } from "@/lib/form-fields";

export interface StudentRow {
  id: string;
  branchId: string;
  name: string;
  /** 9 ta mahalliy raqam */
  phone: string;
  parentName: string | null;
  parentPhone: string | null;
  birthDate: string | null;
  gender: "male" | "female" | null;
  school: string | null;
  grade: string | null;
  address: string | null;
  source: string | null;
  interestedCourseId: string | null;
  note: string | null;
  /** "O'quvchi formasi"dagi qo'shimcha maydonlar qiymati */
  customData: Record<string, string>;
  status: StudentStatus;
  statusNote: string | null;
  joinedAt: string;
  createdAt: string;
  /** Ochiq a'zolikdagi guruhlar (ro'yxat sahifasida to'ldiriladi) */
  groups: { id: string; name: string; teacher: string | null; status: string }[];
  /** Balans (to'lovlar − oylik hisoblar); null — moliya bo'limi o'chiq yoki ko'rish ruxsati yo'q */
  balance: number | null;
  /** O'chirilgan (arxivga o'tkazilgan) vaqti; null — ro'yxatdagi o'quvchi */
  archivedAt: string | null;
  /** Portalga kirish hisobi (ADR 0063) */
  userId: string | null;
  hasLogin: boolean;
}

const localPhone = (phone: string | null) => (phone ?? "").replace(/\D/g, "").slice(-9);

export function toStudentRow(s: typeof students.$inferSelect): StudentRow {
  return {
    id: s.id,
    branchId: s.branchId,
    name: s.name,
    phone: localPhone(s.phone),
    parentName: s.parentName,
    parentPhone: s.parentPhone ? localPhone(s.parentPhone) : null,
    birthDate: s.birthDate,
    gender: s.gender,
    school: s.school,
    grade: s.grade,
    address: s.address,
    source: s.source,
    interestedCourseId: s.interestedCourseId,
    note: s.note,
    customData: s.customData,
    status: s.status,
    statusNote: s.statusNote,
    joinedAt: s.joinedAt,
    createdAt: s.createdAt.toISOString(),
    groups: [],
    balance: null,
    archivedAt: s.archivedAt?.toISOString() ?? null,
    userId: s.userId ?? null,
    hasLogin: !!s.userId,
  };
}

/** Faol (arxivda bo'lmagan) o'quvchilar; `filter` — getBranchContext().filter */
export async function listStudents(db: TenantDb, filter: readonly string[] | null, id?: string): Promise<StudentRow[]> {
  const rows = await db
    .select()
    .from(students)
    .where(
      and(
        isNull(students.archivedAt),
        filter ? inArray(students.branchId, [...filter]) : undefined,
        id ? eq(students.id, id) : undefined,
      ),
    )
    .orderBy(desc(students.createdAt));
  return rows.map(toStudentRow);
}

/** O'chirilgan (arxivdagi) o'quvchilar — ro'yxatdagi "O'chirilganlar" filtri uchun, oxirgi o'chirilgani birinchi */
export async function listArchivedStudentRows(db: TenantDb, filter: readonly string[] | null): Promise<StudentRow[]> {
  const rows = await db
    .select()
    .from(students)
    .where(and(isNotNull(students.archivedAt), filter ? inArray(students.branchId, [...filter]) : undefined))
    .orderBy(desc(students.archivedAt));
  return rows.map(toStudentRow);
}

/** "O'quvchi formasi" qo'shimcha maydonlari (sozlamalar jadvalidan) */
export async function getStudentFields(db: TenantDb): Promise<FormField[]> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, STUDENT_FIELDS_KEY));
  return parseFormFields(row?.value, DEFAULT_STUDENT_FIELDS);
}

export interface GroupChoice extends SearchSelectOption {
  archived: boolean;
}

/**
 * "Guruh tanlash" maydoni uchun guruhlar (xodimning filiallari). Arxivdagilar ham qaytadi — profilda saqlangan
 * qiymat nomi ko'rinsin; formada faqat arxivda bo'lmaganlari tanlanadi. Formada guruh maydoni bo'lmasa so'rov yo'q.
 */
export async function groupChoices(
  db: TenantDb,
  filter: readonly string[] | null,
  fields: readonly FormField[],
): Promise<GroupChoice[]> {
  if (!fields.some((f) => f.type === "group")) return [];
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      startTime: groups.startTime,
      archivedAt: groups.archivedAt,
      course: courses.name,
      teacher: teachers.name,
    })
    .from(groups)
    .leftJoin(courses, eq(courses.id, groups.courseId))
    .leftJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(filter ? inArray(groups.branchId, [...filter]) : undefined)
    .orderBy(asc(groups.name));
  return rows.map((g) => ({
    value: g.id,
    label: g.name,
    hint: [g.course, g.teacher, g.startTime?.slice(0, 5)].filter(Boolean).join(" · "),
    archived: !!g.archivedAt,
  }));
}

export async function courseOptions(db: TenantDb) {
  return db
    .select({ id: courses.id, name: courses.name })
    .from(courses)
    .where(isNull(courses.archivedAt))
    .orderBy(asc(courses.name));
}

export interface StudentNoteRow {
  id: string;
  kind: string;
  text: string;
  author: string;
  authorId: string | null;
  at: string;
}

export async function studentNotesOf(db: TenantDb, studentId: string): Promise<StudentNoteRow[]> {
  const rows = await db
    .select()
    .from(studentNotes)
    .where(eq(studentNotes.studentId, studentId))
    .orderBy(desc(studentNotes.createdAt));
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    text: n.text,
    author: n.authorName,
    authorId: n.authorId,
    at: n.createdAt.toISOString(),
  }));
}

export interface HistoryRow {
  id: string;
  action: string;
  actor: string | null;
  at: string;
  metadata: Record<string, unknown>;
}

/** Tarix — faoliyat jurnalidan (o'ylab topilgan yozuv yo'q) */
export async function studentHistory(db: TenantDb, studentId: string): Promise<HistoryRow[]> {
  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      actor: auditEvents.actorName,
      at: auditEvents.at,
      metadata: auditEvents.metadata,
    })
    .from(auditEvents)
    .where(and(eq(auditEvents.targetType, "student"), eq(auditEvents.targetId, studentId)))
    .orderBy(desc(auditEvents.seq))
    .limit(200);
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
}

export interface ArchivedStudentRow {
  id: string;
  name: string;
  phone: string;
  parentPhone: string | null;
  branchId: string;
  reason: string | null;
  archivedAt: string;
  archivedBy: string | null;
}

export async function archivedStudents(db: TenantDb, filter: readonly string[] | null): Promise<ArchivedStudentRow[]> {
  const rows = await db
    .select()
    .from(students)
    .where(and(isNotNull(students.archivedAt), filter ? inArray(students.branchId, [...filter]) : undefined))
    .orderBy(desc(students.archivedAt));
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    phone: localPhone(s.phone),
    parentPhone: s.parentPhone ? localPhone(s.parentPhone) : null,
    branchId: s.branchId,
    reason: s.archiveReason,
    archivedAt: s.archivedAt!.toISOString(),
    archivedBy: s.archivedBy,
  }));
}
