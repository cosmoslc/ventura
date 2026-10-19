"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { teachers, users } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { uz } from "@/lib/uz";

/*
 * O'qituvchi kabineti amallari (ADR 0062). Faqat o'z kartasi: ism, jins, tug'ilgan sana. Telefon (login), filial va
 * maosh shartlarini markaz administratori o'zgartiradi.
 */

const profileInput = z.object({
  name: z.string().trim().min(1, uz.kabinet.nameRequired).max(120),
  gender: z.enum(["male", "female"]).nullable(),
  birthDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
});

export async function saveKabinetProfileAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    "teachers",
    null,
    async (ctx) => {
      if (ctx.staff.kind !== "teacher" || !ctx.staff.teacherId) return { ok: false, error: uz.common.forbidden };
      const parsed = profileInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.invalid };
      const v = parsed.data;
      const teacherId = ctx.staff.teacherId;
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(teachers)
          .set({ name: v.name, gender: v.gender, birthDate: v.birthDate || null })
          .where(eq(teachers.id, teacherId));
        await tx.update(users).set({ name: v.name }).where(eq(users.id, ctx.staff.id));
      });
      await ctx.audit("teacher.self_update", { type: "teacher", id: teacherId }, { name: v.name });
      revalidatePath("/kabinet", "layout");
      return { ok: true };
    },
    { teacher: true },
  );
}
