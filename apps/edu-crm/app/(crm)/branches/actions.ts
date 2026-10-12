"use server";

import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { branches, userBranches, users } from "@ventura/db/schema/tenant";
import { can, inScope } from "@ventura/auth/staff/policy";
import { branchInput, firstError } from "@/lib/rules";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { uz } from "@/lib/uz";
import { branchUsage } from "./data";

/*
 * Filiallar — "Filiallarni boshqarish" ruxsati (eski tizimdagidek). Yangi filial qo'shish va o'chirish — faqat
 * barcha filiallarni ko'radigan (direktor) xodimga: aks holda cheklangan xodim o'zi ko'rmaydigan filial yaratardi.
 * Xodim biriktirish (user_branches) qo'shimcha "Lavozim va ruxsatlarni biriktirish" ruxsatini talab qiladi —
 * filial cheklovi har so'rovda shu jadvaldan olinadi, sessiyani yopish shart emas.
 */

export async function saveBranchAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>("branches", "settings.branches", async ({ db, staff, audit }) => {
    const parsed = branchInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { id, name, phone, address, color, managerIds } = parsed.data;
    if (!id && staff.scope !== "all") return { ok: false, error: uz.common.forbidden };
    if (id && !inScope(staff.scope, id)) return { ok: false, error: uz.common.branchForbidden };
    const canAssign = can(staff.access, "staff.roles_assign");

    const [dup] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(id ? and(eq(branches.name, name), ne(branches.id, id)) : eq(branches.name, name));
    if (dup) return { ok: false, error: uz.branches.nameTaken };

    // Faqat direktor bo'lmagan, mavjud xodimlar biriktiriladi
    const staffIds = !canAssign
      ? null
      : managerIds.length
        ? (
            await db
              .select({ id: users.id })
              .from(users)
              .where(and(inArray(users.id, managerIds), ne(users.role, "director"), isNull(users.archivedAt)))
          ).map((u) => u.id)
        : [];

    const values = { name, phone: phone ? `+998${phone}` : null, address: address || null, color };
    let before: { name: string; color: string; staff: number } | null = null;
    if (id) {
      const [existing] = await db.select().from(branches).where(eq(branches.id, id));
      if (!existing) return { ok: false, error: uz.common.gone };
      const [prev] = await db.select({ n: count() }).from(userBranches).where(eq(userBranches.branchId, id));
      before = { name: existing.name, color: existing.color, staff: prev?.n ?? 0 };
    }

    // Filial va unga biriktirilgan xodimlar bitta tranzaksiyada
    const branchId = await db.transaction(async (tx) => {
      if (id) await tx.update(branches).set(values).where(eq(branches.id, id));
      const target = id ?? (await tx.insert(branches).values(values).returning({ id: branches.id }))[0]!.id;
      // Biriktirish ruxsati bo'lmasa — xodimlar ro'yxatiga tegilmaydi
      if (staffIds) {
        await tx.delete(userBranches).where(eq(userBranches.branchId, target));
        if (staffIds.length)
          await tx.insert(userBranches).values(staffIds.map((userId) => ({ userId, branchId: target })));
      }
      return target;
    });

    await audit(
      id ? "branch.update" : "branch.create",
      { type: "branch", id: branchId },
      {
        name,
        ...(before ? { before } : {}),
        ...(staffIds ? { staff: staffIds.length } : {}),
      },
    );
    revalidatePath("/", "layout");
    return { ok: true, id: branchId };
  });
}

export async function deleteBranchAction(id: unknown): Promise<ActionResult> {
  return crmAction("branches", "settings.branches", async ({ db, staff, audit }) => {
    if (staff.scope !== "all") return { ok: false, error: uz.common.forbidden };
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [branch] = await db.select().from(branches).where(eq(branches.id, parsed.data));
    if (!branch) return { ok: false, error: uz.common.gone };

    const [total] = await db.select({ n: count() }).from(branches);
    if ((total?.n ?? 0) <= 1) return { ok: false, error: uz.branches.lastBranch };
    const usage = await branchUsage(db, branch.id);
    const parts = [
      usage.courses ? uz.branches.dataCourses(usage.courses) : null,
      usage.rooms ? uz.branches.dataRooms(usage.rooms) : null,
      usage.teachers ? uz.branches.dataTeachers(usage.teachers) : null,
    ].filter((p): p is string => !!p);
    if (parts.length) return { ok: false, error: uz.branches.hasData(parts.join(", ")) };

    await db.delete(branches).where(eq(branches.id, branch.id));
    await audit("branch.delete", { type: "branch", id: branch.id }, { name: branch.name });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
