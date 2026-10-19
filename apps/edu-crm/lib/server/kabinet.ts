import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { teachers } from "@ventura/db/schema/tenant";
import { listGroups } from "@/app/(crm)/groups/data";

/*
 * O'qituvchi kabineti ma'lumotlari (ADR 0062). Hamma yuklovchi `teacherId` bilan cheklanadi — boshqa o'qituvchi
 * guruhi yoki o'quvchisi hech qachon qaytmaydi.
 */

export interface KabinetGroup {
  id: string;
  name: string;
  courseName: string;
  color: string;
  days: string[];
  startTime: string;
  endTime: string;
  roomName: string | null;
  students: number;
}

/** O'qituvchining faol guruhlari (o'quvchilar soni — sinov va faol a'zolar) */
export async function kabinetGroups(db: TenantDb, teacherId: string): Promise<KabinetGroup[]> {
  const rows = (await listGroups(db, null)).filter((g) => g.teacherId === teacherId);
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    courseName: g.courseName,
    color: g.color,
    days: g.days,
    startTime: g.startTime,
    endTime: g.endTime,
    roomName: g.roomName,
    students: g.members.trial + g.members.active,
  }));
}

/** Profil: o'qituvchi kartasi */
export async function kabinetTeacher(db: TenantDb, teacherId: string) {
  const [t] = await db
    .select({
      id: teachers.id,
      name: teachers.name,
      phone: teachers.phone,
      gender: teachers.gender,
      birthDate: teachers.birthDate,
    })
    .from(teachers)
    .where(and(eq(teachers.id, teacherId), isNull(teachers.archivedAt)));
  return t ?? null;
}
