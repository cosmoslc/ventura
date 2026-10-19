import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { createStaffUser, revokeStaffSessions, setStaffPassword, unlockStaff } from "@ventura/auth/staff";
import { internalEmail } from "@ventura/auth/policy";
import { POSITION_TEMPLATES, isPermission } from "@ventura/auth/staff/policy";
import { positions, teachers, userBranches, userPositions, users } from "@ventura/db/schema/tenant";
import type { ActionCtx } from "./action";
import { tenantDeps } from "./deps";
import { requestOrigin } from "./request";

/*
 * O'qituvchi kabinetiga kirish hisobi (ADR 0062). Hisob — oddiy `users` qatori, `kind = 'teacher'`, o'qituvchining
 * telefoni bilan, "O'qituvchi / Mentor" lavozimida. `teachers.user_id` bog'laydi. Kirish olinganda hisob
 * arxivlanadi (telefon band qoladi) — qayta berilganda o'sha hisob tiklanadi.
 */

export const TEACHER_POSITION = "teacher";

export type TeacherLoginError = "phone_taken" | "position_too_wide" | "no_auth";

/** "O'qituvchi / Mentor" lavozimi; markaz uni o'chirgan bo'lsa — shablondan qayta yaratiladi */
export async function teacherPosition(ctx: ActionCtx) {
  const [found] = await ctx.db.select().from(positions).where(eq(positions.code, TEACHER_POSITION)).limit(1);
  if (found) return found;
  const tpl = POSITION_TEMPLATES.find((t) => t.code === TEACHER_POSITION)!;
  const [created] = await ctx.db
    .insert(positions)
    .values({ code: tpl.code, name: tpl.name, color: tpl.color, permissions: [...tpl.permissions] })
    .returning();
  return created!;
}

/** Shu telefonda boshqa (o'qituvchi bo'lmagan yoki boshqa o'qituvchiga bog'langan) hisob bormi */
async function phoneOwner(ctx: ActionCtx, phone: string, teacherId: string) {
  const [u] = await ctx.db.select().from(users).where(eq(users.phoneNumber, phone)).limit(1);
  if (!u) return { user: null, conflict: false };
  if (u.kind !== "teacher") return { user: u, conflict: true };
  const [linked] = await ctx.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.userId, u.id)).limit(1);
  return { user: u, conflict: !!linked && linked.id !== teacherId };
}

/** Telefon kirish uchun bo'shmi (o'qituvchi yaratishdan oldin tekshirish uchun) */
export async function teacherPhoneFree(ctx: ActionCtx, phone: string, teacherId: string | null) {
  const owner = await phoneOwner(ctx, phone, teacherId ?? "");
  return !owner.conflict;
}

/** Bu xodim o'qituvchiga kirish bera oladimi (lavozim ruxsatlari o'zinikidan keng emas, kirish sozlangan) */
export async function teacherLoginBlocker(ctx: ActionCtx): Promise<TeacherLoginError | null> {
  const position = await teacherPosition(ctx);
  const access = ctx.staff.access;
  if (!access.director && !position.permissions.every((p) => isPermission(p) && access.permissions.has(p)))
    return "position_too_wide";
  return tenantDeps(ctx.tenant) ? null : "no_auth";
}

/**
 * Kirish berish: yangi hisob yaratadi yoki shu o'qituvchining arxivdagi hisobini tiklaydi. Birinchi kirishda parol
 * almashtiriladi. Lavozim ruxsatlari beruvchining ruxsatlaridan keng bo'lmasligi kerak.
 */
export async function grantTeacherLogin(
  ctx: ActionCtx,
  teacher: { id: string; name: string; phone: string; branchId: string },
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: TeacherLoginError }> {
  const blocker = await teacherLoginBlocker(ctx);
  if (blocker) return { ok: false, error: blocker };
  const position = await teacherPosition(ctx);
  const owner = await phoneOwner(ctx, teacher.phone, teacher.id);
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
      .set({ name: teacher.name, archivedAt: null, mustChangePassword: true })
      .where(eq(users.id, userId));
    await unlockStaff(ctx.db, userId);
    await ctx.db.delete(userPositions).where(eq(userPositions.userId, userId));
    await ctx.db.insert(userPositions).values({ userId, positionId: position.id });
    await ctx.db.delete(userBranches).where(eq(userBranches.userId, userId));
    await ctx.db.insert(userBranches).values({ userId, branchId: teacher.branchId });
  } else {
    const user = await createStaffUser(auth, ctx.db, {
      phone: teacher.phone,
      name: teacher.name,
      password,
      role: "staff",
      kind: "teacher",
      branchIds: [teacher.branchId],
      positionIds: [position.id],
      mustChangePassword: true,
    });
    userId = user.id;
  }
  await ctx.db.update(teachers).set({ userId }).where(eq(teachers.id, teacher.id));
  return { ok: true, userId };
}

/** Parolni yangilash: ochiq sessiyalar yopiladi, birinchi kirishda almashtiriladi */
export async function resetTeacherPassword(ctx: ActionCtx, userId: string, password: string) {
  const deps = tenantDeps(ctx.tenant);
  if (!deps) return false;
  await setStaffPassword(deps.auth(await requestOrigin()), userId, password);
  await ctx.db.update(users).set({ mustChangePassword: true }).where(eq(users.id, userId));
  await unlockStaff(ctx.db, userId);
  await revokeStaffSessions(ctx.db, userId);
  return true;
}

/** Kirishni olish: hisob arxivlanadi va bog'lanish uziladi, ochiq sessiyalar yopiladi */
export async function revokeTeacherLogin(ctx: ActionCtx, teacherId: string, userId: string) {
  await ctx.db.update(teachers).set({ userId: null }).where(eq(teachers.id, teacherId));
  await ctx.db
    .update(users)
    .set({ archivedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.kind, "teacher"), isNull(users.archivedAt)));
  await revokeStaffSessions(ctx.db, userId);
}

/** O'qituvchi ma'lumoti o'zgarsa — hisobdagi ism va telefon (login) ham */
export async function syncTeacherLogin(ctx: ActionCtx, userId: string, data: { name: string; phone: string }) {
  await ctx.db
    .update(users)
    .set({ name: data.name, phoneNumber: data.phone, email: internalEmail(data.phone) })
    .where(eq(users.id, userId));
}
