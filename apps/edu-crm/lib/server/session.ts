import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { type AccessState, accessState, isSessionExpired } from "@ventura/auth";
import {
  type BranchScope,
  type StaffPermission,
  type StaffRole,
  branchScope,
  can,
  getStaffSessionPolicy,
  staffBranchIds,
} from "@ventura/auth/staff";
import { type Tenant, hasFeature } from "@ventura/tenants";
import { type TenantDeps, tenantDeps } from "./deps";
import { requestOrigin } from "./request";
import { currentTenant } from "./tenant";

/** Joriy mijoz; domen hech kimga ulanmagan bo'lsa — 404. */
export async function requireTenant(): Promise<Tenant> {
  const tenant = await currentTenant();
  if (!tenant) notFound();
  return tenant;
}

/** Joriy mijoz va uning bog'liqliklari; baza sozlanmagan bo'lsa — null (kirish sahifasi buni ko'rsatadi). */
export const currentDeps = cache(async (): Promise<{ tenant: Tenant; deps: TenantDeps | null }> => {
  const tenant = await requireTenant();
  return { tenant, deps: tenantDeps(tenant) };
});

export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: StaffRole;
  telegramLinked: boolean;
  state: AccessState;
  sessionId: string;
  /** Ko'ra oladigan filiallari: "all" yoki ro'yxat */
  scope: BranchScope;
}

/**
 * Joriy xodim. Sessiya markaz sozlamasidagi muddatdan oshgan yoki hisob bloklangan bo'lsa,
 * sessiya bekor qilinadi va null qaytadi. Bir so'rov ichida bir marta bajariladi.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const h = await headers();
  const { deps } = await currentDeps();
  if (!deps) return null;
  const auth = deps.auth(await requestOrigin());
  const data = await auth.api.getSession({ headers: h });
  if (!data) return null;
  const u = data.user as typeof data.user & {
    role: StaffRole;
    telegramChatId: string | null;
    mustChangePassword: boolean;
    lockedAt: Date | null;
    twoFactorEnabled: boolean;
    phoneNumber: string | null;
  };
  const policy = await getStaffSessionPolicy(deps.db);
  if (u.lockedAt || isSessionExpired(new Date(data.session.createdAt), policy)) {
    await auth.api.revokeSession({ headers: h, body: { token: data.session.token } }).catch(() => {});
    return null;
  }
  return {
    id: u.id,
    name: u.name,
    phone: u.phoneNumber ?? "",
    role: u.role,
    telegramLinked: !!u.telegramChatId && u.twoFactorEnabled,
    state: accessState({
      lockedAt: u.lockedAt ?? null,
      mustChangePassword: !!u.mustChangePassword,
      twoFactorEnabled: !!u.twoFactorEnabled,
      telegramChatId: u.telegramChatId ?? null,
    }),
    sessionId: data.session.id,
    scope: branchScope(u.role, u.role === "director" ? [] : await staffBranchIds(deps.db, u.id)),
  };
});

/** To'liq kirgan (parol + Telegram kodi) xodim; aks holda tegishli sahifaga yo'naltiradi. */
export async function requireStaff(permission?: StaffPermission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (staff.state === "must_change_password") redirect("/account/password");
  if (staff.state === "needs_telegram") redirect("/connect-telegram");
  if (staff.state !== "ok") redirect("/login");
  if (permission && !can(staff.role, permission)) redirect("/?ruxsat=yoq");
  return staff;
}

/**
 * Bo'lim sahifasi va server amallari boshida: bo'lim o'chirilgan bo'lsa — 404 (SPEC 8: manzil ham yopiq,
 * ma'lumot o'chmaydi), ruxsat bo'lmasa — bosh sahifaga.
 */
export async function requireFeature(feature: string, action: "view" | "write" = "view") {
  const tenant = await requireTenant();
  if (!(await hasFeature(tenant, feature))) notFound();
  const staff = await requireStaff(`${feature}.${action}`);
  return { tenant, staff };
}
