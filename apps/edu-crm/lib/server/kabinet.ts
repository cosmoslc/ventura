import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  type StudentStatus,
  attendance,
  groupMemberships,
  lessonGrades,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { hasFeature } from "@ventura/tenants";
import { groupMembers, listGroups } from "@/app/(crm)/groups/data";
import { type SalaryEntryRow, listPersonEntries } from "@/app/(crm)/salaries/data";
import { teacherOverview } from "@/app/(crm)/teachers/data";
import { type MasteryLevel, groupStats, masteryLevel } from "@/lib/kabinet-stats";
import { lessonMinutes } from "@/lib/teacher-reports";
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

/* ---------- O'quvchilar (3-bosqich) ---------- */

export interface KabinetStudent {
  id: string;
  name: string;
  phone: string;
  /** O'quvchi holati (o'quvchilar bazasidagi) */
  status: StudentStatus;
  /** O'qituvchining guruhlaridagi ochiq a'zoliklari */
  groups: { id: string; name: string; status: string }[];
  coins: number | null;
  /** Joriy oy: davomat va o'rtacha baho, % */
  attendance: number | null;
  average: number | null;
  /** Portalga kirish hisobi (ADR 0063) */
  userId: string | null;
  hasLogin: boolean;
}

/** O'qituvchining guruhlaridagi o'quvchilar (ochiq a'zolik) — boshqa guruhlari ko'rinmaydi */
export async function kabinetStudents(
  tenant: { features: string[] },
  db: TenantDb,
  teacherId: string,
  today: string,
): Promise<KabinetStudent[]> {
  const own = await kabinetGroups(db, teacherId);
  if (!own.length) return [];
  const groupIds = own.map((g) => g.id);
  const names = new Map(own.map((g) => [g.id, g.name]));
  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      phone: students.phone,
      status: students.status,
      userId: students.userId,
      groupId: groupMemberships.groupId,
      membership: groupMemberships.status,
    })
    .from(groupMemberships)
    .innerJoin(students, eq(students.id, groupMemberships.studentId))
    .where(and(inArray(groupMemberships.groupId, groupIds), isNull(groupMemberships.leftAt)))
    .orderBy(asc(students.name));
  const byId = new Map<string, KabinetStudent>();
  for (const r of rows) {
    const s = byId.get(r.id) ?? {
      id: r.id,
      name: r.name,
      phone: r.phone.replace(/\D/g, "").slice(-9),
      status: r.status,
      groups: [],
      coins: null,
      attendance: null,
      average: null,
      userId: r.userId ?? null,
      hasLogin: !!r.userId,
    };
    s.groups.push({ id: r.groupId, name: names.get(r.groupId) ?? "—", status: r.membership });
    byId.set(r.id, s);
  }
  const list = [...byId.values()];
  const ids = list.map((s) => s.id);
  const [from, to] = monthRange(today.slice(0, 7));
  const [coinsOn, gradesOn] = await Promise.all([hasFeature(tenant, "coins"), hasFeature(tenant, "grades")]);
  const [balances, marks, grades] = await Promise.all([
    coinsOn ? coinBalances(db, ids) : Promise.resolve(null),
    db
      .select({ studentId: attendance.studentId, status: attendance.status })
      .from(attendance)
      .where(
        and(
          inArray(attendance.groupId, groupIds),
          inArray(attendance.studentId, ids),
          gte(attendance.date, from),
          lte(attendance.date, to),
        ),
      ),
    gradesOn
      ? db
          .select({ studentId: lessonGrades.studentId, score: lessonGrades.score, scale: lessonGrades.scale })
          .from(lessonGrades)
          .where(
            and(
              inArray(lessonGrades.groupId, groupIds),
              inArray(lessonGrades.studentId, ids),
              gte(lessonGrades.date, from),
              lte(lessonGrades.date, to),
            ),
          )
      : Promise.resolve([]),
  ]);
  const att = new Map<string, { came: number; n: number }>();
  for (const m of marks) {
    const a = att.get(m.studentId) ?? { came: 0, n: 0 };
    a.n++;
    if (m.status === "present" || m.status === "late") a.came++;
    att.set(m.studentId, a);
  }
  const avg = new Map<string, { sum: number; n: number }>();
  for (const g of grades) {
    if (g.score === null) continue;
    const a = avg.get(g.studentId) ?? { sum: 0, n: 0 };
    a.sum += (g.score / g.scale) * 100;
    a.n++;
    avg.set(g.studentId, a);
  }
  return list.map((s) => {
    const a = att.get(s.id);
    const g = avg.get(s.id);
    return {
      ...s,
      coins: balances ? (balances[s.id] ?? 0) : null,
      attendance: a?.n ? Math.round((a.came / a.n) * 100) : null,
      average: g?.n ? Math.round(g.sum / g.n) : null,
    };
  });
}

