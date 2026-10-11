import type { StaffRole } from "@ventura/db/schema/tenant";

/*
 * Mijoz tizimi xodimlarining rollari va ruxsatlari (EDU-CRM-PLAN 9-qaror): tayyor rollar va filial bo'yicha
 * cheklov. Har server amali boshida `can()` tekshiriladi; menyuda yashirish faqat qulaylik uchun.
 *
 * Ruxsat bo'lim kalitiga bog'langan (`students.view`, `payments.write`): yangi bo'lim qo'shilganda
 * rollar jadvalini o'zgartirish shart emas, faqat rolning qaysi bo'limlarga tegishi aniqlanadi.
 * Bu fayl client komponentda ham ishlatiladi (menyu) — server importi yo'q.
 */

export type { StaffRole };

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  director: "Direktor",
  manager: "Menejer",
  cashier: "Kassir",
  viewer: "Kuzatuvchi",
};

export const STAFF_ROLE_HINTS: Record<StaffRole, string> = {
  director: "Hamma bo'lim, barcha filiallar, xodimlar va sozlamalar",
  manager: "O'quv jarayoni, sotuv va to'lovlar — o'z filiallarida",
  cashier: "To'lovlar, qarzdorlar va xarajatlar — o'z filiallarida",
  viewer: "Faqat ko'rish — o'z filiallarida",
};

export type Action = "view" | "write";
/** `<bo'lim>.<amal>` yoki tizim ruxsatlari */
export type StaffPermission = `${string}.${Action}` | "staff.manage" | "settings.manage";

/** Moliya ichidagi nozik bo'limlar: menejer va kuzatuvchiga yopiq. */
const SENSITIVE = new Set(["salaries", "expenses"]);
/** Kassir ishlaydigan bo'limlar va u faqat ko'radiganlari. */
const CASHIER_WRITE = new Set(["payments", "debtors", "expenses"]);
const CASHIER_VIEW = new Set(["students", "groups", "courses"]);

function allowsFeature(role: StaffRole, feature: string, action: Action): boolean {
  switch (role) {
    case "director":
      return true;
    case "manager":
      return !SENSITIVE.has(feature);
    case "cashier":
      return CASHIER_WRITE.has(feature) || (action === "view" && CASHIER_VIEW.has(feature));
    case "viewer":
      return action === "view" && !SENSITIVE.has(feature);
  }
}

export function can(role: StaffRole, permission: StaffPermission): boolean {
  if (permission === "staff.manage" || permission === "settings.manage") return role === "director";
  const dot = permission.lastIndexOf(".");
  return allowsFeature(role, permission.slice(0, dot), permission.slice(dot + 1) as Action);
}

/* ---------- Filial bo'yicha cheklov ---------- */

/** "all" — barcha filiallar; aks holda ruxsat etilgan filiallar ro'yxati (bo'sh bo'lishi mumkin). */
export type BranchScope = "all" | readonly string[];

export function branchScope(role: StaffRole, assignedBranchIds: readonly string[]): BranchScope {
  return role === "director" ? "all" : [...new Set(assignedBranchIds)];
}

export function inScope(scope: BranchScope, branchId: string | null | undefined): boolean {
  if (scope === "all") return true;
  return !!branchId && scope.includes(branchId);
}
