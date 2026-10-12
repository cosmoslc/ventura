"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inScope } from "@ventura/auth/staff/policy";
import { rooms } from "@ventura/db/schema/tenant";
import { firstError, roomInput } from "@/lib/rules";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { uz } from "@/lib/uz";

/*
 * Xonalar guruhlar bo'limiga tegishli (`groups.write`): xona guruh jadvali uchun kerak. O'chirish — butunlay
 * (eski tizimdagidek arxivsiz); guruhlar paydo bo'lgach (E1d) ular xonasiz qoladi.
 */

export async function saveRoomAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>("groups", async ({ db, staff, branch, audit }) => {
    const parsed = roomInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { id, name, capacity } = parsed.data;

    if (id) {
      const [existing] = await db.select().from(rooms).where(eq(rooms.id, id));
      if (!existing) return { ok: false, error: uz.common.gone };
      if (existing.branchId && !inScope(staff.scope, existing.branchId))
        return { ok: false, error: uz.common.branchForbidden };
      let branchId = existing.branchId;
      if (parsed.data.branchId && parsed.data.branchId !== existing.branchId) {
        if (!branch.options.some((b) => b.id === parsed.data.branchId))
          return { ok: false, error: uz.common.branchForbidden };
        branchId = parsed.data.branchId;
      }
      await db.update(rooms).set({ branchId, name, capacity }).where(eq(rooms.id, id));
      await audit(
        "room.update",
        { type: "room", id },
        {
          before: { name: existing.name, capacity: existing.capacity },
          after: { name, capacity },
        },
      );
      revalidatePath("/rooms");
      return { ok: true, id };
    }

    const branchId = resolveBranch(branch, parsed.data.branchId);
    if (!branchId) return { ok: false, error: uz.common.branchRequired };
    const [row] = await db.insert(rooms).values({ branchId, name, capacity }).returning({ id: rooms.id });
    await audit("room.create", { type: "room", id: row!.id }, { name, capacity });
    revalidatePath("/rooms");
    return { ok: true, id: row!.id };
  });
}

export async function deleteRoomAction(id: unknown): Promise<ActionResult> {
  return crmAction("groups", async ({ db, staff, audit }) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [room] = await db.select().from(rooms).where(eq(rooms.id, parsed.data));
    if (!room) return { ok: false, error: uz.common.gone };
    if (room.branchId && !inScope(staff.scope, room.branchId)) return { ok: false, error: uz.common.branchForbidden };
    await db.delete(rooms).where(eq(rooms.id, room.id));
    await audit("room.delete", { type: "room", id: room.id }, { name: room.name, capacity: room.capacity });
    revalidatePath("/rooms");
    return { ok: true };
  });
}
