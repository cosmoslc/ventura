import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { courses, groupMemberships, groups, rooms, students, teachers } from "@ventura/db/schema/tenant";
import {
  type ImportTable,
  normName,
  parseDate,
  parseDays,
  parseMoney,
  parsePhone,
  parseSalary,
  parseTimeRange,
} from "@/lib/excel";
import { uz } from "@/lib/uz";
import { todayTashkent } from "./memberships";

/*
 * Import qatorlarini tekshirish va yozish (ADR 0013). Eski tizimdan farqlar:
 *  - xato yozilgan guruh, xona yoki kurs avtomatik yaratilmaydi — qator "topilmadi" xatosi bilan qoladi;
 *  - guruh nomidagi vergul nomni bo'lmaydi (avval butun katak qidiriladi);
 *  - o'qituvchi importi mavjud guruhlarning o'qituvchisini almashtirmaydi;
 *  - hamma to'g'ri qatorlar bitta tranzaksiyada yoziladi: yo hammasi, yo hech biri.
 */

export type ImportRow = Record<string, string>;
export interface RowResult {
  error: string | null;
}

/** Ism-familiya tartibidan qat'i nazar: "Karimov Aziz" = "Aziz Karimov" */
const nameKey = (s: string) => normName(s).split(" ").sort().join(" ");
const roomKey = (s: string) => normName(s).replace(/xona|room|[\s-]/g, "");
const get = (r: ImportRow, k: string) => (r[k] ?? "").trim();

interface Ctx {
  db: TenantDb;
  branchId: string;
}

type Prepared =
  | { table: "students"; values: typeof students.$inferInsert; groupIds: string[]; joinedAt: string }
  | { table: "groups"; values: typeof groups.$inferInsert }
  | { table: "teachers"; values: typeof teachers.$inferInsert };

/* ---------- O'quvchilar ---------- */

async function prepareStudents(ctx: Ctx, rows: ImportRow[]) {
  const [existing, groupList] = await Promise.all([
    ctx.db.select({ phone: students.phone }).from(students).where(isNull(students.archivedAt)),
    ctx.db
      .select({ id: groups.id, name: groups.name, branchId: groups.branchId })
      .from(groups)
      .where(isNull(groups.archivedAt)),
  ]);
  const taken = new Set(existing.map((s) => s.phone));
  const seen = new Set<string>();
  const byName = new Map<string, { id: string; branchId: string }[]>();
  for (const g of groupList) byName.set(normName(g.name), [...(byName.get(normName(g.name)) ?? []), g]);
  const today = todayTashkent();

  return rows.map((r): { error: string | null; prepared?: Prepared } => {
    const name = get(r, "name");
    if (!name) return { error: uz.excel.errName };
    const phone = parsePhone(get(r, "phone"));
    if (!phone) return { error: uz.excel.errPhone };
    const full = `+998${phone}`;
    if (taken.has(full)) return { error: uz.excel.errStudentExists };
    if (seen.has(full)) return { error: uz.excel.errDuplicate };
    const parentRaw = get(r, "parentPhone");
    const parentPhone = parentRaw ? parsePhone(parentRaw) : null;
    if (parentRaw && !parentPhone) return { error: uz.excel.errParentPhone };
    const birthRaw = get(r, "birthDate");
    const birthDate = birthRaw ? parseDate(birthRaw) : null;
    if (birthRaw && !birthDate) return { error: uz.excel.errDate(birthRaw) };
    const joinedRaw = get(r, "joinedAt");
    const joinedAt = joinedRaw ? parseDate(joinedRaw) : today;
    if (!joinedAt) return { error: uz.excel.errDate(joinedRaw) };

    // Guruh: avval butun katak (nomida vergul bo'lishi mumkin), keyin ajratilgan qismlar — faqat aniq moslik
    const groupRaw = get(r, "group");
    const groupIds: string[] = [];
    if (groupRaw) {
      const whole = byName.get(normName(groupRaw));
      const parts = whole
        ? [groupRaw]
        : groupRaw
            .split(/[,;\n|]+/)
            .map((p) => p.trim())
            .filter(Boolean);
      for (const part of parts) {
        const hits = (byName.get(normName(part)) ?? []).filter((g) => g.branchId === ctx.branchId);
        if (!hits.length) return { error: uz.excel.errGroupMissing(part) };
        if (hits.length > 1) return { error: uz.excel.errGroupAmbiguous(part) };
        if (!groupIds.includes(hits[0]!.id)) groupIds.push(hits[0]!.id);
      }
    }
    seen.add(full);
    return {
      error: null,
      prepared: {
        table: "students",
        joinedAt,
        groupIds,
        values: {
          branchId: ctx.branchId,
          name,
          phone: full,
          parentName: get(r, "parentName") || null,
          parentPhone: parentPhone ? `+998${parentPhone}` : null,
          birthDate,
          address: get(r, "address") || null,
          grade: get(r, "grade") || null,
          source: get(r, "source") || null,
          note: get(r, "note") || null,
          // Eski tizimdagidek import qilingan o'quvchi faol (guruhdagi a'zoligi ham faol)
          status: "active",
          joinedAt,
        },
      },
    };
  });
}

