"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { endOtherSessions } from "@ventura/auth/staff";
import { users } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";

/*
 * Profil (E6g): xodim faqat o'z hisobi ustida ishlaydi, shuning uchun alohida lavozim ruxsati kerak emas.
 * "Boshqa seanslarni yopish" joriy sessiyadan boshqa hammasini o'chiradi (sessiya muddati markaz siyosatida).
 */

export async function endOtherSessionsAction(): Promise<ActionResult<{ count: number }>> {
  return crmAction<{ count: number }>(
    "students",
    null,
    async ({ staff, db, audit }) => {
      const count = await endOtherSessions(db, staff.id, staff.sessionId);
      await audit("user.sessions_ended", { type: "user", id: staff.id }, { count });
      revalidatePath("/account");
      revalidatePath("/kabinet/profil");
      return { ok: true, count };
    },
    { teacher: true },
  );
}

/** 
 * 2FA (Ikki bosqichli tasdiqlash) ni yoqish yoki o'chirish
 * Muallif / Agent: Google Gemini
 */
export async function toggle2FAAction(enabled: boolean): Promise<ActionResult<{ enabled: boolean }>> {
  return crmAction(
    "students",
    null,
    async ({ staff, db, audit }) => {
      const [u] = await db
        .select({ telegramChatId: users.telegramChatId })
        .from(users)
        .where(eq(users.id, staff.id))
        .limit(1);

      if (enabled && !u?.telegramChatId) {
        return { ok: false, error: "2FA'ni yoqish uchun avval Telegram hisobingizni ulang." };
      }

      await db.update(users).set({ twoFactorEnabled: enabled }).where(eq(users.id, staff.id));
      await audit("user.2fa_toggled", { type: "user", id: staff.id }, { enabled });
      revalidatePath("/account");
      revalidatePath("/kabinet/profil");
      return { ok: true, enabled };
    },
    { teacher: true },
  );
}

/** Telegram hisobini uzish */
export async function unlinkTelegramAction(): Promise<ActionResult> {
  return crmAction(
    "students",
    null,
    async ({ staff, db, audit }) => {
      await db
        .update(users)
        .set({ telegramChatId: null, twoFactorEnabled: false })
        .where(eq(users.id, staff.id));
      await audit("user.telegram_unlinked", { type: "user", id: staff.id });
      revalidatePath("/account");
      revalidatePath("/kabinet/profil");
      return { ok: true };
    },
    { teacher: true },
  );
}
