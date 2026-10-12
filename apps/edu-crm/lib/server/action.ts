import "server-only";
import { type Permission, canAny } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import { tenantAudit } from "@ventura/security";
import { type Tenant, hasFeature } from "@ventura/tenants";
import { uz } from "@/lib/uz";
import { type BranchContext, getBranchContext } from "./branch";
import { getTenantDb } from "./deps";
import { requestMeta } from "./request";
import { type Staff, getStaff } from "./session";
import { currentTenant } from "./tenant";

/*
 * Server amallari uchun yagona o'ram (EDU-CRM-PLAN 9-bo'lim: ruxsatsiz amal yozib bo'lmaydi). Har amal boshida:
 * bo'lim yoqilgan, xodim to'liq kirgan va unda shu amalning ruxsati (lavozimidan, permissions.ts katalogi) bor.
 * Xato bo'lsa `redirect` emas, natija qaytadi — forma o'zi ko'rsatadi (ADR 0006: server amalida redirect yo'q).
 */

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface ActionCtx {
  tenant: Tenant;
  staff: Staff;
  db: TenantDb;
  branch: BranchContext;
  /** Faoliyat jurnaliga yozish (har o'zgartiruvchi amal — CLAUDE.md) */
  audit(action: string, target: { type: string; id: string }, metadata?: Record<string, unknown>): Promise<void>;
}

/** Natija turi aniq beriladi (`crmAction<{ id: string }>`), berilmasa — qo'shimcha maydonsiz. */
export async function crmAction<T extends object = object>(
  feature: string,
  permission: Permission | readonly Permission[],
  run: (ctx: ActionCtx) => Promise<ActionResult<NoInfer<T>>>,
): Promise<ActionResult<T>> {
  const tenant = await currentTenant();
  if (!tenant || !(await hasFeature(tenant, feature))) return { ok: false, error: uz.common.notFound };
  const staff = await getStaff();
  if (!staff || staff.state !== "ok") return { ok: false, error: uz.common.sessionGone };
  const needed: readonly Permission[] = typeof permission === "string" ? [permission] : permission;
  if (!canAny(staff.access, needed)) return { ok: false, error: uz.common.forbidden };
  const db = getTenantDb(tenant);
  const meta = await requestMeta();
  const branch = await getBranchContext();
  return run({
    tenant,
    staff,
    db,
    branch,
    async audit(action, target, metadata) {
      await tenantAudit.record(db, {
        actor: { type: "user", id: staff.id, name: staff.name },
        action,
        target,
        ...meta,
        metadata,
      });
    },
  });
}
