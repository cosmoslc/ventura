"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatPhone, internalEmail } from "@ventura/auth/policy";
import {
  createStaffUser,
  notifyDirectors,
  resetStaffTelegram,
  revokeStaffSessions,
  setStaffPassword,
  temporaryPassword,
  unlockStaff,
} from "@ventura/auth/staff";
import { can } from "@ventura/auth/staff/policy";
import { positions, settings, userBranches, userPositions, users } from "@ventura/db/schema/tenant";
import { escapeHtml } from "@ventura/integrations";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { tenantDeps } from "@/lib/server/deps";
import { requestOrigin } from "@/lib/server/request";
import { firstError, staffInput } from "@/lib/rules";
import { STAFF_FIELDS_KEY, cleanCustomData, missingRequired, formFieldsSchema } from "@/lib/form-fields";
import { uz } from "@/lib/uz";
import { type StaffRow, getStaffFields, listStaff, withinAccess } from "./data";

/*
 * Xodimlar (EDU-CRM-PLAN 14-qaror). Ruxsat oshirishga yo'l yo'q:
 *  - lavozim, filial va maoshni faqat "Lavozim va ruxsatlarni biriktirish" ruxsati bilan, o'zinikini hech qachon;
 *  - o'zida yo'q ruxsatli lavozimni berib bo'lmaydi; o'zidan kuchliroq xodimni tahrirlab/bloklab bo'lmaydi;
 *  - filial cheklovi bor xodim faqat o'z filiallaridagi xodimlarni ko'radi va faqat o'z filiallarini beradi.
 * Parol hech qachon formada yozilmaydi: vaqtinchalik parol yaratiladi va bir marta ko'rsatiladi.
 */

const FEATURE = "teachers";
const PATH = "/staff";
const uuid = z.uuid();

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Boshqariladigan xodim: ko'rinadi, direktor emas, bo'shatilmagan va joriy xodimdan kuchli emas */
async function loadTarget(
  ctx: ActionCtx,
  id: unknown,
): Promise<{ ok: true; row: StaffRow } | { ok: false; error: string }> {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return { ok: false, error: uz.common.invalid };
  const scope = ctx.staff.scope === "all" ? null : ctx.staff.scope;
  const [row] = await listStaff(ctx.db, ctx.staff, scope, parsed.data);
  if (!row) return { ok: false, error: uz.common.gone };
  if (!row.manageable) return { ok: false, error: uz.common.forbidden };
  return { ok: true, row };
}

async function notify(ctx: ActionCtx, html: string) {
  const deps = tenantDeps(ctx.tenant);
  if (deps) await notifyDirectors(deps, html);
}

