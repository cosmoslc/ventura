import "server-only";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { attendance, groupMemberships, studentNotes, students } from "@ventura/db/schema/tenant";
import { holidayRanges } from "@/app/(crm)/holidays/data";
import { listGroups } from "@/app/(crm)/groups/data";
import { type ReportMark, type ReportStats, studentStats } from "@/lib/attendance-report";
import { type MemberPeriod, lessonDates } from "@/lib/lessons";
import { tashkentDate } from "./memberships";

/*
 * Davomat hisoboti ma'lumoti (ADR 0014): tanlangan davrda guruhda bo'lgan har o'quvchi × guruh uchun
 * ko'rsatkichlar. Ketma-ket qoldirish va "avvalgi dars" uchun davrdan oldingi HISTORY_DAYS kun ham o'qiladi.
 */

const HISTORY_DAYS = 90;
/** "Bog'lanildi" deb hisoblanadigan eslatma turlari (qo'ng'iroq, ota-ona bilan suhbat) */
const CONTACT_KINDS = ["call", "parent"] as const;

export interface ReportRow extends ReportStats {
  /** `${studentId}|${groupId}` */
  key: string;
  studentId: string;
  name: string;
  phone: string;
  groupId: string;
  groupName: string;
  courseId: string;
  teacherName: string;
  startTime: string;
  /** Guruhdagi oxirgi holati (chiqqan bo'lsa — left) */
  memberStatus: MemberPeriod["status"];
}

const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd! + n)).toISOString().slice(0, 10);
};

export async function attendanceReport(
  db: TenantDb,
  filter: readonly string[] | null,
  range: { from: string; to: string; today: string },
): Promise<ReportRow[]> {
  const { from, to, today } = range;
  const groupList = await listGroups(db, filter);
  if (!groupList.length) return [];
  const historyFrom = addDays(from, -HISTORY_DAYS);
  const groupIds = groupList.map((g) => g.id);

  const [ranges, memberships, marks] = await Promise.all([
    holidayRanges(db, historyFrom, to),
    db
      .select({ m: groupMemberships, name: students.name, phone: students.phone })
      .from(groupMemberships)
      .innerJoin(students, eq(students.id, groupMemberships.studentId))
      .where(
        and(
          inArray(groupMemberships.groupId, groupIds),
          isNull(students.archivedAt),
          lte(groupMemberships.enrolledAt, to),
        ),
      ),
    db
      .select({
        groupId: attendance.groupId,
        studentId: attendance.studentId,
        date: attendance.date,
        status: attendance.status,
        reason: attendance.reason,
      })
      .from(attendance)
      .where(and(inArray(attendance.groupId, groupIds), gte(attendance.date, historyFrom), lte(attendance.date, to))),
  ]);

  const periods = new Map<string, { name: string; phone: string; list: MemberPeriod[] }>();
  for (const { m, name, phone } of memberships) {
    // Davr bilan kesishmagan (davrdan oldin chiqib ketgan) a'zoliklar kerak emas
    if (m.leftAt !== null && m.leftAt <= from) continue;
    const key = `${m.studentId}|${m.groupId}`;
    const entry = periods.get(key) ?? { name, phone: phone.replace(/\D/g, "").slice(-9), list: [] };
    entry.list.push({
      membershipId: m.id,
      enrolledAt: m.enrolledAt,
      leftAt: m.leftAt,
      status: m.status,
      pausedAt: m.pausedAt,
    });
    periods.set(key, entry);
  }
  if (!periods.size) return [];

  const markMap = new Map<string, Map<string, ReportMark>>();
  for (const a of marks) {
    const key = `${a.studentId}|${a.groupId}`;
    const map = markMap.get(key) ?? new Map<string, ReportMark>();
    map.set(a.date, { status: a.status, reason: a.reason });
    markMap.set(key, map);
  }

  const studentIds = [...new Set([...periods.keys()].map((k) => k.split("|")[0]!))];
  const notes = await db
    .select({ studentId: studentNotes.studentId, createdAt: studentNotes.createdAt })
    .from(studentNotes)
    .where(
      and(
        inArray(studentNotes.studentId, studentIds),
        inArray(studentNotes.kind, [...CONTACT_KINDS]),
        gte(studentNotes.createdAt, new Date(`${historyFrom}T00:00:00+05:00`)),
      ),
    );
  const contacts = new Map<string, string[]>();
  for (const n of notes) contacts.set(n.studentId, [...(contacts.get(n.studentId) ?? []), tashkentDate(n.createdAt)]);

  const byId = new Map(groupList.map((g) => [g.id, g]));
  const datesOf = new Map<string, string[]>();
  const rows: ReportRow[] = [];
  for (const [key, p] of periods) {
    const [studentId, groupId] = key.split("|") as [string, string];
    const g = byId.get(groupId)!;
    const dates = datesOf.get(groupId) ?? lessonDates(g, historyFrom, to, ranges);
    datesOf.set(groupId, dates);
    const own = markMap.get(key) ?? new Map<string, ReportMark>();
    const stats = studentStats({
      lessonDates: dates,
      periods: p.list,
      marks: own,
      contacts: contacts.get(studentId) ?? [],
      from,
      to,
      today,
    });
    const markedInRange = [...own.keys()].some((d) => d >= from && d <= to);
    if (!stats.lessons && !markedInRange) continue;
    const latest = [...p.list].sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))[0]!;
    rows.push({
      ...stats,
      key,
      studentId,
      name: p.name,
      phone: p.phone,
      groupId,
      groupName: g.name,
      courseId: g.courseId,
      teacherName: g.teacherName,
      startTime: g.startTime,
      memberStatus: latest.status,
    });
  }
  return rows.sort((a, b) => b.missed - a.missed || a.name.localeCompare(b.name));
}
