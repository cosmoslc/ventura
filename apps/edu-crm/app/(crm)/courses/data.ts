import "server-only";
import { and, asc, inArray, isNull, or } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { courses } from "@ventura/db/schema/tenant";
import type { BranchContext } from "@/lib/server/branch";

export interface CourseGroup {
  id: string;
  name: string;
  color: string | null;
  teacher: string | null;
  days: string[];
  time: string | null;
  students: number;
  paid: number;
}

export interface CourseRow {
  id: string;
  branchId: string | null;
  name: string;
  price: number;
  durationMonths: number;
  color: string;
  /** Kursning guruhlari va o'quvchilari — guruhlar jadvali bilan (E1d); hozircha guruh yo'q */
  groups: CourseGroup[];
  students: number;
  /** Oylik kutilayotgan tushum: Σ (guruh narxi yoki kurs narxi) × guruhdagi o'quvchilar */
  revenue: number;
}

/** Faol (arxivlanmagan) kurslar: tanlangan filiallar va markaz bo'yicha umumiy (filialsiz) kurslar. */
export async function listCourses(db: TenantDb, branch: BranchContext): Promise<CourseRow[]> {
  const scope =
    branch.filter === null
      ? undefined
      : branch.filter.length
        ? or(isNull(courses.branchId), inArray(courses.branchId, branch.filter))
        : isNull(courses.branchId);
  const rows = await db
    .select()
    .from(courses)
    .where(and(isNull(courses.archivedAt), scope))
    .orderBy(asc(courses.createdAt));
  return rows.map((c) => ({
    id: c.id,
    branchId: c.branchId,
    name: c.name,
    price: c.price,
    durationMonths: c.durationMonths,
    color: c.color,
    groups: [],
    students: 0,
    revenue: 0,
  }));
}