/* ---------- Guruhlar ---------- */

async function prepareGroups(ctx: Ctx, rows: ImportRow[]) {
  const [courseList, teacherList, roomList, groupList] = await Promise.all([
    ctx.db
      .select({
        id: courses.id,
        name: courses.name,
        branchId: courses.branchId,
        price: courses.price,
        color: courses.color,
      })
      .from(courses)
      .where(isNull(courses.archivedAt)),
    ctx.db
      .select({ id: teachers.id, name: teachers.name })
      .from(teachers)
      .where(and(isNull(teachers.archivedAt), eq(teachers.kind, "teacher"), eq(teachers.branchId, ctx.branchId))),
    ctx.db.select({ id: rooms.id, name: rooms.name, branchId: rooms.branchId }).from(rooms),
    ctx.db
      .select({
        name: groups.name,
        branchId: groups.branchId,
        teacherId: groups.teacherId,
        roomId: groups.roomId,
        days: groups.days,
        startTime: groups.startTime,
        endTime: groups.endTime,
      })
      .from(groups)
      .where(isNull(groups.archivedAt)),
  ]);
  const names = new Set(groupList.filter((g) => g.branchId === ctx.branchId).map((g) => normName(g.name)));
  const busy = groupList.map((g) => ({ ...g }));
  const today = todayTashkent();

  return rows.map((r): { error: string | null; prepared?: Prepared } => {
    const name = get(r, "name");
    if (!name) return { error: uz.excel.errGroupName };
    if (names.has(normName(name))) return { error: uz.excel.errGroupExists };
    const courseHits = courseList.filter(
      (c) => normName(c.name) === normName(get(r, "course")) && (!c.branchId || c.branchId === ctx.branchId),
    );
    if (courseHits.length !== 1) return { error: uz.excel.errCourseMissing(get(r, "course")) };
    const course = courseHits[0]!;
    const teacherHits = teacherList.filter((t) => nameKey(t.name) === nameKey(get(r, "teacher")));
    if (teacherHits.length !== 1) return { error: uz.excel.errTeacherMissing(get(r, "teacher")) };
    const teacher = teacherHits[0]!;
    const days = parseDays(get(r, "days"));
    if (!days) return { error: uz.excel.errDays };
    const time = parseTimeRange(get(r, "time"));
    if (!time) return { error: uz.excel.errTime };
    let roomId: string | null = null;
    if (get(r, "room")) {
      const hits = roomList.filter(
        (x) => roomKey(x.name) === roomKey(get(r, "room")) && (!x.branchId || x.branchId === ctx.branchId),
      );
      if (hits.length !== 1) return { error: uz.excel.errRoomMissing(get(r, "room")) };
      roomId = hits[0]!.id;
    }
    const startRaw = get(r, "startDate");
    const startDate = startRaw ? parseDate(startRaw) : today;
    if (!startDate) return { error: uz.excel.errDate(startRaw) };
    const priceRaw = get(r, "price");
    const price = priceRaw ? parseMoney(priceRaw) : course.price;
    if (price === null) return { error: uz.excel.errPrice };

    // Xona va o'qituvchi bandligi — bazadagi va fayldagi oldingi qatorlar bilan
    const overlaps = (g: (typeof busy)[number]) =>
      g.days.some((d) => days.includes(d)) && g.startTime < time.end && g.endTime > time.start;
    const roomBusy = roomId ? busy.find((g) => g.roomId === roomId && overlaps(g)) : undefined;
    if (roomBusy) return { error: uz.groups.roomBusy(roomBusy.name) };
    const teacherBusy = busy.find((g) => g.teacherId === teacher.id && overlaps(g));
    if (teacherBusy) return { error: uz.groups.teacherBusy(teacherBusy.name) };

    names.add(normName(name));
    busy.push({
      name,
      branchId: ctx.branchId,
      teacherId: teacher.id,
      roomId,
      days,
      startTime: time.start,
      endTime: time.end,
    });
    return {
      error: null,
      prepared: {
        table: "groups",
        values: {
          branchId: ctx.branchId,
          courseId: course.id,
          teacherId: teacher.id,
          roomId,
          name,
          price,
          days,
          startTime: time.start,
          endTime: time.end,
          startDate,
          color: course.color,
        },
      },
    };
  });
}

