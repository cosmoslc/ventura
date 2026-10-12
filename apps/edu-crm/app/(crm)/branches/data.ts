import "server-only";
import { asc, count, eq, inArray, ne } from "drizzle-orm";
import { inScope } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import { type StaffRole, branches, courses, rooms, userBranches, users } from "@ventura/db/schema/tenant";
import type { Staff } from "@/lib/server/session";

export interface BranchStaff {
  id: string;
  name: string;
  phone: string | null;
  role: StaffRole;
  /** Biriktirilgan filiallari (formada belgilash uchun) */
  branchIds: string[];
}

export interface BranchRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  color: string;
  managers: BranchStaff[];
  /** Filialga biriktirilgan xodimlar (direktordan tashqari); o'qituvchilar E1b dan qo'shiladi */
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
  const links = await db
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
      inArray(
        userBranches.branchId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(users.name));
  return rows.map((b) => {
    const staffRows = links.filter((l) => l.branchId === b.id && l.role !== "director");
    return {
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      color: b.color,
      managers: staffRows
        .filter((l) => l.role === "manager")
        .map(({ id, name, phone, role }) => ({ id, name, phone, role, branchIds: [b.id] })),
      staffCount: staffRows.length,
      activeStudents: 0,
      groups: 0,
    };
  });
}

/** Filialga biriktirish mumkin bo'lgan xodimlar (direktor hammasini ko'radi — biriktirilmaydi) */
export async function assignableStaff(db: TenantDb): Promise<BranchStaff[]> {
  const [rows, links] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, phone: users.phoneNumber, role: users.role })
      .from(users)
      .where(ne(users.role, "director"))
      .orderBy(asc(users.name)),
    db.select().from(userBranches),
  ]);
  return rows.map((u) => ({ ...u, branchIds: links.filter((l) => l.userId === u.id).map((l) => l.branchId) }));
}

/** O'chirishdan oldin: filialga bog'langan yozuvlar soni */
export async function branchUsage(db: TenantDb, branchId: string) {
  const [[c], [r]] = await Promise.all([
    db.select({ n: count() }).from(courses).where(eq(courses.branchId, branchId)),
    db.select({ n: count() }).from(rooms).where(eq(rooms.branchId, branchId)),
  ]);
  return { courses: c?.n ?? 0, rooms: r?.n ?? 0 };
}
