"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { users } from "@ventura/db/schema/sawmill";
import type { Locale } from "@/lib/i18n";
import { currentSession } from "@/lib/server/session";

export async function setLocaleAction(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("sawmill_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  const session = await currentSession();
  if (session) {
    await session.deps.db.update(users).set({ locale, updatedAt: new Date() }).where(eq(users.id, session.user.id));
  }
}
