import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { type AccessState, accessState, isSessionExpired } from "@ventura/auth";
import {
  type BranchScope,
  type Permission,
  type StaffAccess,
  type StaffRole,
  accessFor,
  branchScope,
  canAny,
  ensurePositions,
  getStaffSessionPolicy,
  isDeviceBlocked,
  staffBranchIds,
  staffPermissionLists,
  staffPositions,
} from "@ventura/auth/staff";
import { type UserKind, groups, teachers } from "@ventura/db/schema/tenant";
import { type Tenant, hasFeature } from "@ventura/tenants";
import { pagePermissions } from "@/lib/access";
import { type TenantDeps, tenantDeps } from "./deps";
import { currentDeviceId, requestOrigin } from "./request";
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
  /** `teacher` — faqat o'qituvchi kabineti (ADR 0062) */
  kind: UserKind;
  /** Bog'langan o'qituvchi (faqat `teacher` hisobida) */
  teacherId: string | null;
  director: boolean;
  /** Ruxsatlar: direktor — hammasi, qolganlar — lavozimlaridan */
  access: StaffAccess;
  positions: { id: string; name: string; color: string }[];
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
  const { tenant, deps } = await currentDeps();
  if (!deps) return null;
  const auth = deps.auth(await requestOrigin());
  const data = await auth.api.getSession({ headers: h });
  if (!data) return null;
  const u = data.user as typeof data.user & {
    role: StaffRole;
    kind: UserKind | null;
    telegramChatId: string | null;
    mustChangePassword: boolean;
    lockedAt: Date | null;
    archivedAt: Date | null;
    twoFactorEnabled: boolean;
    phoneNumber: string | null;
  };
  await ensurePositionsOnce(deps.db, tenant.slug);
  const policy = await getStaffSessionPolicy(deps.db);
  if (u.lockedAt || isSessionExpired(new Date(data.session.createdAt), policy)) {
    await auth.api.revokeSession({ headers: h, body: { token: data.session.token } }).catch(() => {});
    return null;
  }
  if (u.archivedAt) {
    await auth.api.revokeSession({ headers: h, body: { token: data.session.token } }).catch(() => {});
    return null;
  }
  // Direktor bu qurilmani bloklagan bo'lsa (E6g): ochiq sessiya ham ishlamaydi
  if (await isDeviceBlocked(deps.db, u.id, await currentDeviceId())) {
    await auth.api.revokeSession({ headers: h, body: { token: data.session.token } }).catch(() => {});
    return null;
  }
  // O'qituvchi hisobi: bog'langan faol o'qituvchi bo'lmasa (arxivlangan yoki kirish olingan) — sessiya yopiladi
  const kind: UserKind = u.kind === "teacher" ? "teacher" : "staff";
  const teacher =
    kind === "teacher"
      ? ((
          await deps.db
            .select({ id: teachers.id, branchId: teachers.branchId })
            .from(teachers)
            .where(and(eq(teachers.userId, u.id), isNull(teachers.archivedAt)))
        )[0] ?? null)
      : null;
  if (kind === "teacher" && !teacher) {
    await auth.api.revokeSession({ headers: h, body: { token: data.session.token } }).catch(() => {});
    return null;
  }
  const director = kind === "staff" && u.role === "director";
  const [lists, positions] = director
    ? [null, []]
    : await Promise.all([staffPermissionLists(deps.db, u.id), staffPositions(deps.db, u.id)]);
  return {
    id: u.id,
    name: u.name,
    phone: u.phoneNumber ?? "",
    role: u.role,
    kind,
    teacherId: teacher?.id ?? null,
    director,
    access: accessFor(u.role, lists?.permissions ?? null, lists?.approvals ?? []),
    positions,
    telegramLinked: !!u.telegramChatId && u.twoFactorEnabled,
    state: accessState({
      lockedAt: u.lockedAt ?? null,
      mustChangePassword: !!u.mustChangePassword,
      twoFactorEnabled: !!u.twoFactorEnabled,
      telegramChatId: u.telegramChatId ?? null,
    }),
    sessionId: data.session.id,
    // O'qituvchi: o'z filiali va guruhlari turgan filiallar (ko'rinish baribir faqat o'z guruhlari bilan cheklanadi)
    scope: teacher
      ? await teacherBranches(deps.db, teacher)
      : branchScope(director, director ? [] : await staffBranchIds(deps.db, u.id)),
  };
});

async function teacherBranches(db: TenantDeps["db"], teacher: { id: string; branchId: string }) {
  const rows = await db
    .selectDistinct({ branchId: groups.branchId })
    .from(groups)
    .where(eq(groups.teacherId, teacher.id));
  return [...new Set([teacher.branchId, ...rows.map((r) => r.branchId)])];
}

/** Lavozimlar jadvali bir marta tayyorlanadi (har mijoz uchun, jarayon davomida) */
const g = globalThis as unknown as { __eduPositionsReady?: Set<string> };
const positionsReady = (g.__eduPositionsReady ??= new Set());
async function ensurePositionsOnce(db: TenantDeps["db"], slug: string) {
  if (positionsReady.has(slug)) return;
  await ensurePositions(db);
  positionsReady.add(slug);
}

/**
 * To'liq kirgan (parol + Telegram kodi) xodim; aks holda tegishli sahifaga yo'naltiradi. `area` — qaysi qism:
 * `admin` (standart) — o'qituvchi hisobi kabinetga yuboriladi; `any` — ikkalasi ham (filial konteksti va h.k.).
 */
export async function requireStaff(
  permissions?: readonly Permission[],
  area: "admin" | "any" = "admin",
): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (staff.state === "must_change_password") redirect("/account/password");
  if (staff.state === "needs_telegram") redirect("/connect-telegram");
  if (staff.state !== "ok") redirect("/login");
  if (area === "admin" && staff.kind === "teacher") redirect("/kabinet");
  if (permissions && !canAny(staff.access, permissions)) redirect("/?ruxsat=yoq");
  return staff;
}

/** O'qituvchi kabineti sahifasi (ADR 0062): faqat `teacher` hisobi; admin xodim CRM bosh sahifasiga */
export async function requireTeacher(): Promise<Staff & { teacherId: string }> {
  const staff = await requireStaff(undefined, "any");
  if (staff.kind !== "teacher" || !staff.teacherId) redirect("/");
  return { ...staff, teacherId: staff.teacherId };
}

/**
 * Bo'lim sahifasi boshida: bo'lim o'chirilgan bo'lsa — 404 (SPEC 8: manzil ham yopiq, ma'lumot o'chmaydi),
 * sahifani ochadigan ruxsat (lib/access.ts) bo'lmasa — bosh sahifaga.
 */
export async function requirePage(feature: string, href: string) {
  const tenant = await requireTenant();
  if (!(await hasFeature(tenant, feature))) notFound();
  const staff = await requireStaff(pagePermissions(href));
  return { tenant, staff };
}
