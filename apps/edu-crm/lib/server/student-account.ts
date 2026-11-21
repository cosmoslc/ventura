import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { createStaffUser, revokeStaffSessions, setStaffPassword, unlockStaff } from "@ventura/auth/staff";
import { internalEmail } from "@ventura/auth/policy";
import { students, userBranches, users } from "@ventura/db/schema/tenant";
import type { ActionCtx } from "./action";
import { tenantDeps } from "./deps";
import { requestOrigin } from "./request";

/*
 * O'quvchi kabinetiga kirish hisobi (ADR 0063). Hisob — oddiy `users` qatori, `kind = 'student'`,
 * o'quvchining telefoni bilan, dastlab 2FA'siz. `students.user_id` bog'laydi.
 * Admin yoki o'qituvchi o'quvchiga parol o'rnatib bera oladi.
 * Muallif / Agent: Google Gemini
 */

export type StudentLoginError = "phone_taken" | "no_auth";

/** Shu telefonda boshqa (o'quvchi bo'lmagan yoki boshqa o'quvchiga bog'langan) hisob bormi */
async function phoneOwner(ctx: ActionCtx, phone: string, studentId: string) {
  const [u] = await ctx.db.select().from(users).where(eq(users.phoneNumber, phone)).limit(1);
  if (!u) return { user: null, conflict: false };
  if (u.kind !== "student") return { user: u, conflict: true };
  const [linked] = await ctx.db.select({ id: students.id }).from(students).where(eq(students.userId, u.id)).limit(1);
  return { user: u, conflict: !!linked && linked.id !== studentId };
}

/** Telefon kirish uchun bo'shmi (o'quvchi yaratish yoki tahrirlashdan oldin tekshirish) */
export async function studentPhoneFree(ctx: ActionCtx, phone: string, studentId: string | null) {
  const owner = await phoneOwner(ctx, phone, studentId ?? "");
  return !owner.conflict;
}

/**
 * Kirish berish: yangi student hisobi yaratadi yoki shu o'quvchining arxivdagi hisobini tiklaydi.
 * Parol o'rnatiladi, 2FA dastlab o'chiq bo'ladi (foydalanuvchi talabi).
 */
export async function grantStudentLogin(
  ctx: ActionCtx,
  student: { id: string; name: string; phone: string; branchId: string },
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: StudentLoginError }> {
  const owner = await phoneOwner(ctx, student.phone, student.id);
  if (owner.conflict) return { ok: false, error: "phone_taken" };
  const deps = tenantDeps(ctx.tenant);
  if (!deps) return { ok: false, error: "no_auth" };
  const auth = deps.auth(await requestOrigin());

  let userId: string;
  if (owner.user) {
    userId = owner.user.id;
    await setStaffPassword(auth, userId, password);
    await ctx.db
      .update(users)
      .set({ name: student.name, archivedAt: null, mustChangePassword: false })
      .where(eq(users.id, userId));
    await unlockStaff(ctx.db, userId);
    await ctx.db.delete(userBranches).where(eq(userBranches.userId, userId));
    await ctx.db.insert(userBranches).values({ userId, branchId: student.branchId });
  } else {
    const user = await createStaffUser(auth, ctx.db, {
      phone: student.phone,
      name: student.name,
      password,
      role: "viewer",
      kind: "student",
      branchIds: [student.branchId],
      mustChangePassword: false,
    });
    userId = user.id;
  }
  await ctx.db.update(students).set({ userId }).where(eq(students.id, student.id));
  return { ok: true, userId };
}

/** Parolni yangilash */
export async function resetStudentPassword(ctx: ActionCtx, userId: string, password: string) {
  const deps = tenantDeps(ctx.tenant);
  if (!deps) return false;
  await setStaffPassword(deps.auth(await requestOrigin()), userId, password);
  await ctx.db.update(users).set({ mustChangePassword: false }).where(eq(users.id, userId));
  await unlockStaff(ctx.db, userId);
  await revokeStaffSessions(ctx.db, userId);
  return true;
}

/** Kirishni olish: hisob arxivlanadi va bog'lanish uziladi, ochiq sessiyalar yopiladi */
export async function revokeStudentLogin(ctx: ActionCtx, studentId: string, userId: string) {
  await ctx.db.update(students).set({ userId: null }).where(eq(students.id, studentId));
  await ctx.db
    .update(users)
    .set({ archivedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.kind, "student"), isNull(users.archivedAt)));
  await revokeStaffSessions(ctx.db, userId);
}

/** O'quvchi ma'lumoti o'zgarsa — hisobdagi ism va telefon (login) ham sinxronlanadi */
export async function syncStudentLogin(ctx: ActionCtx, userId: string, data: { name: string; phone: string }) {
  await ctx.db
    .update(users)
    .set({ name: data.name, phoneNumber: data.phone, email: internalEmail(data.phone) })
    .where(eq(users.id, userId));
}