export async function saveStaffAction(input: unknown): Promise<ActionResult<{ id: string; password: string | null }>> {
  const raw = z.object({ id: uuid.optional() }).safeParse(input);
  const editing = raw.success && !!raw.data.id;
  return crmAction<{ id: string; password: string | null }>(
    FEATURE,
    editing ? "staff.edit" : "staff.create",
    async (ctx) => {
      const { db, staff, audit } = ctx;
      const parsed = staffInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;
      const phone = `+998${v.phone}`;
      const canAssign = can(staff.access, "staff.roles_assign");

      const fields = await getStaffFields(db);
      const missing = missingRequired(v.customData, fields);
      if (missing) return { ok: false, error: uz.staff.fieldMissing(missing.label) };

      const [dup] = await db
        .select({ id: users.id })
        .from(users)
        .where(v.id ? and(eq(users.phoneNumber, phone), ne(users.id, v.id)) : eq(users.phoneNumber, phone));
      if (dup) return { ok: false, error: uz.staff.phoneTaken };

      let target: StaffRow | null = null;
      if (v.id) {
        const t = await loadTarget(ctx, v.id);
        if (!t.ok) return t;
        target = t.row;
      }

      const salary =
        v.salaryType === "kpi"
          ? {
              monthlySalary: v.monthlySalary,
              kpiStudentAmount: v.kpiStudentAmount,
              kpiContractBonus: v.kpiContractBonus,
            }
          : { monthlySalary: v.monthlySalary, kpiStudentAmount: 0, kpiContractBonus: 0 };
      const positionsChanged =
        !target ||
        !sameSet(
          target.positions.map((p) => p.id),
          v.positionIds,
        );
      const branchesChanged = !target || !sameSet(target.branchIds, v.branchIds);
      const salaryChanged =
        !target ||
        target.salaryType !== v.salaryType ||
        target.monthlySalary !== salary.monthlySalary ||
        target.kpiStudentAmount !== salary.kpiStudentAmount ||
        target.kpiContractBonus !== salary.kpiContractBonus;
      const assigning = positionsChanged || branchesChanged || salaryChanged;

      if (assigning && !canAssign) return { ok: false, error: uz.staff.notAllowedFields };
      if (assigning && target?.self) return { ok: false, error: uz.staff.selfForbidden };
      if (positionsChanged && !v.positionIds.length) return { ok: false, error: uz.staff.positionRequired };
      if (branchesChanged && !v.branchIds.length) return { ok: false, error: uz.staff.branchRequired };

      if (positionsChanged) {
        const chosen = await db.select().from(positions).where(inArray(positions.id, v.positionIds));
        if (chosen.length !== new Set(v.positionIds).size) return { ok: false, error: uz.common.gone };
        const before = target?.positions.map((p) => p.id) ?? [];
        const added = chosen.filter((p) => !before.includes(p.id));
        if (!added.every((p) => withinAccess(staff.access, p.permissions))) {
          return { ok: false, error: uz.staff.positionTooWide };
        }
      }
      if (branchesChanged) {
        const allowed = ctx.branch.options.map((b) => b.id);
        const added = v.branchIds.filter((b) => !target?.branchIds.includes(b));
        if (!added.every((b) => allowed.includes(b))) return { ok: false, error: uz.common.branchForbidden };
      }

      // Ro'yxatda yo'q (o'chirilgan) maydonlarning eski qiymatlari saqlanib qoladi
      const keep = Object.fromEntries(
        Object.entries(target?.customData ?? {}).filter(([k]) => !fields.some((f) => f.id === k)),
      );
      const profile = {
        name: v.name,
        phoneNumber: phone,
        email: internalEmail(phone),
        gender: v.gender,
        birthDate: v.birthDate || null,
        address: v.address || null,
        note: v.note || null,
        customData: { ...keep, ...cleanCustomData(v.customData, fields) },
        ...(assigning ? { salaryType: v.salaryType, ...salary } : {}),
      };

      if (!target) {
        const deps = tenantDeps(ctx.tenant);
        if (!deps) return { ok: false, error: uz.common.error };
        const password = temporaryPassword();
        const user = await createStaffUser(deps.auth(await requestOrigin()), db, {
          phone,
          name: v.name,
          password,
          role: "staff",
          branchIds: v.branchIds,
          positionIds: v.positionIds,
          mustChangePassword: true,
        });
        await db.update(users).set(profile).where(eq(users.id, user.id));
        await audit(
          "staff.create",
          { type: "user", id: user.id },
          {
            name: v.name,
            phone: formatPhone(phone),
            positions: v.positionIds.length,
            branches: v.branchIds.length,
            salaryType: v.salaryType,
          },
        );
        revalidatePath(PATH);
        return { ok: true, id: user.id, password };
      }

      const id = target.id;
      await db.transaction(async (tx) => {
        await tx.update(users).set(profile).where(eq(users.id, id));
        if (positionsChanged) {
          await tx.delete(userPositions).where(eq(userPositions.userId, id));
          await tx.insert(userPositions).values(v.positionIds.map((positionId) => ({ userId: id, positionId })));
        }
        if (branchesChanged) {
          await tx.delete(userBranches).where(eq(userBranches.userId, id));
          await tx.insert(userBranches).values(v.branchIds.map((branchId) => ({ userId: id, branchId })));
        }
      });
      await audit(
        "staff.update",
        { type: "user", id },
        {
          name: v.name,
          ...(target.phone !== v.phone ? { phone: formatPhone(phone) } : {}),
          ...(positionsChanged ? { positions: v.positionIds } : {}),
          ...(branchesChanged ? { branches: v.branchIds } : {}),
          ...(salaryChanged ? { salaryType: v.salaryType } : {}),
        },
      );
      // Lavozim o'zgarsa ruxsatlar keyingi so'rovdan kuchga kiradi (sessiya har so'rovda o'qiladi)
      revalidatePath(PATH);
      return { ok: true, id, password: null };
    },
  );
}

