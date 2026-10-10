import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { type AccessState, type Permission, accessState, can, getSessionPolicy, isSessionExpired } from "@ventura/auth";
import type { Role } from "@ventura/db/schema/panel";
import { deps } from "./deps";

export interface Viewer {
  id: string;
  name: string;
  phone: string;
  role: Role;
  telegramLinked: boolean;
  state: AccessState;
  sessionId: string;
}

/**
 * Joriy foydalanuvchi. Sessiya umumiy muddat sozlamasidan oshgan yoki hisob bloklangan bo'lsa,
 * sessiya bekor qilinadi va null qaytadi. Bir so'rov ichida bir marta bajariladi (cache).
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const { auth, db } = deps();
  const h = await headers();
  const data = await auth.api.getSession({ headers: h });
  if (!data) return null;
  const u = data.user as typeof data.user & {
    role: Role;
    telegramChatId: string | null;
    mustChangePassword: boolean;
    lockedAt: Date | null;
    twoFactorEnabled: boolean;
    phoneNumber: string | null;
  };
  const policy = await getSessionPolicy(db);
  if (u.lockedAt || isSessionExpired(new Date(data.session.createdAt), policy)) {
    await auth.api.revokeSession({ headers: h, body: { token: data.session.token } }).catch(() => {});
    return null;
  }
  return {
    id: u.id,
    name: u.name,
    phone: u.phoneNumber ?? "",
    role: u.role,
    telegramLinked: !!u.telegramChatId && u.twoFactorEnabled,
    state: accessState({
      lockedAt: u.lockedAt ?? null,
      mustChangePassword: !!u.mustChangePassword,
      twoFactorEnabled: !!u.twoFactorEnabled,
      telegramChatId: u.telegramChatId ?? null,
    }),
    sessionId: data.session.id,
  };
});

/** Panel sahifalari va action'lari uchun: kirmagan, 2FA ulanmagan yoki ruxsati yo'q bo'lsa yo'naltiradi. */
export async function requireViewer(permission: Permission = "view"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.state === "must_change_password") redirect("/account/password");
  if (viewer.state === "needs_telegram") redirect("/connect-telegram");
  if (viewer.state !== "ok") redirect("/login");
  if (!can(viewer.role, permission)) redirect("/?ruxsat=yoq");
  return viewer;
}
