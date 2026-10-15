"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { approvalRequests } from "@ventura/db/schema/tenant";
import { tenantAudit } from "@ventura/security";
import { approvalDecidedDraft } from "@/lib/notifications";
import type { ActionResult } from "@/lib/server/action";
import { APPROVAL_ACTIONS, isApprovalKey } from "@/lib/server/approval-registry";
import { getTenantDb } from "@/lib/server/deps";
import { notify } from "@/lib/server/notify";
import { requestMeta } from "@/lib/server/request";
import { getStaff } from "@/lib/server/session";
import { currentTenant } from "@/lib/server/tenant";
import { uz } from "@/lib/uz";

/*
 * Tasdiq so'rovlarini ko'rib chiqish (ADR 0019). Tasdiqlash va rad etish — faqat direktor; bekor qilish — faqat
 * so'rovchi o'zi, kutilayotgan so'rovni. Tasdiqlanganda amal reyestrdan saqlangan kirish bilan direktor sessiyasida
 * chaqiriladi (ruxsat, filial, Zod, qulf — oddiy chaqiruvdagidek). Bajarilmasa so'rov kutilmoqda holatiga qaytadi va
 * sababi yoziladi. Holat o'zgarishi "kutilmoqda" sharti bilan — bir so'rov ikki marta bajarilmaydi.
 */

const t = uz.approvals;
const idInput = z.uuid();
const rejectInput = z.object({ id: z.uuid(), note: z.string().trim().max(500).default("") });

async function context() {
  const tenant = await currentTenant();
  if (!tenant) return null;
  const staff = await getStaff();
  if (!staff || staff.state !== "ok") return null;
  const db = getTenantDb(tenant);
  const meta = await requestMeta();
  const audit = (action: string, id: string, metadata: Record<string, unknown>) =>
    tenantAudit.record(db, {
      actor: { type: "user", id: staff.id, name: staff.name },
      action,
      target: { type: "approval_request", id },
      ...meta,
      metadata,
    });
  return { db, staff, audit };
}

function refresh() {
  revalidatePath("/approvals");
  revalidatePath("/", "layout");
}

export async function approveRequestAction(id: unknown): Promise<ActionResult<{ title: string }>> {
  const c = await context();
  if (!c) return { ok: false, error: uz.common.sessionGone };
  if (!c.staff.director) return { ok: false, error: uz.common.forbidden };
  const parsed = idInput.safeParse(id);
  if (!parsed.success) return { ok: false, error: uz.common.invalid };

  // Navbatni egallash: faqat "kutilmoqda" bo'lsa — ikki direktor bir vaqtda bosganda bitta bajariladi
  const [claimed] = await c.db
    .update(approvalRequests)
    .set({ status: "approved", decidedBy: c.staff.id, decidedAt: new Date(), lastError: null })
    .where(and(eq(approvalRequests.id, parsed.data), eq(approvalRequests.status, "pending")))
    .returning();
  if (!claimed) return { ok: false, error: t.notPending };

  const reopen = async (error: string) => {
    await c.db
      .update(approvalRequests)
      .set({ status: "pending", decidedBy: null, decidedAt: null, lastError: error })
      .where(eq(approvalRequests.id, claimed.id));
    await c.audit("approval.fail", claimed.id, { action: claimed.action, error });
    refresh();
    return { ok: false as const, error: t.failed(error) };
  };

  if (!isApprovalKey(claimed.action)) return reopen(t.unknownAction);
  let result: ActionResult;
  try {
    result = await APPROVAL_ACTIONS[claimed.action](claimed.payload);
  } catch (err) {
    return reopen(err instanceof Error ? err.message : uz.common.error);
  }
  if (!result.ok) return reopen(result.error);
  await c.audit("approval.approve", claimed.id, { action: claimed.action, title: claimed.title });
  // So'rov egasiga bildirishnoma (E6d)
  await notify(c.db, [claimed.requestedBy], approvalDecidedDraft(true, claimed.title, c.staff.name), c.staff.id);
  refresh();
  return { ok: true, title: claimed.title };
}

export async function rejectRequestAction(input: unknown): Promise<ActionResult> {
  const c = await context();
  if (!c) return { ok: false, error: uz.common.sessionGone };
  if (!c.staff.director) return { ok: false, error: uz.common.forbidden };
  const parsed = rejectInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: uz.common.invalid };
  const [row] = await c.db
    .update(approvalRequests)
    .set({
      status: "rejected",
      decidedBy: c.staff.id,
      decidedAt: new Date(),
      decisionNote: parsed.data.note || null,
    })
    .where(and(eq(approvalRequests.id, parsed.data.id), eq(approvalRequests.status, "pending")))
    .returning({
      id: approvalRequests.id,
      action: approvalRequests.action,
      title: approvalRequests.title,
      requestedBy: approvalRequests.requestedBy,
    });
  if (!row) return { ok: false, error: t.notPending };
  await c.audit("approval.reject", row.id, { action: row.action, note: parsed.data.note || null });
  await notify(
    c.db,
    [row.requestedBy],
    approvalDecidedDraft(false, row.title, c.staff.name, parsed.data.note),
    c.staff.id,
  );
  refresh();
  return { ok: true };
}

export async function cancelRequestAction(id: unknown): Promise<ActionResult> {
  const c = await context();
  if (!c) return { ok: false, error: uz.common.sessionGone };
  const parsed = idInput.safeParse(id);
  if (!parsed.success) return { ok: false, error: uz.common.invalid };
  const [row] = await c.db
    .update(approvalRequests)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(approvalRequests.id, parsed.data),
        eq(approvalRequests.status, "pending"),
        eq(approvalRequests.requestedBy, c.staff.id),
      ),
    )
    .returning({ id: approvalRequests.id, action: approvalRequests.action });
  if (!row) return { ok: false, error: t.notPending };
  await c.audit("approval.cancel", row.id, { action: row.action });
  refresh();
  return { ok: true };
}
