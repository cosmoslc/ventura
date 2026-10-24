"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { normalizeUzPhone } from "@ventura/auth";
import { accounts, users } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can, type SawmillRole } from "@/lib/auth/roles";
import { requestOrigin, requireUser } from "@/lib/server/session";

export interface UserItem {
  id: string;
  name: string;
  phone: string;
  role: SawmillRole;
  lockedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}

export async function getUsersAction(): Promise<UserItem[]> {
  const { user, deps } = await requireUser();
  if (!can(user.role, "users.view")) {
    throw new Error("Ruxsat berilmagan");
  }

  const rows = await deps.db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phoneNumber,
      role: users.role,
      lockedAt: users.lockedAt,
      archivedAt: users.archivedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(isNull(users.archivedAt))
    .orderBy(desc(users.createdAt));

  return rows.map((r) => ({
    ...r,
    phone: r.phone ?? "",
    role: (r.role ?? "viewer") as SawmillRole,
  }));
}

export async function createUserAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { user, deps } = await requireUser();
  if (!can(user.role, "users.manage")) {
    return { ok: false, error: "Faqat tizim egasi foydalanuvchi qo'sha oladi" };
  }

  const rawPhone = String(formData.get("phone") || "").trim();
  const phone = normalizeUzPhone(rawPhone);
  if (!phone) {
    return { ok: false, error: "Telefon raqami noto'g'ri kiritildi (+998901234567 formatida)" };
  }

  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) {
    return { ok: false, error: "Ism kamida 2 ta belgidan iborat bo'lishi kerak" };
  }

  const role = String(formData.get("role") || "viewer") as SawmillRole;
  if (!["owner", "accountant", "viewer"].includes(role)) {
    return { ok: false, error: "Noto'g'ri rol tanlandi" };
  }

  const password = String(formData.get("password") || "").trim();
  if (password.length < 8) {
    return { ok: false, error: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" };
  }

  // Mavjudligini tekshirish
  const [existing] = await deps.db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phoneNumber, phone), isNull(users.archivedAt)))
    .limit(1);

  if (existing) {
    return { ok: false, error: "Ushbu telefon raqami bilan foydalanuvchi allaqachon mavjud" };
  }

  const origin = await requestOrigin();
  const auth = deps.auth(origin);
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const internalEmail = `${phone}@sawmill.local`;

  const createdUser = await ctx.internalAdapter.createUser(
    {
      name,
      email: internalEmail,
      phoneNumber: phone,
      phoneNumberVerified: true,
      role,
      locale: "uz",
      telegramChatId: null,
      twoFactorEnabled: false,
      mustChangePassword: false,
      failedAttempts: 0,
    },
    { method: "admin" },
  );

  await ctx.internalAdapter.linkAccount({
    userId: createdUser.id,
    providerId: "credential",
    accountId: createdUser.id,
    password: hash,
  });

  await deps.db
    .update(users)
    .set({ phoneNumber: phone, role })
    .where(eq(users.id, createdUser.id));

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "user.create",
    target: { type: "user", id: createdUser.id },
    metadata: { name, phone, role },
  });

  revalidatePath("/users");
  return { ok: true };
}

export async function toggleLockUserAction(targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  const { user, deps } = await requireUser();
  if (!can(user.role, "users.manage")) {
    return { ok: false, error: "Ruxsat yo'q" };
  }

  if (user.id === targetUserId) {
    return { ok: false, error: "O'z hisobingizni bloklay olmaysiz" };
  }

  const [target] = await deps.db
    .select({ id: users.id, lockedAt: users.lockedAt, name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) return { ok: false, error: "Foydalanuvchi topilmadi" };

  const isLocked = !!target.lockedAt;
  const newLockedAt = isLocked ? null : new Date();

  await deps.db
    .update(users)
    .set({ lockedAt: newLockedAt, failedAttempts: 0 })
    .where(eq(users.id, targetUserId));

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: isLocked ? "user.unlock" : "user.lock",
    target: { type: "user", id: targetUserId },
    metadata: { name: target.name },
  });

  revalidatePath("/users");
  return { ok: true };
}

export async function updateUserRoleAction(
  targetUserId: string,
  newRole: SawmillRole,
): Promise<{ ok: boolean; error?: string }> {
  const { user, deps } = await requireUser();
  if (!can(user.role, "users.manage")) {
    return { ok: false, error: "Ruxsat yo'q" };
  }

  if (!["owner", "accountant", "viewer"].includes(newRole)) {
    return { ok: false, error: "Noto'g'ri rol" };
  }

  await deps.db
    .update(users)
    .set({ role: newRole })
    .where(eq(users.id, targetUserId));

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "user.role_change",
    target: { type: "user", id: targetUserId },
    metadata: { newRole },
  });

  revalidatePath("/users");
  return { ok: true };
}

export async function archiveUserAction(targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  const { user, deps } = await requireUser();
  if (!can(user.role, "users.manage")) {
    return { ok: false, error: "Ruxsat yo'q" };
  }

  if (user.id === targetUserId) {
    return { ok: false, error: "O'z hisobingizni arxivlay olmaysiz" };
  }

  const [target] = await deps.db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  await deps.db
    .update(users)
    .set({ archivedAt: new Date() })
    .where(eq(users.id, targetUserId));

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "user.archive",
    target: { type: "user", id: targetUserId },
    metadata: { name: target?.name },
  });

  revalidatePath("/users");
  return { ok: true };
}

export async function changeUserPasswordAction(
  targetUserId: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const { user, deps } = await requireUser();
  if (!can(user.role, "users.manage")) {
    return { ok: false, error: "Ruxsat yo'q" };
  }

  if (newPassword.length < 8) {
    return { ok: false, error: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" };
  }

  const origin = await requestOrigin();
  const auth = deps.auth(origin);
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);

  // Better Auth accounts jadvalida parolni yangilash
  await deps.db
    .update(accounts)
    .set({ password: hash, updatedAt: new Date() })
    .where(and(eq(accounts.userId, targetUserId), eq(accounts.providerId, "credential")));

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "user.password_reset",
    target: { type: "user", id: targetUserId },
    metadata: {},
  });

  return { ok: true };
}