export async function archiveStaffAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "staff.delete", async (ctx) => {
    const t = await loadTarget(ctx, id);
    if (!t.ok) return t;
    if (t.row.self) return { ok: false, error: uz.staff.cannotSelf };
    await ctx.db.update(users).set({ archivedAt: new Date() }).where(eq(users.id, t.row.id));
    await revokeStaffSessions(ctx.db, t.row.id);
    await ctx.audit("staff.archive", { type: "user", id: t.row.id }, { name: t.row.name });
    await notify(ctx, `🗂 <b>Xodim bo'shatildi</b>: ${escapeHtml(t.row.name)}\nKim: ${escapeHtml(ctx.staff.name)}`);
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function setStaffLockAction(id: unknown, lock: boolean): Promise<ActionResult> {
  return crmAction(FEATURE, "staff.edit", async (ctx) => {
    const t = await loadTarget(ctx, id);
    if (!t.ok) return t;
    if (t.row.self) return { ok: false, error: uz.staff.cannotSelf };
    if (lock) {
      await ctx.db.update(users).set({ lockedAt: new Date() }).where(eq(users.id, t.row.id));
      await revokeStaffSessions(ctx.db, t.row.id);
    } else {
      await unlockStaff(ctx.db, t.row.id);
    }
    await ctx.audit(lock ? "staff.lock" : "staff.unlock", { type: "user", id: t.row.id }, { name: t.row.name });
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function resetStaffPasswordAction(id: unknown): Promise<ActionResult<{ password: string }>> {
  return crmAction<{ password: string }>(FEATURE, "staff.edit", async (ctx) => {
    const t = await loadTarget(ctx, id);
    if (!t.ok) return t;
    if (t.row.self) return { ok: false, error: uz.staff.cannotSelf };
    const deps = tenantDeps(ctx.tenant);
    if (!deps) return { ok: false, error: uz.common.error };
    const password = temporaryPassword();
    await setStaffPassword(deps.auth(await requestOrigin()), t.row.id, password);
    await ctx.db.update(users).set({ mustChangePassword: true }).where(eq(users.id, t.row.id));
    await revokeStaffSessions(ctx.db, t.row.id);
    await ctx.audit("staff.reset_password", { type: "user", id: t.row.id }, { name: t.row.name });
    await notify(ctx, `🔑 <b>Parol tiklandi</b>: ${escapeHtml(t.row.name)}\nKim: ${escapeHtml(ctx.staff.name)}`);
    revalidatePath(PATH);
    return { ok: true, password };
  });
}

export async function resetStaffTelegramAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "staff.edit", async (ctx) => {
    const t = await loadTarget(ctx, id);
    if (!t.ok) return t;
    if (t.row.self) return { ok: false, error: uz.staff.cannotSelf };
    await resetStaffTelegram(ctx.db, t.row.id);
    await ctx.audit("staff.reset_telegram", { type: "user", id: t.row.id }, { name: t.row.name });
    await notify(ctx, `🛠 <b>Telegram qayta ulanadi</b>: ${escapeHtml(t.row.name)}\nKim: ${escapeHtml(ctx.staff.name)}`);
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function saveStaffFieldsAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "staff.edit", async ({ db, staff, audit }) => {
    const parsed = formFieldsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const ids = parsed.data.map((f) => f.id);
    if (new Set(ids).size !== ids.length) return { ok: false, error: uz.common.invalid };
    await db
      .insert(settings)
      .values({ key: STAFF_FIELDS_KEY, value: parsed.data, updatedBy: staff.id })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: parsed.data, updatedBy: staff.id, updatedAt: new Date() },
      });
    await audit("settings.update", { type: "setting", id: STAFF_FIELDS_KEY }, { fields: ids });
    revalidatePath(PATH);
    return { ok: true };
  });
}
