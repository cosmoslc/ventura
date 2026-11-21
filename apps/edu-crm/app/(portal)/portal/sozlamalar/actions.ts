"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { passwordProblem } from "@ventura/auth/policy";
import { setStaffPassword, verifyStaffPassword } from "@ventura/auth/staff";
import { students, users } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { tenantDeps } from "@/lib/server/deps";
import { requestOrigin } from "@/lib/server/request";
import { requireStudent } from "@/lib/server/session";
import { uz } from "@/lib/uz";

/*
 * O'quvchi portali sozlamalari amallari (ADR 0063):
 * 1. Nickname (ism) o'zgartirish
 * 2. Parolni o'zgartirish
 * 3. 2FA (Telegram) yoqish/o'chirish
 * Muallif / Agent: Google Gemini
 */

const nicknameInput = z.object({
  name: z.string().trim().min(1, uz.portal.ismKiritilishiShart).max(120),
});

export async function updatePortalNicknameAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    "students",
    null,
    async (ctx) => {
      const student = await requireStudent();
      const parsed = nicknameInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.invalid };
      const { name } = parsed.data;

      await ctx.db.transaction(async (tx) => {
        await tx.update(students).set({ name }).where(eq(students.id, student.studentId));
        await tx.update(users).set({ name }).where(eq(users.id, student.id));
      });

      await ctx.audit("student.self_name_update", { type: "student", id: student.studentId }, { name });
      revalidatePath("/portal", "layout");
      return { ok: true };
    },
    { student: true },
  );
}

const passwordInput = z.object({
  currentPassword: z.string().min(1, uz.portal.joriyParolKiritilmadi),
  newPassword: z.string().min(6, uz.portal.yangiParolKamida6).max(128),
});

export async function changePortalPasswordAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    "students",
    null,
    async (ctx) => {
      const student = await requireStudent();
      const parsed = passwordInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.invalid };
      const { currentPassword, newPassword } = parsed.data;

      const problem = passwordProblem(newPassword);
      if (problem) return { ok: false, error: problem };

      const deps = tenantDeps(ctx.tenant);
      if (!deps) return { ok: false, error: uz.common.sessionGone };
      const auth = deps.auth(await requestOrigin());

      const valid = await verifyStaffPassword(auth, student.id, currentPassword);
      if (!valid) return { ok: false, error: uz.portal.joriyParolNotogri };

      await setStaffPassword(auth, student.id, newPassword);
      await ctx.audit("student.self_password_change", { type: "student", id: student.studentId });
      return { ok: true };
    },
    { student: true },
  );
}

export async function togglePortal2FAAction(input: unknown): Promise<ActionResult<{ needTelegram?: boolean }>> {
  return crmAction(
    "students",
    null,
    async (ctx) => {
      const student = await requireStudent();
      const flag = z.boolean().safeParse(input);
      if (!flag.success) return { ok: false, error: uz.common.invalid };
      const enable = flag.data;
      const [u] = await ctx.db
        .select({ telegramChatId: users.telegramChatId })
        .from(users)
        .where(eq(users.id, student.id))
        .limit(1);

      if (enable) {
        if (!u?.telegramChatId) {
          return { ok: true, needTelegram: true };
        }
        await ctx.db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, student.id));
        await ctx.audit("student.2fa.enable", { type: "student", id: student.studentId });
      } else {
        await ctx.db.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, student.id));
        await ctx.audit("student.2fa.disable", { type: "student", id: student.studentId });
      }

      revalidatePath("/portal/sozlamalar");
      return { ok: true };
    },
    { student: true },
  );
}
