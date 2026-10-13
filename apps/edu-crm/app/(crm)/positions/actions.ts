"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type StaffAccess, isApprovable, normalizePermissions } from "@ventura/auth/staff/policy";
import { positions, userPositions } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { uz } from "@/lib/uz";

/*
 * Lavozimlar — "Lavozimlar va ruxsatlarni sozlash" ruxsati. Tizim lavozimi (Bosh Direktor) o'zgarmaydi va o'chmaydi.
 * Ruxsat oshirishga yo'l yo'q: direktor bo'lmagan xodim lavozimga o'zida yo'q ruxsatni qo'sha olmaydi.
 */

const FEATURE = "teachers";
const PERMISSION = "settings.roles_permissions";

const positionInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, uz.positions.nameRequired).max(80),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((v) => v.toLowerCase()),
  permissions: z.array(z.string()).max(200),
  /** "Tasdiq bilan" ruxsatlar; berilmasa (nom/rangni tahrirlash) — o'zgarmaydi */
  approvals: z.array(z.string()).max(200).optional(),
});

/** Tasdiq bilan ro'yxati: katalogdagi, tasdiqqa yaroqli va to'liq ruxsat berilmaganlari */
const normalizeApprovals = (ids: readonly string[], permissions: readonly string[]) =>
  normalizePermissions(ids).filter((p) => isApprovable(p) && !permissions.includes(p));

/** Qo'shilayotgan ruxsatlar xodimning o'zida bormi */
function withinOwn(access: StaffAccess, added: readonly string[]) {
  return access.director || added.every((p) => access.permissions.has(p));
}

/** "Tasdiq bilan" ham ruxsat oshirish emas: xodimning o'zida ruxsat yoki tasdiq bilan bo'lgani beriladi */
function approvalsWithinOwn(access: StaffAccess, added: readonly string[]) {
  return access.director || added.every((p) => access.permissions.has(p) || access.approvals.has(p));
}

export async function savePositionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>(FEATURE, PERMISSION, async ({ db, staff, audit }) => {
    const parsed = positionInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.invalid };
    const { id, name, color } = parsed.data;
    const permissions = normalizePermissions(parsed.data.permissions);

    const [dup] = await db
      .select({ id: positions.id })
      .from(positions)
      .where(id ? and(eq(positions.name, name), ne(positions.id, id)) : eq(positions.name, name));
    if (dup) return { ok: false, error: uz.positions.nameTaken };

    if (id) {
      const [existing] = await db.select().from(positions).where(eq(positions.id, id));
      if (!existing) return { ok: false, error: uz.common.gone };
      if (existing.system) return { ok: false, error: uz.positions.systemLocked };
      const added = permissions.filter((p) => !existing.permissions.includes(p));
      const removed = existing.permissions.filter((p) => !(permissions as string[]).includes(p));
      if (!withinOwn(staff.access, added)) return { ok: false, error: uz.positions.tooWide };
      const approvals = normalizeApprovals(parsed.data.approvals ?? existing.approvals, permissions);
      const approvalsAdded = approvals.filter((p) => !existing.approvals.includes(p));
      const approvalsRemoved = existing.approvals.filter((p) => !(approvals as string[]).includes(p));
      if (!approvalsWithinOwn(staff.access, approvalsAdded)) return { ok: false, error: uz.positions.tooWide };
      await db.update(positions).set({ name, color, permissions, approvals }).where(eq(positions.id, id));
      await audit(
        "position.update",
        { type: "position", id },
        {
          name,
          ...(existing.name !== name ? { before: existing.name } : {}),
          added,
          removed,
          approvalsAdded,
          approvalsRemoved,
        },
      );
      revalidatePath("/positions");
      return { ok: true, id };
    }

    if (!withinOwn(staff.access, permissions)) return { ok: false, error: uz.positions.tooWide };
    const approvals = normalizeApprovals(parsed.data.approvals ?? [], permissions);
    if (!approvalsWithinOwn(staff.access, approvals)) return { ok: false, error: uz.positions.tooWide };
    const [row] = await db
      .insert(positions)
      .values({ name, color, permissions, approvals })
      .returning({ id: positions.id });
    await audit("position.create", { type: "position", id: row!.id }, { name, permissions: permissions.length });
    revalidatePath("/positions");
    return { ok: true, id: row!.id };
  });
}

export async function clonePositionAction(id: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  return crmAction<{ id: string; name: string }>(FEATURE, PERMISSION, async ({ db, staff, audit }) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [source] = await db.select().from(positions).where(eq(positions.id, parsed.data));
    if (!source) return { ok: false, error: uz.common.gone };
    if (!withinOwn(staff.access, source.permissions) || !approvalsWithinOwn(staff.access, source.approvals))
      return { ok: false, error: uz.positions.tooWide };

    // Bo'sh nom topiladi: "X (Nusxasi)", "X (Nusxasi) 2", ...
    const taken = new Set((await db.select({ name: positions.name }).from(positions)).map((p) => p.name));
    const base = `${source.name} ${uz.positions.copySuffix}`;
    let name = base;
    for (let i = 2; taken.has(name); i++) name = `${base} ${i}`;

    const [row] = await db
      .insert(positions)
      .values({ name, color: source.color, permissions: source.permissions, approvals: source.approvals })
      .returning({ id: positions.id });
    await audit("position.create", { type: "position", id: row!.id }, { name, clonedFrom: source.id });
    revalidatePath("/positions");
    return { ok: true, id: row!.id, name };
  });
}

export async function deletePositionAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, PERMISSION, async ({ db, audit }) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [position] = await db.select().from(positions).where(eq(positions.id, parsed.data));
    if (!position) return { ok: false, error: uz.common.gone };
    if (position.system) return { ok: false, error: uz.positions.systemNoDelete };
    // Bo'shatilgan xodimlar ham bog'langan bo'lishi mumkin — lavozim ular tarixida qoladi
    const [used] = await db.select({ n: count() }).from(userPositions).where(eq(userPositions.positionId, position.id));
    if ((used?.n ?? 0) > 0) return { ok: false, error: uz.positions.inUse(used!.n) };
    await db.delete(positions).where(eq(positions.id, position.id));
    await audit("position.delete", { type: "position", id: position.id }, { name: position.name });
    revalidatePath("/positions");
    return { ok: true };
  });
}
