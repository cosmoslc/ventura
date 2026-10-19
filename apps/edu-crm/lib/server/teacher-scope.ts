import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { groupMemberships, groups } from "@ventura/db/schema/tenant";
import type { Db } from "./memberships";

/*
 * "Faqat o'z guruhlari" (ADR 0062): o'qituvchi hisobi faqat o'zi asosiy o'qituvchi bo'lgan guruhlarni va ulardagi
 * o'quvchilarni ko'radi. Admin xodim uchun cheklov yo'q (filial cheklovi odatdagidek). Har amal server tomonida
 * shu yerdagi funksiyalar bilan tekshiradi — UI'da yashirish yetarli emas.
 */

export interface ScopedStaff {
  kind: "staff" | "teacher";
  teacherId: string | null;
}

/** Guruh shu xodimga ochiqmi: admin — ha (filial alohida tekshiriladi), o'qituvchi — faqat o'z guruhi */
export function ownsGroup(staff: ScopedStaff, group: { teacherId: string }): boolean {
  return staff.kind !== "teacher" || (!!staff.teacherId && group.teacherId === staff.teacherId);
}

/** O'qituvchining guruhlari (arxivlanmaganlari) */
export async function teacherGroupIds(db: Db, teacherId: string): Promise<string[]> {
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.teacherId, teacherId), isNull(groups.archivedAt)));
  return rows.map((r) => r.id);
}

/** O'quvchi o'qituvchining biror guruhida bo'lganmi (chiqqanlari ham — tarix ko'rinadi) */
export async function teacherHasStudent(db: Db, teacherId: string, studentId: string): Promise<boolean> {
  const ids = await teacherGroupIds(db, teacherId);
  if (!ids.length) return false;
  const [row] = await db
    .select({ id: groupMemberships.id })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.studentId, studentId), inArray(groupMemberships.groupId, ids)))
    .limit(1);
  return !!row;
}

/** Xodim shu o'quvchini ko'ra oladimi: admin — ha, o'qituvchi — o'z guruhlarida bo'lsa */
export async function canSeeStudent(db: Db, staff: ScopedStaff, studentId: string): Promise<boolean> {
  if (staff.kind !== "teacher") return true;
  return !!staff.teacherId && teacherHasStudent(db, staff.teacherId, studentId);
}
