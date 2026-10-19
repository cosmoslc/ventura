"use server";

import { revalidatePath } from "next/cache";
import { endOtherSessions } from "@ventura/auth/staff";
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
