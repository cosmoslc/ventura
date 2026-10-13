import type { StaffRole } from "@ventura/db/schema/tenant";
import { ALL_PERMISSIONS, type Permission, POSITION_TEMPLATES, isApprovable } from "./permissions";

/*
 * Mijoz tizimi xodimlarining ruxsatlari (EDU-CRM-PLAN 14-qaror): eski tizimdagidek lavozimlar. Direktor hamma
 * narsani qiladi; qolgan xodimning ruxsatlari — unga biriktirilgan lavozimdagi ro'yxat (permissions.ts katalogi).
 * Har server amali boshida aniq ruxsat tekshiriladi (`can`), menyuda yashirish — faqat qulaylik uchun.
 * Bu fayl client komponentda ham ishlatiladi — server importi yo'q.
 */

export type { StaffRole };
export * from "./permissions";

/** Xodimning ruxsatlari: sessiyada bir marta yig'iladi */
export interface StaffAccess {
  director: boolean;
  permissions: ReadonlySet<string>;
  /** "Tasdiq bilan" — amal direktor tasdig'idan keyin bajariladi (ADR 0019); `permissions` da bo'lsa kerak emas */
  approvals: ReadonlySet<string>;
}

export const DIRECTOR_ACCESS: StaffAccess = {
  director: true,
  permissions: new Set(ALL_PERMISSIONS),
  approvals: new Set(),
};

export function accessFor(
  role: StaffRole,
  positionPermissions: readonly string[] | null,
  positionApprovals: readonly string[] = [],
): StaffAccess {
  if (role === "director") return DIRECTOR_ACCESS;
  const permissions = new Set(positionPermissions ?? legacyPermissions(role));
  // Boshqa lavozimi to'liq ruxsat bergan bo'lsa tasdiq kerak emas (eski tizimdagidek)
  const approvals = new Set(positionApprovals.filter((p) => !permissions.has(p) && isApprovable(p)));
  return { director: false, permissions, approvals };
}

export type PermissionState = "allow" | "approval" | "deny";

/** Ro'yxatdagi birortasi ruxsat bo'lsa — "allow", aks holda birortasi tasdiq bilan bo'lsa — "approval" */
export function permissionState(access: StaffAccess, permissions: readonly Permission[]): PermissionState {
  if (canAny(access, permissions)) return "allow";
  return permissions.some((p) => access.approvals.has(p)) ? "approval" : "deny";
}

export function can(access: StaffAccess, permission: Permission): boolean {
  return access.director || access.permissions.has(permission);
}

/** Ro'yxatdagi birortasi bo'lsa yetadi (masalan sahifani ko'rish uchun) */
export function canAny(access: StaffAccess, permissions: readonly Permission[]): boolean {
  return access.director || permissions.some((p) => access.permissions.has(p));
}

/* ---------- Eski rollar (lavozimlardan oldingi) ---------- */

/** Faqat ko'rish ruxsatlari */
export const VIEW_PERMISSIONS: readonly Permission[] = ALL_PERMISSIONS.filter((p) => /(^|[._])view$/.test(p));

/** Lavozimlardan oldin yaratilgan xodim qaysi tayyor lavozimga o'tadi */
export const LEGACY_ROLE_TEMPLATE: Partial<Record<StaffRole, string>> = {
  manager: "branch_manager",
  cashier: "accountant",
};

/** Lavozimi hali biriktirilmagan eski xodim uchun vaqtinchalik ruxsatlar (lavozim ko'chirilguncha) */
export function legacyPermissions(role: StaffRole): readonly Permission[] {
  const code = LEGACY_ROLE_TEMPLATE[role];
  if (code) return POSITION_TEMPLATES.find((t) => t.code === code)?.permissions ?? [];
  return role === "viewer" ? VIEW_PERMISSIONS : [];
}

/* ---------- Filial bo'yicha cheklov ---------- */

/** "all" — barcha filiallar; aks holda ruxsat etilgan filiallar ro'yxati (bo'sh bo'lishi mumkin). */
export type BranchScope = "all" | readonly string[];

export function branchScope(director: boolean, assignedBranchIds: readonly string[]): BranchScope {
  return director ? "all" : [...new Set(assignedBranchIds)];
}

export function inScope(scope: BranchScope, branchId: string | null | undefined): boolean {
  if (scope === "all") return true;
  return !!branchId && scope.includes(branchId);
}
