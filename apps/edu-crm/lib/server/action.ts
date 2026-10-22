import "server-only";
import { type Permission, permissionState } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import { tenantAudit } from "@ventura/security";
import { type Tenant, hasFeature } from "@ventura/tenants";
import { uz } from "@/lib/uz";
import type { ApprovalKey } from "./approval-registry";
import { createApprovalRequest } from "./approvals";
import { type BranchContext, getBranchContext } from "./branch";
import { getTenantDb } from "./deps";
import { requestMeta } from "./request";
import { type Staff, getStaff } from "./session";
import { currentTenant } from "./tenant";

/*
 * Server amallari uchun yagona o'ram (EDU-CRM-PLAN 9-bo'lim: ruxsatsiz amal yozib bo'lmaydi). Har amal boshida:
 * bo'lim yoqilgan, xodim to'liq kirgan va unda shu amalning ruxsati (lavozimidan, permissions.ts katalogi) bor.
 * Ruxsat "tasdiq bilan" bo'lsa (ADR 0019) amal bajarilmaydi — direktorga tasdiq so'rovi yoziladi va natija
 * `pending` bilan qaytadi; direktor tasdiqlasa shu amal shu kirish bilan uning nomidan qayta chaqiriladi.
 * Xato bo'lsa `redirect` emas, natija qaytadi — forma o'zi ko'rsatadi (ADR 0006: server amalida redirect yo'q).
 */

export interface ActionFailure {
  ok: false;
  error: string;
  /** Amal bajarilmadi, direktor tasdig'iga yuborildi */
  pending?: true;
}

export type ActionResult<T extends object = object> = ({ ok: true } & T) | ActionFailure;

export interface ActionCtx {
  tenant: Tenant;
  staff: Staff;
  db: TenantDb;
  branch: BranchContext;
  /** Faoliyat jurnaliga yozish (har o'zgartiruvchi amal — CLAUDE.md) */
  audit(action: string, target: { type: string; id: string }, metadata?: Record<string, unknown>): Promise<void>;
  /**
   * Amal ichidagi qo'shimcha ruxsat tekshiruvi (masalan yozuv turiga qarab): ruxsat bo'lsa — null, "tasdiq bilan"
   * bo'lsa — so'rov yozib `pending` natija, aks holda — rad.
   */
  requireAny(permissions: readonly Permission[]): Promise<ActionFailure | null>;
}

export interface ActionOptions {
  /** Shu amal "tasdiq bilan" bo'lishi mumkin: reyestrdagi kaliti va xodim yuborgan kirish */
  approval?: { action: ApprovalKey; input: unknown };
  /**
   * O'qituvchi hisobi (ADR 0062) ham chaqira oladi. Bunday amal o'zi guruh egaligini tekshiradi
   * (`lib/server/teacher-scope.ts`). Belgilanmagan amal o'qituvchiga yopiq.
   */
  teacher?: true;
  /**
   * O'quvchi hisobi (ADR 0063) chaqira oladigan amallar (profil, 2FA, sozlamalar).
   * Belgilanmagan amal o'quvchiga yopiq.
   */
  student?: true;
}

/**
 * Natija turi aniq beriladi (`crmAction<{ id: string }>`), berilmasa — qo'shimcha maydonsiz.
 * `permission = null` — ruxsat kerak emas, faqat to'liq kirgan xodim (o'z profili ustidagi amallar, E6g).
 */
export async function crmAction<T extends object = object>(
  feature: string,
  permission: Permission | readonly Permission[] | null,
  run: (ctx: ActionCtx) => Promise<ActionResult<NoInfer<T>>>,
  options: ActionOptions = {},
): Promise<ActionResult<T>> {
  const tenant = await currentTenant();
  if (!tenant || !(await hasFeature(tenant, feature))) return { ok: false, error: uz.common.notFound };
  const staff = await getStaff();
  if (!staff || staff.state !== "ok") return { ok: false, error: uz.common.sessionGone };
  if (staff.kind === "teacher" && !options.teacher) return { ok: false, error: uz.common.forbidden };
  if (staff.kind === "student" && !options.student) return { ok: false, error: uz.common.forbidden };
  const db = getTenantDb(tenant);
  const meta = await requestMeta();
  const branch = await getBranchContext();

  async function audit(action: string, target: { type: string; id: string }, metadata?: Record<string, unknown>) {
    await tenantAudit.record(db, {
      actor: { type: "user", id: staff!.id, name: staff!.name },
      action,
      target,
      ...meta,
      metadata,
    });
  }

  async function requireAny(needed: readonly Permission[]): Promise<ActionFailure | null> {
    const state = permissionState(staff!.access, needed);
    if (state === "allow") return null;
    if (state === "deny" || !options.approval) return { ok: false, error: uz.common.forbidden };
    const request = await createApprovalRequest(db, {
      staff: staff!,
      branch,
      permission: needed.find((p) => staff!.access.approvals.has(p))!,
      action: options.approval.action,
      input: options.approval.input,
    });
    await audit(
      "approval.request",
      { type: "approval_request", id: request.id },
      { action: options.approval.action, title: request.title },
    );
    return { ok: false, error: uz.approvals.sent(request.title), pending: true };
  }

  if (permission !== null) {
    const needed: readonly Permission[] = typeof permission === "string" ? [permission] : permission;
    const gate = await requireAny(needed);
    if (gate) return gate;
  }
  return run({ tenant, staff, db, branch, audit, requireAny });
}
