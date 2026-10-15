import "server-only";
import { and, asc, inArray, isNull, or } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { courses } from "@ventura/db/schema/tenant";
import type { BranchContext } from "@/lib/server/branch";
import { listGroups } from "../groups/data";

export interface CourseGroup {
  id: string;
  name: string;
  color: string | null;
  teacher: string | null;
  days: string[];
  time: string | null;
  students: number;
}

export interface CourseRow {
  id: string;
  branchId: string | null;
  name: string;
  price: number;
  durationMonths: number;
  color: string;
  /** Kursning faol guruhlari va ulardagi o'quvchilar (takrorsiz) */
  groups: CourseGroup[];
  students: number;
  /** Oylik kutilayotgan tushum: Σ guruh narxi × guruhdagi faol o'quvchilar */
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
  const all = await listGroups(db, branch.filter);
  return rows.map((c) => {
    const mine = all.filter((g) => g.courseId === c.id);
    return {
      id: c.id,
      branchId: c.branchId,
      name: c.name,
      price: c.price,
      durationMonths: c.durationMonths,
      color: c.color,
      groups: mine.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        teacher: g.teacherName,
        days: g.days,
        time: `${g.startTime} - ${g.endTime}`,
        students: g.studentIds.length,
      })),
      students: new Set(mine.flatMap((g) => g.studentIds)).size,
      // Sinovdagi va muzlatilganlar to'lamaydi: faqat faol a'zolar × guruh narxi (to'liq oy; ulushli hisob — E3)
      revenue: mine.reduce((sum, g) => sum + g.price * g.members.active, 0),
    };
  });
}
