import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  attendance,
  coinEntries,
  courses,
  groupHomeworks,
  groupMemberships,
  groups,
  type HomeworkAttachment,
  homeworkSubmissions,
  lessonGrades,
  rooms,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { coinBalance } from "./coins";
import { loadAccountCached } from "./finance";

/*
 * O'quvchi kabineti (Student Portal) ma'lumot yuklovchisi (ADR 0063).
 * Barcha so'rovlar faqat joriy o'quvchi (studentId) bilan cheklangan.
 * Muallif / Agent: Google Gemini
 */

export interface PortalDashboard {
  student: {
    id: string;
    name: string;
    phone: string;
  };
  balance: number;
  coins: number;
  rank: {
    current: number;
    total: number;
  };
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percent: number | null;
  };
  grades: {
    averagePercent: number | null;
    homeworkPercent: number | null;
    totalGrades: number;
  };
  todayLessons: {
    groupId: string;
    groupName: string;
    courseName: string;
    teacherName: string;
    roomName: string;
    startTime: string;
    endTime: string;
  }[];
}

/** Toshkent vaqti bo'yicha hafta kunini olish ("mon", "tue", "wed", "thu", "fri", "sat", "sun") */
export function tashkentWeekday(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+05:00`);
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[d.getDay()] ?? "mon";
}

/** Bosh sahifa ma'lumotlarini yuklash */
export async function portalDashboardData(
  db: TenantDb,
  studentId: string,
  today: string,
): Promise<PortalDashboard | null> {
  const [s] = await db
    .select({ id: students.id, name: students.name, phone: students.phone })
    .from(students)
    .where(and(eq(students.id, studentId), isNull(students.archivedAt)))
    .limit(1);
  if (!s) return null;

  // 1. Balans
  const account = await loadAccountCached(db, studentId, today);
  const balance = account.summary.balance;

  // 2. Coinlar va markazdagi reyting
  const coins = (await coinBalance(db, studentId)) ?? 0;
  const coinRanks = await db
    .select({
      studentId: coinEntries.studentId,
      total: sql<number>`coalesce(sum(${coinEntries.amount}), 0)::int`,
    })
    .from(coinEntries)
    .where(isNull(coinEntries.revokedAt))
    .groupBy(coinEntries.studentId)
    .orderBy(desc(sql`sum(${coinEntries.amount})`));

  const rankIndex = coinRanks.findIndex((r) => r.studentId === studentId);
  const rank = {
    current: rankIndex >= 0 ? rankIndex + 1 : coinRanks.length + 1,
    total: Math.max(coinRanks.length, 1),
  };

  // 3. Davomat statistikasi
  const attRows = await db
    .select({ status: attendance.status })
    .from(attendance)
    .where(eq(attendance.studentId, studentId));

  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;
  for (const r of attRows) {
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
    else if (r.status === "late") late++;
    else if (r.status === "excused") excused++;
  }
  const attTotal = attRows.length;
  const attPercent = attTotal > 0 ? Math.round(((present + late) / attTotal) * 100) : null;

  // 4. Baholar statistikasi
  const gradeRows = await db
    .select({ score: lessonGrades.score, scale: lessonGrades.scale, homework: lessonGrades.homework })
    .from(lessonGrades)
    .where(eq(lessonGrades.studentId, studentId));

  let scoreSum = 0;
  let scoreCount = 0;
  let hwDone = 0;
  let hwTotal = 0;
  for (const r of gradeRows) {
    if (r.score !== null && r.scale > 0) {
      scoreSum += (r.score / r.scale) * 100;
      scoreCount++;
    }
    if (r.homework !== null) {
      hwTotal++;
      if (r.homework) hwDone++;
    }
  }

  const averagePercent = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null;
  const homeworkPercent = hwTotal > 0 ? Math.round((hwDone / hwTotal) * 100) : null;

  // 5. Bugungi darslar
  const weekday = tashkentWeekday(today);
  const myGroups = await db
    .select({
      groupId: groups.id,
      groupName: groups.name,
      days: groups.days,
      startTime: groups.startTime,
      endTime: groups.endTime,
      courseName: courses.name,
      teacherName: teachers.name,
      roomName: rooms.name,
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .leftJoin(courses, eq(courses.id, groups.courseId))
    .leftJoin(teachers, eq(teachers.id, groups.teacherId))
    .leftJoin(rooms, eq(rooms.id, groups.roomId))
    .where(and(eq(groupMemberships.studentId, studentId), isNull(groupMemberships.leftAt), isNull(groups.archivedAt)));

  const todayLessons = myGroups
    .filter((g) => Array.isArray(g.days) && g.days.includes(weekday))
    .map((g) => ({
      groupId: g.groupId,
      groupName: g.groupName,
      courseName: g.courseName ?? "—",
      teacherName: g.teacherName ?? "—",
      roomName: g.roomName ?? "—",
      startTime: g.startTime,
      endTime: g.endTime,
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    student: {
      id: s.id,
      name: s.name,
      phone: s.phone,
    },
    balance,
    coins,
    rank,
    attendance: {
      total: attTotal,
      present,
      absent,
      late,
      excused,
      percent: attPercent,
    },
    grades: {
      averagePercent,
      homeworkPercent,
      totalGrades: scoreCount,
    },
    todayLessons,
  };
}

/* ---------- Guruhlarim (3-bosqich) ---------- */

export interface PortalGroupItem {
  id: string;
  name: string;
  courseName: string;
  teacherName: string;
  roomName: string;
  startTime: string;
  endTime: string;
  days: string[];
  membershipStatus: string;
  joinedAt: string;
}

export async function portalStudentGroups(db: TenantDb, studentId: string): Promise<PortalGroupItem[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      courseName: courses.name,
      teacherName: teachers.name,
      roomName: rooms.name,
      startTime: groups.startTime,
      endTime: groups.endTime,
      days: groups.days,
      membershipStatus: groupMemberships.status,
      joinedAt: groupMemberships.enrolledAt,
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .leftJoin(courses, eq(courses.id, groups.courseId))
    .leftJoin(teachers, eq(teachers.id, groups.teacherId))
    .leftJoin(rooms, eq(rooms.id, groups.roomId))
    .where(and(eq(groupMemberships.studentId, studentId), isNull(groupMemberships.leftAt), isNull(groups.archivedAt)))
    .orderBy(desc(groups.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    courseName: r.courseName ?? "—",
    teacherName: r.teacherName ?? "—",
    roomName: r.roomName ?? "—",
    startTime: r.startTime,
    endTime: r.endTime,
    days: Array.isArray(r.days) ? (r.days as string[]) : [],
    membershipStatus: r.membershipStatus,
    joinedAt: r.joinedAt,
  }));
}

export interface PortalGroupDetail {
  group: {
    groupId: string;
    groupName: string;
    courseName: string;
    teacherName: string;
    roomName: string;
    startTime: string;
    endTime: string;
    days: string[];
    status: string;
    joinedAt: string;
  };
  attendance: {
    list: { date: string; status: string }[];
    percent: number | null;
    total: number;
    present: number;
  };
  grades: {
    list: { date: string; score: number | null; scale: number; homework: boolean | null }[];
    average: number | null;
    count: number;
  };
  members: {
    studentId: string;
    name: string;
    coins: number;
    isMe: boolean;
  }[];
  rank: {
    current: number;
    total: number;
  };
}

export async function portalStudentGroupDetail(
  db: TenantDb,
  studentId: string,
  groupId: string,
): Promise<PortalGroupDetail | null> {
  const [membership] = await db
    .select({
      groupId: groupMemberships.groupId,
      status: groupMemberships.status,
      joinedAt: groupMemberships.enrolledAt,
      groupName: groups.name,
      startTime: groups.startTime,
      endTime: groups.endTime,
      days: groups.days,
      courseName: courses.name,
      teacherName: teachers.name,
      roomName: rooms.name,
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .leftJoin(courses, eq(courses.id, groups.courseId))
    .leftJoin(teachers, eq(teachers.id, groups.teacherId))
    .leftJoin(rooms, eq(rooms.id, groups.roomId))
    .where(
      and(
        eq(groupMemberships.studentId, studentId),
        eq(groupMemberships.groupId, groupId),
        isNull(groupMemberships.leftAt),
      ),
    )
    .limit(1);

  if (!membership) return null;

  // Shu guruhdagi davomat
  const attList = await db
    .select({
      date: attendance.date,
      status: attendance.status,
    })
    .from(attendance)
    .where(and(eq(attendance.groupId, groupId), eq(attendance.studentId, studentId)))
    .orderBy(desc(attendance.date));

  // Shu guruhdagi baholar
  const gradeList = await db
    .select({
      date: lessonGrades.date,
      score: lessonGrades.score,
      scale: lessonGrades.scale,
      homework: lessonGrades.homework,
    })
    .from(lessonGrades)
    .where(and(eq(lessonGrades.groupId, groupId), eq(lessonGrades.studentId, studentId)))
    .orderBy(desc(lessonGrades.date));

  // Guruhdoshlar va guruh reytingi
  const members = await db
    .select({
      studentId: students.id,
      name: students.name,
    })
    .from(groupMemberships)
    .innerJoin(students, eq(students.id, groupMemberships.studentId))
    .where(and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.leftAt)))
    .orderBy(asc(students.name));

  const memberIds = members.map((m) => m.studentId);
  const memberCoins = memberIds.length
    ? await db
        .select({
          studentId: coinEntries.studentId,
          coins: sql<number>`coalesce(sum(${coinEntries.amount}), 0)::int`,
        })
        .from(coinEntries)
        .where(
          and(
            inArray(coinEntries.studentId, memberIds),
            eq(coinEntries.groupId, groupId),
            isNull(coinEntries.revokedAt),
          ),
        )
        .groupBy(coinEntries.studentId)
    : [];

  const coinMap = new Map(memberCoins.map((c) => [c.studentId, c.coins]));

  const memberList = members
    .map((m) => ({
      studentId: m.studentId,
      name: m.name,
      coins: coinMap.get(m.studentId) ?? 0,
      isMe: m.studentId === studentId,
    }))
    .sort((a, b) => b.coins - a.coins);

  const myRank = memberList.findIndex((m) => m.studentId === studentId) + 1;

  let presentCount = 0;
  for (const a of attList) {
    if (a.status === "present" || a.status === "late") presentCount++;
  }
  const attPercent = attList.length > 0 ? Math.round((presentCount / attList.length) * 100) : null;

  let totalScorePct = 0;
  let scoreCount = 0;
  for (const g of gradeList) {
    if (g.score !== null && g.scale > 0) {
      totalScorePct += (g.score / g.scale) * 100;
      scoreCount++;
    }
  }
  const avgScore = scoreCount > 0 ? Math.round(totalScorePct / scoreCount) : null;

  return {
    group: {
      groupId: membership.groupId,
      groupName: membership.groupName,
      courseName: membership.courseName ?? "—",
      teacherName: membership.teacherName ?? "—",
      roomName: membership.roomName ?? "—",
      startTime: membership.startTime,
      endTime: membership.endTime,
      days: Array.isArray(membership.days) ? (membership.days as string[]) : [],
      status: membership.status,
      joinedAt: membership.joinedAt,
    },
    attendance: {
      list: attList,
      percent: attPercent,
      total: attList.length,
      present: presentCount,
    },
    grades: {
      list: gradeList,
      average: avgScore,
      count: scoreCount,
    },
    members: memberList,
    rank: {
      current: myRank > 0 ? myRank : memberList.length + 1,
      total: memberList.length,
    },
  };
}

/* ---------- Uy ishlari (4-bosqich) ---------- */

export interface PortalHomeworkItem {
  id: string;
  groupId: string;
  groupName: string;
  courseName: string;
  teacherName: string;
  lessonDate: string;
  title: string;
  description: string | null;
  attachments: HomeworkAttachment[];
  dueDate: string | null;
  createdAt: string;
  /** Shu darsda tekshirilgan holat */
  status: "done" | "undone" | "pending";
  submission: {
    id: string;
    text: string | null;
    attachments: HomeworkAttachment[];
    status: "submitted" | "checked" | "rejected";
    grade: number | null;
    feedback: string | null;
    submittedAt: string;
    checkedAt: string | null;
  } | null;
}

export async function portalStudentHomeworks(db: TenantDb, studentId: string): Promise<PortalHomeworkItem[]> {
  // 1. O'quvchi a'zo bo'lgan guruhlar
  const myGroups = await db
    .select({
      groupId: groupMemberships.groupId,
      groupName: groups.name,
      courseName: courses.name,
      teacherName: teachers.name,
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .leftJoin(courses, eq(courses.id, groups.courseId))
    .leftJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(and(eq(groupMemberships.studentId, studentId), isNull(groupMemberships.leftAt), isNull(groups.archivedAt)));

  if (!myGroups.length) return [];
  const groupIds = myGroups.map((g) => g.groupId);
  const groupMap = new Map(myGroups.map((g) => [g.groupId, g]));

  // 2. Guruhlarning barcha vazifalari
  const homeworkRows = await db
    .select({
      id: groupHomeworks.id,
      groupId: groupHomeworks.groupId,
      lessonDate: groupHomeworks.lessonDate,
      title: groupHomeworks.title,
      description: groupHomeworks.description,
      attachments: groupHomeworks.attachments,
      dueDate: groupHomeworks.dueDate,
      createdAt: groupHomeworks.createdAt,
    })
    .from(groupHomeworks)
    .where(inArray(groupHomeworks.groupId, groupIds))
    .orderBy(desc(groupHomeworks.lessonDate), desc(groupHomeworks.createdAt));

  const hwIds = homeworkRows.map((h) => h.id);

  // 3. O'quvchining yuborgan topshiriqlari (submissions)
  const mySubmissions = hwIds.length
    ? await db
        .select()
        .from(homeworkSubmissions)
        .where(and(eq(homeworkSubmissions.studentId, studentId), inArray(homeworkSubmissions.homeworkId, hwIds)))
    : [];

  const submissionMap = new Map(mySubmissions.map((s) => [s.homeworkId, s]));

  // 4. O'quvchining shu darslardagi baholari
  const grades = await db
    .select({
      groupId: lessonGrades.groupId,
      date: lessonGrades.date,
      homework: lessonGrades.homework,
    })
    .from(lessonGrades)
    .where(and(eq(lessonGrades.studentId, studentId), inArray(lessonGrades.groupId, groupIds)));

  const gradeKey = (gId: string, d: string) => `${gId}:${d}`;
  const gradeMap = new Map(grades.map((g) => [gradeKey(g.groupId, g.date), g.homework]));

  return homeworkRows.map((h) => {
    const gInfo = groupMap.get(h.groupId);
    const sub = submissionMap.get(h.id);
    const hw = gradeMap.get(gradeKey(h.groupId, h.lessonDate));

    // Status aniqlash: agar o'qituvchi tekshirgan bo'lsa yoki grade bo'lsa - done
    let status: "done" | "undone" | "pending" = "pending";
    if (sub?.status === "checked" || hw === true) {
      status = "done";
    } else if (hw === false) {
      status = "undone";
    }

    return {
      id: h.id,
      groupId: h.groupId,
      groupName: gInfo?.groupName ?? "—",
      courseName: gInfo?.courseName ?? "—",
      teacherName: gInfo?.teacherName ?? "—",
      lessonDate: h.lessonDate,
      title: h.title,
      description: h.description,
      attachments: h.attachments ?? [],
      dueDate: h.dueDate,
      createdAt: h.createdAt.toISOString(),
      status,
      submission: sub
        ? {
            id: sub.id,
            text: sub.text,
            attachments: sub.attachments ?? [],
            status: sub.status as "submitted" | "checked" | "rejected",
            grade: sub.grade,
            feedback: sub.feedback,
            submittedAt: sub.createdAt.toISOString(),
            checkedAt: sub.checkedAt?.toISOString() ?? null,
          }
        : null,
    };
  });
}
