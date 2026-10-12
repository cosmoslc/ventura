import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { type StudentStatus, auditEvents, courses, studentNotes, students } from "@ventura/db/schema/tenant";

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
  status: StudentStatus;
  statusNote: string | null;
  joinedAt: string;
  createdAt: string;
  /** Ochiq a'zolikdagi guruhlar (ro'yxat sahifasida to'ldiriladi) */
  groups: { id: string; name: string; teacher: string | null; status: string }[];
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
    status: s.status,
    statusNote: s.statusNote,
    joinedAt: s.joinedAt,
    createdAt: s.createdAt.toISOString(),
    groups: [],
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
