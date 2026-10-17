import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  type AttendanceStatus,
  type FirstLessonStatus,
  attendance,
  groupMemberships,
  leadFirstLessons,
  leads,
  students,
} from "@ventura/db/schema/tenant";
import { holidayRanges } from "@/app/(crm)/(settings)/holidays/data";
import { type MemberPeriod, lessonDates, monthRange } from "@/lib/lessons";

/*
 * Guruh davomati ma'lumoti (ADR 0014): oy dars sanalari (bayramlarsiz), shu oyda guruhda bo'lgan a'zolar
 * (chiqqanlar ham — tarix yo'qolmaydi) va belgilar. Belgisi yo'q kun — "belgilanmagan", taxmin qilinmaydi.
 */

/** Bitta o'quvchi — oyda bir nechta davri bo'lishi mumkin (chiqib, qayta qo'shilgan) */
export interface AttendanceMember {
  studentId: string;
  name: string;
  phone: string;
  periods: MemberPeriod[];
}

/** Birinchi (sinov) darsga yozilgan lid (E4b): o'quvchi emas, davomat va hisobga kirmaydi */
export interface FirstLessonGuest {
  leadId: string;
  name: string;
  phone: string;
  date: string;
  status: FirstLessonStatus;
}

export interface AttendanceMark {
  status: AttendanceStatus;
  reason: string | null;
}

export interface GroupAttendance {
  month: string;
  dates: string[];
  /** Oyga tushgan bayramlar (dars o'tmaydigan) — ko'rsatish uchun */
  holidays: { name: string; startDate: string; endDate: string }[];
  members: AttendanceMember[];
  /** `${studentId}|${date}` → belgi */
  marks: Record<string, AttendanceMark>;
  /** Shu oyda birinchi darsga yozilgan lidlar */
  guests: FirstLessonGuest[];
}

export async function groupAttendance(
  db: TenantDb,
  group: { id: string; days: readonly string[]; startDate: string; branchId: string },
  month: string,
): Promise<GroupAttendance> {
  const [from, to] = monthRange(month);
  const ranges = await holidayRanges(db, from, to);
  const dates = lessonDates(group, from, to, ranges);
  const rows = await db
    .select({ m: groupMemberships, name: students.name, phone: students.phone })
    .from(groupMemberships)
    .innerJoin(students, eq(students.id, groupMemberships.studentId))
    .where(eq(groupMemberships.groupId, group.id));
  // Oy bilan kesishgan a'zolik davrlari
  const byStudent = new Map<string, AttendanceMember>();
  for (const { m, name, phone } of rows) {
    if (!(m.enrolledAt <= to && (m.leftAt === null || m.leftAt > from))) continue;
    const entry = byStudent.get(m.studentId) ?? {
      studentId: m.studentId,
      name,
      phone: phone.replace(/\D/g, "").slice(-9),
      periods: [],
    };
    entry.periods.push({
      membershipId: m.id,
      enrolledAt: m.enrolledAt,
      leftAt: m.leftAt,
      status: m.status,
      pausedAt: m.pausedAt,
    });
    byStudent.set(m.studentId, entry);
  }
  const members = [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name));
  const marks: Record<string, AttendanceMark> = {};
  if (members.length) {
    const list = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.groupId, group.id),
          gte(attendance.date, from),
          lte(attendance.date, to),
          inArray(
            attendance.studentId,
            members.map((m) => m.studentId),
          ),
        ),
      );
    for (const a of list) marks[`${a.studentId}|${a.date}`] = { status: a.status, reason: a.reason };
  }
  const guests = await db
    .select({
      leadId: leads.id,
      name: leads.name,
      phone: leads.phone,
      date: leadFirstLessons.lessonDate,
      status: leadFirstLessons.status,
    })
    .from(leadFirstLessons)
    .innerJoin(leads, eq(leads.id, leadFirstLessons.leadId))
    .where(
      and(
        eq(leadFirstLessons.groupId, group.id),
        gte(leadFirstLessons.lessonDate, from),
        lte(leadFirstLessons.lessonDate, to),
        isNull(leads.archivedAt),
      ),
    )
    .orderBy(asc(leads.name));
  return {
    month,
    dates,
    holidays: ranges
      .filter((h) => h.affectsLessons && (h.branchIds === null || h.branchIds.includes(group.branchId)))
      .map((h) => ({
        name: h.name,
        startDate: h.startDate,
        endDate: h.endDate,
      })),
    members,
    marks,
    guests: guests.map((g) => ({ ...g, phone: g.phone.replace(/\D/g, "").slice(-9) })),
  };
}
