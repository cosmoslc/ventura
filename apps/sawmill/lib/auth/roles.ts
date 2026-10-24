import type { SawmillRole } from "@ventura/db/schema/sawmill";

/*
 * Sawmill foydalanuvchi rollari va ruxsatlari (SAWMILL-PLAN 2-bo'lim, 4-qaror):
 * - owner (egasi): barcha amallar (yaratish, tahrirlash, o'chirish, sozlamalar, arxiv)
 * - accountant (hisobchi): kiritish, tahrirlash va ko'rish (o'chirish va sozlamalarsiz)
 * - viewer (ko'ruvchi): faqat ko'rish
 */

export type { SawmillRole };

export type SawmillPermission =
  | "teraks.view"
  | "teraks.manage"
  | "teraks.delete"
  | "workers.view"
  | "workers.manage"
  | "workers.delete"
  | "work.view"
  | "work.manage"
  | "work.delete"
  | "stock.view"
  | "stock.manage"
  | "stock.adjust"
  | "dispatch.view"
  | "dispatch.manage"
  | "dispatch.delete"
  | "trucks.view"
  | "trucks.manage"
  | "expenses.view"
  | "expenses.manage"
  | "orders.view"
  | "orders.manage"
  | "reports.view"
  | "settings.view"
  | "settings.manage"
  | "users.manage";

const ACCOUNTANT_PERMISSIONS: ReadonlySet<SawmillPermission> = new Set([
  "teraks.view",
  "teraks.manage",
  "workers.view",
  "workers.manage",
  "work.view",
  "work.manage",
  "stock.view",
  "stock.manage",
  "dispatch.view",
  "dispatch.manage",
  "trucks.view",
  "trucks.manage",
  "expenses.view",
  "expenses.manage",
  "orders.view",
  "orders.manage",
  "reports.view",
  "settings.view",
]);

export function can(role: SawmillRole, permission: SawmillPermission): boolean {
  if (role === "owner") return true;
  if (role === "accountant") return ACCOUNTANT_PERMISSIONS.has(permission);
  if (role === "viewer") return permission.endsWith(".view");
  return false;
}
