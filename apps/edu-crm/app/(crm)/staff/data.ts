import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import type { BranchScope, StaffAccess } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import {
  type SalaryType,
  auditEvents,
  positions,
  settings,
  userBranches,
  userPositions,
  users,
} from "@ventura/db/schema/tenant";
import { DEFAULT_STAFF_FIELDS, STAFF_FIELDS_KEY, type FormField, parseFormFields } from "@/lib/form-fields";

export interface StaffPosition {
  id: string;
  name: string;
  color: string;
}

export interface StaffRow {
  id: string;
  name: string;
  /** 9 ta mahalliy raqam */
  phone: string;
  gender: "male" | "female" | null;
  birthDate: string | null;
  address: string | null;
  note: string | null;
  salaryType: SalaryType;
  monthlySalary: number;
  kpiStudentAmount: number;
  kpiContractBonus: number;
  customData: Record<string, string>;
  positions: StaffPosition[];
  branchIds: string[];
  /** Lavozimlaridan yig'ilgan ruxsatlar soni */
  permissionCount: number;
  locked: boolean;
  telegramLinked: boolean;
  mustChangePassword: boolean;
  /** Joriy xodimning o'zi */
  self: boolean;
  /** Joriy xodim bu odamni boshqara oladimi (o'zidan kuchliroq ruxsatli xodimni emas) */
  manageable: boolean;
}

export interface PositionOption extends StaffPosition {
  permissions: string[];
  /** Joriy xodim bu lavozimni bera oladimi (lavozim ruxsatlari o'zida bor) */
  assignable: boolean;
}

export async function getStaffFields(db: TenantDb): Promise<FormField[]> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, STAFF_FIELDS_KEY));
  return parseFormFields(row?.value, DEFAULT_STAFF_FIELDS);
}

export async function positionOptions(db: TenantDb, access: StaffAccess): Promise<PositionOption[]> {
  const rows = await db
    .select({ id: positions.id, name: positions.name, color: positions.color, permissions: positions.permissions })
    .from(positions)
    .orderBy(asc(positions.createdAt), asc(positions.name));
  return rows.map((p) => ({ ...p, assignable: withinAccess(access, p.permissions) }));
}

export function withinAccess(access: StaffAccess, permissions: readonly string[]) {
  return access.director || permissions.every((p) => access.permissions.has(p));
}

/** Filial cheklovi: "all" — hammasi; aks holda xodimning kamida bitta filiali ro'yxatda bo'lsin */
export function staffVisible(scope: BranchScope | readonly string[] | null, branchIds: readonly string[]) {
  if (scope === null || scope === "all") return true;
  return branchIds.some((id) => scope.includes(id));
}

const localPhone = (phone: string | null) => (phone ?? "").replace(/\D/g, "").slice(-9);

/**
 * Faol xodimlar (direktorlar va bo'shatilganlarsiz). `filter` — tepadagi filial tanlovi/xodim cheklovi
 * (getBranchContext().filter), `id` berilsa — faqat shu xodim.
 */