/* ---------- O'qituvchilar ---------- */

async function prepareTeachers(ctx: Ctx, rows: ImportRow[]) {
  const existing = await ctx.db.select({ phone: teachers.phone }).from(teachers).where(isNull(teachers.archivedAt));
  const taken = new Set(existing.map((t) => t.phone));
  const seen = new Set<string>();
  return rows.map((r): { error: string | null; prepared?: Prepared } => {
    const name = get(r, "name");
    if (!name) return { error: uz.excel.errName };
    const phone = parsePhone(get(r, "phone"));
    if (!phone) return { error: uz.excel.errPhone };
    const full = `+998${phone}`;
    if (taken.has(full)) return { error: uz.excel.errTeacherExists };
    if (seen.has(full)) return { error: uz.excel.errDuplicate };
    const birthRaw = get(r, "birthDate");
    const birthDate = birthRaw ? parseDate(birthRaw) : null;
    if (birthRaw && !birthDate) return { error: uz.excel.errDate(birthRaw) };
    let salary: { type: "percent" | "per_student" | "fixed"; value: number } | null = null;
    if (get(r, "salary")) {
      salary = parseSalary(get(r, "salary"));
      if (!salary) return { error: uz.excel.errSalary };
    } else if (get(r, "percent")) {
      const p = parseMoney(get(r, "percent").replace("%", ""));
      if (p === null || p > 100) return { error: uz.excel.errSalary };
      salary = { type: "percent", value: p };
    }
    // Maosh ko'rsatilmasa — formadagi standart: 40% ulush
    const s = salary ?? { type: "percent" as const, value: 40 };
    seen.add(full);
    return {
      error: null,
      prepared: {
        table: "teachers",
        values: {
          branchId: ctx.branchId,
          kind: "teacher",
          name,
          phone: full,
          birthDate,
          salaryType: s.type,
          revenueSharePercent: s.type === "percent" ? s.value : 0,
          perStudentSalary: s.type === "per_student" ? s.value : 0,
          fixedSalary: s.type === "fixed" ? s.value : 0,
          note: get(r, "note") || null,
        },
      },
    };
  });
}

export async function prepareImport(table: ImportTable, ctx: Ctx, rows: ImportRow[]) {
  if (table === "students") return prepareStudents(ctx, rows);
  if (table === "groups") return prepareGroups(ctx, rows);
  return prepareTeachers(ctx, rows);
}

/** To'g'ri qatorlarni bitta tranzaksiyada yozadi; yaratilgan yozuvlar (jurnal uchun) */
export async function writeImport(db: TenantDb, prepared: Prepared[], by: string) {
  return db.transaction(async (tx) => {
    const created: { type: string; id: string; name: string }[] = [];
    for (const p of prepared) {
      if (p.table === "students") {
        const [s] = await tx
          .insert(students)
          .values({ ...p.values, createdBy: by })
          .returning({ id: students.id });
        for (const groupId of p.groupIds) {
          await tx.insert(groupMemberships).values({
            groupId,
            studentId: s!.id,
            status: "active",
            enrolledAt: p.joinedAt,
            activatedAt: p.joinedAt,
            createdBy: by,
          });
        }
        created.push({ type: "student", id: s!.id, name: p.values.name });
      } else if (p.table === "groups") {
        const [g] = await tx.insert(groups).values(p.values).returning({ id: groups.id });
        created.push({ type: "group", id: g!.id, name: p.values.name });
      } else {
        const [t] = await tx.insert(teachers).values(p.values).returning({ id: teachers.id });
        created.push({ type: "teacher", id: t!.id, name: p.values.name });
      }
    }
    return created;
  });
}
