import "server-only";
import { and, asc, count, countDistinct, eq, inArray, isNull, ne } from "drizzle-orm";
import { inScope } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import {
  additionalIncomes,
  branches,
  courses,
  expenses,
  groupMemberships,
  groups,
  positions,
  rooms,
  students,
  teachers,
  userBranches,
  userPositions,
  users,
} from "@ventura/db/schema/tenant";
import type { Staff } from "@/lib/server/session";

export interface BranchStaff {
  id: string;
  name: string;
  phone: string | null;
  /** Lavozimlari nomi */
  positions: string[];
  /** Biriktirilgan filiallari (formada belgilash uchun) */
  branchIds: string[];
}

/** Xodim → lavozim nomlari */
async function positionNames(db: TenantDb): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ userId: userPositions.userId, name: positions.name })
    .from(userPositions)
    .innerJoin(positions, eq(positions.id, userPositions.positionId))
    .orderBy(asc(positions.name));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), r.name]);
  return map;
}

export interface BranchRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  color: string;
  managers: BranchStaff[];
  /** Filialga biriktirilgan xodimlar (direktordan tashqari) */
  staffCount: number;
  /** Faol o'quvchilar (ochiq guruhi bor, bosh paneldagi bilan bir xil qoida) va faol guruhlar */
  activeStudents: number;
  groups: number;
}

/** Xodim ko'ra oladigan filiallar va ularning menejerlari. Sahifa tepadagi tanlovga bog'liq emas (eski tizimdagidek). */
export async function listBranches(db: TenantDb, staff: Staff): Promise<BranchRow[]> {
  const rows = (await db.select().from(branches).orderBy(asc(branches.createdAt))).filter((b) =>
    inScope(staff.scope, b.id),
  );
  if (!rows.length) return [];
  const [links, names] = await Promise.all([
    db
      .select({
        branchId: userBranches.branchId,
        id: users.id,
        name: users.name,
        phone: users.phoneNumber,
        role: users.role,
      })
      .from(userBranches)
      .innerJoin(users, eq(userBranches.userId, users.id))
      .where(
        and(
          inArray(
            userBranches.branchId,
            rows.map((r) => r.id),
          ),
          isNull(users.archivedAt),
        ),
      )
      .orderBy(asc(users.name)),
    positionNames(db),
  ]);
  const ids = rows.map((r) => r.id);
  const [studentCounts, groupCounts] = await Promise.all([
    // Bosh paneldagi "faol o'quvchi" bilan bir xil: arxivlanmagan, holati faol/qaytgan va ochiq guruhi bor
    db
      .select({ branchId: students.branchId, n: countDistinct(students.id) })
      .from(students)
      .innerJoin(groupMemberships, and(eq(groupMemberships.studentId, students.id), isNull(groupMemberships.leftAt)))
      .innerJoin(groups, and(eq(groups.id, groupMemberships.groupId), isNull(groups.archivedAt)))
      .where(
        and(
          inArray(students.branchId, ids),
          isNull(students.archivedAt),
          inArray(students.status, ["active", "returned"]),
        ),
      )
      .groupBy(students.branchId),
    db
      .select({ branchId: groups.branchId, n: count() })
      .from(groups)
      .where(and(inArray(groups.branchId, ids), isNull(groups.archivedAt)))
      .groupBy(groups.branchId),
  ]);
  const studentsOf = new Map(studentCounts.map((r) => [r.branchId, r.n]));
  const groupsOf = new Map(groupCounts.map((r) => [r.branchId, r.n]));
  return rows.map((b) => {
    const staffRows = links.filter((l) => l.branchId === b.id && l.role !== "director");
    return {
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      color: b.color,
      managers: staffRows.map(({ id, name, phone }) => ({
        id,
        name,
        phone,
        positions: names.get(id) ?? [],
        branchIds: [b.id],
      })),
      staffCount: staffRows.length,
      activeStudents: studentsOf.get(b.id) ?? 0,
      groups: groupsOf.get(b.id) ?? 0,
    };
  });
}

/** Filialga biriktirish mumkin bo'lgan xodimlar (direktor hammasini ko'radi — biriktirilmaydi) */
export async function assignableStaff(db: TenantDb): Promise<BranchStaff[]> {
  const [rows, links, names] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, phone: users.phoneNumber })
      .from(users)
      .where(and(ne(users.role, "director"), eq(users.kind, "staff"), isNull(users.archivedAt)))
      .orderBy(asc(users.name)),
    db.select().from(userBranches),
    positionNames(db),
  ]);
  return rows.map((u) => ({
    ...u,
    positions: names.get(u.id) ?? [],
    branchIds: links.filter((l) => l.userId === u.id).map((l) => l.branchId),
  }));
}

/** O'chirishdan oldin: filialga bog'langan yozuvlar soni */
export async function branchUsage(db: TenantDb, branchId: string) {
  const [[c], [r], [t], [gr], [st], [ex], [inc]] = await Promise.all([
    db.select({ n: count() }).from(courses).where(eq(courses.branchId, branchId)),
    db.select({ n: count() }).from(rooms).where(eq(rooms.branchId, branchId)),
    // Bo'shatilganlari ham: ularning tarixi filialga bog'liq
    db.select({ n: count() }).from(teachers).where(eq(teachers.branchId, branchId)),
    db.select({ n: count() }).from(groups).where(eq(groups.branchId, branchId)),
    db.select({ n: count() }).from(students).where(eq(students.branchId, branchId)),
    // Pul yozuvlari (bekor qilinganlari ham) filialsiz qolmaydi — ADR 0016
    db.select({ n: count() }).from(expenses).where(eq(expenses.branchId, branchId)),
    db.select({ n: count() }).from(additionalIncomes).where(eq(additionalIncomes.branchId, branchId)),
  ]);
  return {
    courses: c?.n ?? 0,
    rooms: r?.n ?? 0,
    teachers: t?.n ?? 0,
    groups: gr?.n ?? 0,
    students: st?.n ?? 0,
    finance: (ex?.n ?? 0) + (inc?.n ?? 0),
  };
}