export async function listStaff(
  db: TenantDb,
  viewer: { id: string; access: StaffAccess },
  filter: readonly string[] | null,
  id?: string,
): Promise<StaffRow[]> {
  const base = and(
    ne(users.role, "director"),
    eq(users.kind, "staff"),
    isNull(users.archivedAt),
    id ? eq(users.id, id) : undefined,
  );
  const rows = await db.select().from(users).where(base).orderBy(asc(users.createdAt), asc(users.name));
  if (!rows.length) return [];
  const ids = rows.map((u) => u.id);
  const [pos, br] = await Promise.all([
    db
      .select({
        userId: userPositions.userId,
        id: positions.id,
        name: positions.name,
        color: positions.color,
        permissions: positions.permissions,
      })
      .from(userPositions)
      .innerJoin(positions, eq(positions.id, userPositions.positionId))
      .where(inArray(userPositions.userId, ids))
      .orderBy(asc(positions.createdAt)),
    db
      .select({ userId: userBranches.userId, branchId: userBranches.branchId })
      .from(userBranches)
      .where(inArray(userBranches.userId, ids)),
  ]);

  return rows
    .map((u): StaffRow => {
      const mine = pos.filter((p) => p.userId === u.id);
      const permissions = new Set(mine.flatMap((p) => p.permissions));
      return {
        id: u.id,
        name: u.name,
        phone: localPhone(u.phoneNumber),
        gender: u.gender,
        birthDate: u.birthDate,
        address: u.address,
        note: u.note,
        salaryType: u.salaryType,
        monthlySalary: u.monthlySalary,
        kpiStudentAmount: u.kpiStudentAmount,
        kpiContractBonus: u.kpiContractBonus,
        customData: u.customData,
        positions: mine.map((p) => ({ id: p.id, name: p.name, color: p.color })),
        branchIds: br.filter((b) => b.userId === u.id).map((b) => b.branchId),
        permissionCount: permissions.size,
        locked: !!u.lockedAt,
        telegramLinked: !!u.telegramChatId && u.twoFactorEnabled,
        mustChangePassword: u.mustChangePassword,
        self: u.id === viewer.id,
        manageable: withinAccess(viewer.access, [...permissions]),
      };
    })
    .filter((r) => staffVisible(filter, r.branchIds));
}

export interface ArchivedStaffRow {
  id: string;
  name: string;
  /** 9 ta mahalliy raqam */
  phone: string;
  positions: string[];
  branchIds: string[];
  archivedAt: string;
  /** Bo'shatgan xodim (jurnaldagi oxirgi `staff.archive` yozuvidan) */
  archivedByName: string | null;
  /** Joriy xodim tiklay oladimi (o'zidan kuchliroq ruxsatli xodimni emas) */
  manageable: boolean;
}

/** Bo'shatilgan xodimlar (arxiv tabi); direktorlar yo'q. `filter` — filial tanlovi, listStaff bilan bir xil qoida */
export async function archivedStaff(
  db: TenantDb,
  viewer: { access: StaffAccess },
  filter: readonly string[] | null,
): Promise<ArchivedStaffRow[]> {
  const rows = await db
    .select()
    .from(users)
    .where(and(ne(users.role, "director"), eq(users.kind, "staff"), isNotNull(users.archivedAt)))
    .orderBy(desc(users.archivedAt));
  if (!rows.length) return [];
  const ids = rows.map((u) => u.id);
  const [pos, br, who] = await Promise.all([
    db
      .select({
        userId: userPositions.userId,
        name: positions.name,
        permissions: positions.permissions,
      })
      .from(userPositions)
      .innerJoin(positions, eq(positions.id, userPositions.positionId))
      .where(inArray(userPositions.userId, ids))
      .orderBy(asc(positions.createdAt)),
    db
      .select({ userId: userBranches.userId, branchId: userBranches.branchId })
      .from(userBranches)
      .where(inArray(userBranches.userId, ids)),
    db
      .select({ targetId: auditEvents.targetId, actorName: auditEvents.actorName })
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "staff.archive"), inArray(auditEvents.targetId, ids)))
      .orderBy(asc(auditEvents.seq)),
  ]);
  return rows
    .map((u): ArchivedStaffRow => {
      const mine = pos.filter((p) => p.userId === u.id);
      return {
        id: u.id,
        name: u.name,
        phone: localPhone(u.phoneNumber),
        positions: mine.map((p) => p.name),
        branchIds: br.filter((b) => b.userId === u.id).map((b) => b.branchId),
        archivedAt: u.archivedAt!.toISOString(),
        // Eng oxirgi bo'shatish yozuvi (qayta tiklanib yana bo'shatilgan bo'lishi mumkin)
        archivedByName: who.filter((w) => w.targetId === u.id).at(-1)?.actorName ?? null,
        manageable: withinAccess(
          viewer.access,
          mine.flatMap((p) => p.permissions),
        ),
      };
    })
    .filter((r) => staffVisible(filter, r.branchIds));
}