/* ---------- Statistika (3-bosqich) ---------- */

export interface KabinetStats {
  /** Har guruh: o'tgan dars kunlari (bayramsiz, bugungacha), davomat olinganlari, soat */
  lessons: { groupId: string; name: string; planned: number; conducted: number; minutes: number }[];
  /** O'quvchilar baho darajalari bo'yicha (oy o'rtachasidan); bahosizlar alohida */
  levels: Record<MasteryLevel | "none", number>;
  retention: number | null;
  attendance: number | null;
  /** Oy yozuvlari (bekor qilinmaganlari): avans, jarima, bonus */
  money: { advance: number; penalty: number; bonus: number; entries: SalaryEntryRow[] } | null;
}

export async function kabinetStats(
  tenant: { features: string[] },
  db: TenantDb,
  teacherId: string,
  month: string,
  today: string,
): Promise<KabinetStats> {
  const own = (await listGroups(db, null)).filter((g) => g.teacherId === teacherId);
  const salariesOn = await hasFeature(tenant, "salaries");
  const [perGroup, overview, entries] = await Promise.all([
    Promise.all(own.map((g) => groupAttendance(db, g, month).then((a) => ({ g, a })))),
    teacherOverview(db, teacherId, month, today),
    salariesOn ? listPersonEntries(db, { teacherId }, month) : Promise.resolve(null),
  ]);
  const [from, to] = monthRange(month);
  const gradeRows = own.length
    ? await db
        .select({ studentId: lessonGrades.studentId, score: lessonGrades.score, scale: lessonGrades.scale })
        .from(lessonGrades)
        .where(
          and(
            inArray(
              lessonGrades.groupId,
              own.map((g) => g.id),
            ),
            gte(lessonGrades.date, from),
            lte(lessonGrades.date, to),
          ),
        )
    : [];

  const lessons = perGroup.map(({ g, a }) => {
    const past = a.dates.filter((d) => d <= today);
    const marked = new Set(Object.keys(a.marks).map((k) => k.split("|")[1]));
    const conducted = past.filter((d) => marked.has(d)).length;
    return {
      groupId: g.id,
      name: g.name,
      planned: past.length,
      conducted,
      minutes: conducted * lessonMinutes(g.startTime, g.endTime),
    };
  });

  // Daraja — oy davomida guruhlarida bo'lgan har o'quvchi uchun bir marta
  const studentIds = new Set(perGroup.flatMap(({ a }) => a.members.map((m) => m.studentId)));
  const avg = new Map<string, { sum: number; n: number }>();
  for (const r of gradeRows) {
    if (r.score === null) continue;
    const x = avg.get(r.studentId) ?? { sum: 0, n: 0 };
    x.sum += (r.score / r.scale) * 100;
    x.n++;
    avg.set(r.studentId, x);
  }
  const levels: KabinetStats["levels"] = { excellent: 0, good: 0, fair: 0, low: 0, none: 0 };
  for (const id of studentIds) {
    const x = avg.get(id);
    levels[x?.n ? masteryLevel(Math.round(x.sum / x.n)) : "none"]++;
  }

  const live = entries?.filter((e) => !e.voided) ?? null;
  const sum = (k: string) => (live ?? []).filter((e) => e.kind === k).reduce((s, e) => s + e.amount, 0);
  return {
    lessons,
    levels,
    retention: overview.retention,
    attendance: overview.attendance,
    money: live ? { advance: sum("advance"), penalty: sum("penalty"), bonus: sum("bonus"), entries: live } : null,
  };
}

/* ---------- Moliya (3-bosqich) ---------- */

/** O'qituvchining oy hisobi: Ish haqi bo'limi bilan bir manba (ADR 0018), faqat o'zining. `salaries` o'chiq — null */
export async function kabinetFinance(
  tenant: { features: string[] },
  db: TenantDb,
  teacherId: string,
  month: string,
  today: string,
) {
  if (!(await hasFeature(tenant, "salaries"))) return null;
  const [pay, entries] = await Promise.all([
    loadTeacherPayroll(db, teacherId, month, today),
    listPersonEntries(db, { teacherId }, month),
  ]);
  if (!pay) return null;
  // Guruh bo'yicha: tushum, shart (foiz/stavka/belgilangan) va hisoblangan ulush
  const groups = pay.row.accrual.groups.map((g) => {
    const share = pay.shares.find((s) => s.groupId === g.groupId);
    return {
      groupId: g.groupId,
      name: pay.groupNames[g.groupId] ?? "—",
      salaryType: g.salaryType,
      value: share?.value ?? null,
      revenue: g.revenue,
      pay: g.pay,
    };
  });
  return { row: pay.row, groupNames: pay.groupNames, shares: pay.shares, groups, entries };
}

export type KabinetFinance = NonNullable<Awaited<ReturnType<typeof kabinetFinance>>>;
