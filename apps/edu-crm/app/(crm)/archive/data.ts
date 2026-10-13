import "server-only";
import { and, desc, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { courses, leads, teachers, users } from "@ventura/db/schema/tenant";
import { archivedGroups } from "../groups/data";
import { type ArchivedStudentRow, archivedStudents } from "../students/data";

export interface ArchivedItem {
  id: string;
  name: string;
  phone: string | null;
  branchId: string | null;
  archivedAt: string;
}

export interface ArchiveData {
  students: (ArchivedStudentRow & { archivedByName: string | null })[];
  courses: ArchivedItem[];
  teachers: ArchivedItem[];
  groups: ArchivedItem[];
  /** O'chirilgan lidlar (E4b); bo'lim o'chiq bo'lsa — bo'sh */
  leads: ArchivedItem[];
}

const localPhone = (p: string) => p.replace(/\D/g, "").slice(-9);

/** Arxivdagi yozuvlar; `filter` — getBranchContext().filter (umumiy kurslar hammaga ko'rinadi) */
export async function archiveData(
  db: TenantDb,
  filter: readonly string[] | null,
  withLeads = false,
): Promise<ArchiveData> {
  const [st, cs, ts, gs, ls] = await Promise.all([
    archivedStudents(db, filter),
    db
      .select()
      .from(courses)
      .where(
        and(
          isNotNull(courses.archivedAt),
          filter ? or(isNull(courses.branchId), inArray(courses.branchId, [...filter])) : undefined,
        ),
      )
      .orderBy(desc(courses.archivedAt)),
    db
      .select()
      .from(teachers)
      .where(and(isNotNull(teachers.archivedAt), filter ? inArray(teachers.branchId, [...filter]) : undefined))
      .orderBy(desc(teachers.archivedAt)),
    archivedGroups(db, filter),
    withLeads
      ? db
          .select()
          .from(leads)
          .where(and(isNotNull(leads.archivedAt), filter ? inArray(leads.branchId, [...filter]) : undefined))
          .orderBy(desc(leads.archivedAt))
      : Promise.resolve([]),
  ]);
  const actorIds = [...new Set(st.flatMap((s) => (s.archivedBy ? [s.archivedBy] : [])))];
  const actors = actorIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds))
    : [];
  return {
    students: st.map((s) => ({ ...s, archivedByName: actors.find((a) => a.id === s.archivedBy)?.name ?? null })),
    courses: cs.map((c) => ({
      id: c.id,
      name: c.name,
      phone: null,
      branchId: c.branchId,
      archivedAt: c.archivedAt!.toISOString(),
    })),
    groups: gs.map((g) => ({
      id: g.id,
      name: g.name,
      phone: null,
      branchId: g.branchId,
      archivedAt: g.archivedAt!.toISOString(),
    })),
    leads: ls.map((l) => ({
      id: l.id,
      name: l.name,
      phone: localPhone(l.phone),
      branchId: l.branchId,
      archivedAt: l.archivedAt!.toISOString(),
    })),
    teachers: ts.map((t) => ({
      id: t.id,
      name: t.name,
      phone: localPhone(t.phone),
      branchId: t.branchId,
      archivedAt: t.archivedAt!.toISOString(),
    })),
  };
}
