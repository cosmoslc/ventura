"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { normalizeUzPhone } from "@ventura/auth";
import { users } from "@ventura/db/schema/sawmill";
import { currentDeps, requestOrigin } from "@/lib/server/session";

export interface FormState {
  error?: string;
  info?: string;
  next?: string;
}

const signInSchema = z.object({
  phone: z.string().max(32),
  password: z.string().min(1).max(128),
});

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    phone: String(form.get("phone") ?? ""),
    password: String(form.get("password") ?? ""),
  });

  const phone = parsed.success ? normalizeUzPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) {
    return { error: "Telefon raqami yoki parol noto'g'ri" };
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return { error: "Mijoz bazasi sozlanmagan" };
  }

  const [u] = await deps.db
    .select({ id: users.id, lockedAt: users.lockedAt, archivedAt: users.archivedAt })
    .from(users)
    .where(eq(users.phoneNumber, phone))
    .limit(1);

  if (!u || u.archivedAt) {
    return { error: "Telefon raqami yoki parol noto'g'ri" };
  }

  if (u.lockedAt) {
    return { error: "Hisob vaqtincha bloklangan" };
  }

  const origin = await requestOrigin();
  const auth = deps.auth(origin);

  try {
    const internalEmail = `${phone}@sawmill.local`;
    await auth.api.signInEmail({
      body: {
        email: internalEmail,
        password: parsed.data.password,
      },
      headers: await headers(),
    });

    return { next: "/" };
  } catch {
    return { error: "Telefon raqami yoki parol noto'g'ri" };
  }
}

export async function logoutAction(): Promise<void> {
  const { deps } = await currentDeps();
  if (deps) {
    const origin = await requestOrigin();
    const auth = deps.auth(origin);
    await auth.api.signOut({ headers: await headers() }).catch(() => {});
  }
}
