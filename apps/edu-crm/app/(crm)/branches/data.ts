import "server-only";
import { and, asc, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { inScope } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import { branches, courses, positions, rooms, userBranches, userPositions, users } from "@ventura/db/schema/tenant";
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
  /** Faol o'quvchilar va guruhlar — o'quvchi va guruh jadvallari bilan (E1c, E1d); hozircha yo'q */
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
      activeStudents: 0,
      groups: 0,
    };
  });
}

/** Filialga biriktirish mumkin bo'lgan xodimlar (direktor hammasini ko'radi — biriktirilmaydi) */
export async function assignableStaff(db: TenantDb): Promise<BranchStaff[]> {
  const [rows, links, names] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, phone: users.phoneNumber })
      .from(users)
      .where(and(ne(users.role, "director"), isNull(users.archivedAt)))
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
  const [[c], [r]] = await Promise.all([
    db.select({ n: count() }).from(courses).where(eq(courses.branchId, branchId)),
    db.select({ n: count() }).from(rooms).where(eq(rooms.branchId, branchId)),
  ]);
  return { courses: c?.n ?? 0, rooms: r?.n ?? 0 };
}
