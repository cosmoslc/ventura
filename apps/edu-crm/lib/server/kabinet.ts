import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { attendance, groupMemberships, teachers } from "@ventura/db/schema/tenant";
import { hasFeature } from "@ventura/tenants";
import { groupMembers, listGroups } from "@/app/(crm)/groups/data";
import { groupStats } from "@/lib/kabinet-stats";
import { monthRange, weekdayOf } from "@/lib/lessons";
import { groupAttendance } from "./attendance";
import { coinBalances, coinLeaders, getCoinSettings } from "./coins";
import { getGradingSettings, groupGradeMarks } from "./grades";
import { loadTeacherPayroll } from "./payroll";
import { reportPeriod } from "./reports";
import { type TeachersViewData, teachersReport } from "./teacher-reports";

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

/* ---------- Bosh sahifa (2-bosqich) ---------- */

export interface KabinetDashboard {
  /** Ish haqi balansi (Ish haqi bo'limi bilan bir manba); `payroll` o'chiq — null */
  balance: { remaining: number; accrued: number; paid: number; advance: number; penalty: number } | null;
  /** O'qituvchilar reytingidagi o'rni (ADR 0033 tartibi), joriy oy */
  rank: { place: number; total: number } | null;
  /** Markaz bo'yicha top-3 o'qituvchi — faqat ism (raqamlar ko'rinmaydi) */
  topTeachers: { id: string; name: string; me: boolean }[];
  /** O'z guruhlaridan top-3 o'quvchi coin bo'yicha; `coins` o'chiq — null */
  topStudents: { id: string; name: string; coins: number }[] | null;
  groups: (KabinetGroup & { today: boolean; attendanceTaken: boolean })[];
}

export async function kabinetDashboard(
  tenant: { features: string[] },
  db: TenantDb,
  teacherId: string,
  today: string,
): Promise<KabinetDashboard> {
  const month = today.slice(0, 7);
  const weekday = weekdayOf(today);
  const [groupsList, payroll, report, coinsOn, salariesOn] = await Promise.all([
    kabinetGroups(db, teacherId),
    loadTeacherPayroll(db, teacherId, month, today),
    teachersReport({ db, filter: null, period: reportPeriod({}, today, "month"), today, finance: false }),
    hasFeature(tenant, "coins"),
    hasFeature(tenant, "salaries"),
  ]);
  const teachersView = (report.view as TeachersViewData).teachers;
  const place = teachersView.findIndex((t) => t.id === teacherId);

  const todayIds = groupsList.filter((g) => g.days.includes(weekday)).map((g) => g.id);
  const taken = todayIds.length
    ? await db
        .selectDistinct({ groupId: attendance.groupId })
        .from(attendance)
        .where(and(inArray(attendance.groupId, todayIds), eq(attendance.date, today)))
    : [];
  const takenSet = new Set(taken.map((r) => r.groupId));

  let topStudents: KabinetDashboard["topStudents"] = null;
  if (coinsOn) {
    const ids = new Set(
      await teacherStudentIds(
        db,
        groupsList.map((g) => g.id),
      ),
    );
    topStudents = (await coinLeaders(db, { branchIds: null, month }))
      .filter((l) => ids.has(l.studentId))
      .slice(0, 3)
      .map((l) => ({ id: l.studentId, name: l.name, coins: l.balance }));
  }

  const b = payroll?.row.balance;
  return {
    balance:
      salariesOn && b
        ? { remaining: b.remaining, accrued: b.accrued + b.bonus, paid: b.paid, advance: b.advance, penalty: b.penalty }
        : null,
    rank: place >= 0 ? { place: place + 1, total: teachersView.length } : null,
    topTeachers: teachersView.slice(0, 3).map((t) => ({ id: t.id, name: t.name, me: t.id === teacherId })),
    topStudents,
    groups: groupsList
      .map((g) => ({ ...g, today: todayIds.includes(g.id), attendanceTaken: takenSet.has(g.id) }))
      .sort((a, b) => Number(b.today) - Number(a.today) || a.startTime.localeCompare(b.startTime)),
  };
}

/** Guruhlardagi ochiq a'zolar (sinov va faol) */
async function teacherStudentIds(db: TenantDb, groupIds: readonly string[]): Promise<string[]> {
  if (!groupIds.length) return [];
  const rows = await db
    .selectDistinct({ studentId: groupMemberships.studentId })
    .from(groupMemberships)
    .where(and(inArray(groupMemberships.groupId, [...groupIds]), isNull(groupMemberships.leftAt)));
  return rows.map((r) => r.studentId);
}

/* ---------- Guruh sahifasi (2-bosqich) ---------- */

export async function kabinetGroup(
  tenant: { features: string[] },
  db: TenantDb,
  teacherId: string,
  groupId: string,
  month: string,
) {
  const [g] = await listGroups(db, null, groupId);
  // Faqat o'z guruhi (ADR 0062): boshqa o'qituvchiniki — topilmadi
  if (!g || g.teacherId !== teacherId) return null;
  const [attendanceOn, gradesOn, coinsOn] = await Promise.all([
    hasFeature(tenant, "attendance"),
    hasFeature(tenant, "grades"),
    hasFeature(tenant, "coins"),
  ]);
  // Birinchi darsga kelgan lidlar kabinetda ko'rsatilmaydi (lidlar o'qituvchiga yopiq)
  const lessons = { ...(await groupAttendance(db, g, month)), guests: [] };
  const [from, to] = monthRange(month);
  const studentIds = lessons.members.map((m) => m.studentId);
  const [gradeMarks, scale, members] = await Promise.all([
    gradesOn ? groupGradeMarks(db, g.id, from, to, studentIds) : Promise.resolve(null),
    gradesOn ? getGradingSettings(db).then((s) => s.scale) : Promise.resolve(5),
    groupMembers(db, g.id),
  ]);
  const open = members.open.map((m) => ({
    studentId: m.studentId,
    name: m.name,
    phone: m.phone,
    status: m.status,
  }));
  const [balances, coinSettings] = await Promise.all([
    coinsOn
      ? coinBalances(
          db,
          open.map((m) => m.studentId),
        )
      : Promise.resolve(null),
    coinsOn ? getCoinSettings(db) : Promise.resolve(null),
  ]);
  return {
    group: {
      id: g.id,
      name: g.name,
      courseName: g.courseName,
      color: g.color,
      days: g.days,
      startTime: g.startTime,
      endTime: g.endTime,
      roomName: g.roomName,
    },
    attendance: attendanceOn ? lessons : null,
    grades: gradeMarks ? { lessons, marks: gradeMarks, scale } : null,
    members: open,
    coins: balances,
    manualCoins: coinSettings?.manual.enabled ? { dailyLimit: coinSettings.manual.dailyLimit } : null,
    stats: groupStats({
      members: lessons.members.map((m) => ({ studentId: m.studentId, name: m.name })),
      attendance: lessons.marks,
      grades: gradeMarks ?? {},
    }),
  };
}

export type KabinetGroupData = NonNullable<Awaited<ReturnType<typeof kabinetGroup>>>;
