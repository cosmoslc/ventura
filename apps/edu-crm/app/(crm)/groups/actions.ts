"use server";

import { and, arrayOverlaps, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@ventura/auth/staff/policy";
import { courses, groupMemberships, groupPrices, groups, rooms, students, teachers } from "@ventura/db/schema/tenant";
import { OPENING_MONTH } from "@/lib/billing";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { closePauses, monthStart, openPauses, promoteTrialStudent, todayTashkent } from "@/lib/server/memberships";
import { firstError, groupInput, membershipDateInput, membershipLeaveInput } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * Guruhlar va a'zolik (EDU-CRM-PLAN E1d, ADR 0012). Ruxsatlar eski tizimdagi "Guruhlar va Dars Jadvali"
 * toifasidan: ochish groups.create, tahrirlash groups.edit, o'chirish (arxiv) groups.delete, o'qituvchini
 * almashtirish groups.change_teacher, o'quvchi qo'shish groups.add_student, chiqarish groups.remove_student,
 * muzlatish students.freeze. Filial cheklovi amal qiladi.
 */

const FEATURE = "groups";
const uuid = z.uuid();

function refresh(groupId?: string, studentId?: string) {
  revalidatePath("/groups");
  if (groupId) revalidatePath(`/groups/${groupId}`);
  revalidatePath("/students");
  if (studentId) revalidatePath(`/students/${studentId}`);
}

async function loadGroup(ctx: ActionCtx, id: string) {
  const [g] = await ctx.db
    .select()
    .from(groups)
    .where(and(eq(groups.id, id), isNull(groups.archivedAt)));
  if (!g || !ctx.branch.options.some((b) => b.id === g.branchId)) return null;
  return g;
}

/** Xona yoki o'qituvchi shu kunlarda shu vaqtda boshqa guruhda bandmi (eski tizimda tekshiruv yo'q edi) */
async function conflict(
  ctx: ActionCtx,
  by: "room" | "teacher",
  value: string,
  v: { id?: string; days: string[]; startTime: string; endTime: string },
) {
  const [hit] = await ctx.db
    .select({ name: groups.name })
    .from(groups)
    .where(
      and(
        isNull(groups.archivedAt),
        by === "room" ? eq(groups.roomId, value) : eq(groups.teacherId, value),
        v.id ? ne(groups.id, v.id) : undefined,
        arrayOverlaps(groups.days, v.days),
        lt(groups.startTime, v.endTime),
        gt(groups.endTime, v.startTime),
      ),
    )
    .limit(1);
  return hit?.name ?? null;
}

export async function saveGroupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const raw = z.object({ id: uuid.optional() }).safeParse(input);
  const editing = raw.success && !!raw.data.id;
  return crmAction<{ id: string }>(
    FEATURE,
    editing ? ["groups.edit", "groups.change_teacher"] : "groups.create",
    async (ctx) => {
      const { db, branch, staff, audit } = ctx;
      const parsed = groupInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;

      const existing = v.id ? await loadGroup(ctx, v.id) : null;
      if (v.id && !existing) return { ok: false, error: uz.common.gone };
      if (existing) {
        // Kurs o'zgarmaydi (eski tizimdagidek); o'qituvchini almashtirish — alohida ruxsat
        if (existing.courseId !== v.courseId) return { ok: false, error: uz.common.invalid };
        const teacherChanged = existing.teacherId !== v.teacherId;
        const otherChanged =
          existing.name !== v.name ||
          existing.roomId !== v.roomId ||
          existing.price !== v.price ||
          existing.durationMonths !== v.durationMonths ||
          existing.days.join() !== v.days.join() ||
          existing.startTime !== v.startTime ||
          existing.endTime !== v.endTime ||
          existing.startDate !== v.startDate ||
          existing.color !== v.color ||
          existing.teacherSalaryType !== v.teacherSalaryType ||
          existing.teacherSalaryPercent !== v.teacherSalaryPercent ||
          existing.teacherSalaryAmount !== v.teacherSalaryAmount ||
          (existing.note ?? "") !== v.note;
        if (teacherChanged && !can(staff.access, "groups.change_teacher"))
          return { ok: false, error: uz.groups.teacherChangeForbidden };
        if (otherChanged && !can(staff.access, "groups.edit")) return { ok: false, error: uz.common.forbidden };
      }

      const branchId = existing?.branchId ?? resolveBranch(branch, v.branchId);
      if (!branchId) return { ok: false, error: uz.common.branchRequired };
      if (!existing && v.branchId && v.branchId !== branchId) return { ok: false, error: uz.common.branchForbidden };

      const [course] = await db
        .select({ id: courses.id, branchId: courses.branchId })
        .from(courses)
        .where(and(eq(courses.id, v.courseId), existing ? undefined : isNull(courses.archivedAt)));
      if (!course) return { ok: false, error: uz.groups.courseRequired };
      const [teacher] = await db
        .select({ id: teachers.id })
        .from(teachers)
        .where(and(eq(teachers.id, v.teacherId), eq(teachers.kind, "teacher"), isNull(teachers.archivedAt)));
      if (!teacher) return { ok: false, error: uz.groups.teacherRequired };
      if (v.roomId) {
        const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, v.roomId));
        if (!room) return { ok: false, error: uz.common.gone };
        const busy = await conflict(ctx, "room", v.roomId, v);
        if (busy) return { ok: false, error: uz.groups.roomBusy(busy) };
      }
      const busy = await conflict(ctx, "teacher", v.teacherId, v);
      if (busy) return { ok: false, error: uz.groups.teacherBusy(busy) };

      const values = {
        branchId,
        courseId: v.courseId,
        teacherId: v.teacherId,
        roomId: v.roomId,
        name: v.name,
        price: v.price,
        durationMonths: v.durationMonths,
        days: v.days,
        startTime: v.startTime,
        endTime: v.endTime,
        startDate: v.startDate,
        color: v.color,
        teacherSalaryType: v.teacherSalaryType,
        teacherSalaryPercent: v.teacherSalaryType === "percent" ? v.teacherSalaryPercent : null,
        teacherSalaryAmount: v.teacherSalaryType && v.teacherSalaryType !== "percent" ? v.teacherSalaryAmount : null,
        note: v.note || null,
      };

      if (existing) {
        // Narx o'zgarsa tarixga yoziladi: yangi narx tanlangan oydan, o'tgan oylar eski narxda (ADR 0015)
        const priceChanged = existing.price !== v.price;
        const currentMonth = todayTashkent().slice(0, 7);
        const priceFrom = v.priceFrom ?? currentMonth;
        const firstMonth = (existing.startDate < v.startDate ? existing.startDate : v.startDate).slice(0, 7);
        if (priceChanged && (priceFrom > currentMonth || priceFrom < firstMonth))
          return { ok: false, error: uz.groups.priceFromInvalid };
        await db.transaction(async (tx) => {
          await tx.update(groups).set(values).where(eq(groups.id, existing.id));
          if (!priceChanged) return;
          const steps = await tx.select().from(groupPrices).where(eq(groupPrices.groupId, existing.id));
          // Tarix hali bo'lmasa — eski narx "boshidan" (hisob shu paytgacha guruhning narxini ishlatgan)
          if (!steps.length)
            await tx
              .insert(groupPrices)
              .values({ groupId: existing.id, fromMonth: OPENING_MONTH, price: existing.price, createdBy: staff.id });
          // Yangi narx tanlangan oydan hozirgacha amal qiladi — keyingi qadamlar olib tashlanadi
          await tx
            .delete(groupPrices)
            .where(and(eq(groupPrices.groupId, existing.id), gt(groupPrices.fromMonth, priceFrom)));
          await tx
            .insert(groupPrices)
            .values({ groupId: existing.id, fromMonth: priceFrom, price: v.price, createdBy: staff.id })
            .onConflictDoUpdate({
              target: [groupPrices.tenantId, groupPrices.groupId, groupPrices.fromMonth],
              set: { price: v.price, createdBy: staff.id, createdAt: new Date() },
            });
        });
        const changed = (Object.keys(values) as (keyof typeof values)[]).filter(
          (k) => JSON.stringify(existing[k]) !== JSON.stringify(values[k]),
        );
        await audit(
          "group.update",
          { type: "group", id: existing.id },
          {
            name: v.name,
            fields: changed,
            ...(priceChanged ? { price: { from: existing.price, to: v.price, fromMonth: priceFrom } } : {}),
          },
        );
        refresh(existing.id);
        return { ok: true, id: existing.id };
      }
      const [row] = await db.insert(groups).values(values).returning({ id: groups.id });
      await audit("group.create", { type: "group", id: row!.id }, { name: v.name, courseId: v.courseId, branchId });
      refresh(row!.id);
      return { ok: true, id: row!.id };
    },
  );
}

export async function archiveGroupAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "groups.delete", async (ctx) => {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const g = await loadGroup(ctx, parsed.data);
    if (!g) return { ok: false, error: uz.common.gone };
    // Guruh arxivga o'tadi, a'zoliklar shu kun bilan yopiladi; to'lov va davomat tarixi saqlanadi
    const closed = await ctx.db.transaction(async (tx) => {
      await tx.update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, g.id));
      const r = await tx
        .update(groupMemberships)
        .set({ status: "left", leftAt: todayTashkent(), leftReason: uz.groups.archivedGroupReason })
        .where(and(eq(groupMemberships.groupId, g.id), isNull(groupMemberships.leftAt)))
        .returning({ id: groupMemberships.id });
      return r.length;
    });
    await ctx.audit("group.archive", { type: "group", id: g.id }, { name: g.name, closedMemberships: closed });
    refresh(g.id);
    revalidatePath("/archive");
    return { ok: true };
  });
}

/* ---------- A'zolik ---------- */

export async function enrollStudentAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "groups.add_student", async (ctx) => {
    const parsed = z.object({ groupId: uuid, studentId: uuid }).safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const g = await loadGroup(ctx, parsed.data.groupId);
    if (!g) return { ok: false, error: uz.groups.groupArchived };
    const [s] = await ctx.db
      .select()
      .from(students)
      .where(and(eq(students.id, parsed.data.studentId), isNull(students.archivedAt)));
    if (!s || !ctx.branch.options.some((b) => b.id === s.branchId))
      return { ok: false, error: uz.groups.studentArchived };
    if (s.branchId !== g.branchId) return { ok: false, error: uz.groups.branchMismatch };
    const [open] = await ctx.db
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(eq(groupMemberships.groupId, g.id), eq(groupMemberships.studentId, s.id), isNull(groupMemberships.leftAt)),
      );
    if (open) return { ok: false, error: uz.groups.alreadyMember };
    const [m] = await ctx.db
      .insert(groupMemberships)
      .values({ groupId: g.id, studentId: s.id, status: "trial", enrolledAt: todayTashkent(), createdBy: ctx.staff.id })
      .returning({ id: groupMemberships.id });
    await ctx.audit(
      "group.enroll",
      { type: "group", id: g.id },
      { student: s.name, studentId: s.id, membershipId: m!.id },
    );
    await ctx.audit("student.enroll", { type: "student", id: s.id }, { group: g.name, groupId: g.id });
    refresh(g.id, s.id);
    return { ok: true };
  });
}

/** Ochiq a'zolik, guruh va o'quvchi bilan (filial cheklovi tekshirilgan) */
async function loadMembership(ctx: ActionCtx, id: string) {
  const [row] = await ctx.db
    .select({ m: groupMemberships, g: groups, s: students })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .innerJoin(students, eq(students.id, groupMemberships.studentId))
    .where(and(eq(groupMemberships.id, id), isNull(groupMemberships.leftAt)));
  if (!row || !ctx.branch.options.some((b) => b.id === row.g.branchId)) return null;
  return row;
}

async function membershipAudit(
  ctx: ActionCtx,
  row: NonNullable<Awaited<ReturnType<typeof loadMembership>>>,
  action: string,
  meta: Record<string, unknown>,
) {
  await ctx.audit(
    `group.${action}`,
    { type: "group", id: row.g.id },
    { student: row.s.name, studentId: row.s.id, ...meta },
  );
  await ctx.audit(
    `student.${action}`,
    { type: "student", id: row.s.id },
    { group: row.g.name, groupId: row.g.id, ...meta },
  );
}

export async function activateMembershipAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "groups.add_student", async (ctx) => {
    const parsed = membershipDateInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const row = await loadMembership(ctx, parsed.data.id);
    if (!row) return { ok: false, error: uz.common.gone };
    if (row.m.status !== "trial") return { ok: false, error: uz.common.invalid };
    const date = parsed.data.date;
    // Oy boshidan faollashtirish mumkin (to'liq oy hisobi), undan oldin — yo'q
    if (date < monthStart(row.m.enrolledAt)) return { ok: false, error: uz.groups.dateBeforeEnroll };
    const promoted = await ctx.db.transaction(async (tx) => {
      await tx
        .update(groupMemberships)
        .set({ status: "active", activatedAt: date, pausedAt: null })
        .where(eq(groupMemberships.id, row.m.id));
      return promoteTrialStudent(tx, row.s.id);
    });
    await membershipAudit(ctx, row, "activate", { date, ...(promoted ? { studentActivated: true } : {}) });
    refresh(row.g.id, row.s.id);
    return { ok: true };
  });
}

export async function pauseMembershipAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "students.freeze", async (ctx) => {
    const parsed = z.object({ id: uuid, pause: z.boolean() }).safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const row = await loadMembership(ctx, parsed.data.id);
    if (!row) return { ok: false, error: uz.common.gone };
    const today = todayTashkent();
    if (parsed.data.pause) {
      if (row.m.status === "paused") return { ok: true };
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(groupMemberships)
          .set({ status: "paused", pausedAt: today })
          .where(eq(groupMemberships.id, row.m.id));
        await openPauses(tx, [row.m.id], today);
      });
    } else {
      if (row.m.status !== "paused") return { ok: true };
      // Faollashtirilgan bo'lsa faolga, sinovdan muzlatilgan bo'lsa sinovga qaytadi (asl sana saqlanadi)
      await ctx.db.transaction(async (tx) => {
        await closePauses(tx, [{ id: row.m.id, pausedAt: row.m.pausedAt }], today);
        await tx
          .update(groupMemberships)
          .set({ status: row.m.activatedAt ? "active" : "trial", pausedAt: null })
          .where(eq(groupMemberships.id, row.m.id));
      });
    }
    await membershipAudit(ctx, row, parsed.data.pause ? "pause" : "unpause", {});
    refresh(row.g.id, row.s.id);
    return { ok: true };
  });
}

export async function leaveMembershipAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "groups.remove_student", async (ctx) => {
    const parsed = membershipLeaveInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const row = await loadMembership(ctx, parsed.data.id);
    if (!row) return { ok: false, error: uz.common.gone };
    const { date, reason } = parsed.data;
    if (date < row.m.enrolledAt) return { ok: false, error: uz.groups.dateBeforeEnroll };
    // To'lov qaytarish va qarz tekshiruvi (eski "Tark etish" oynasi) — Moliya bilan (E3)
    await ctx.db.transaction(async (tx) => {
      if (row.m.status === "paused") await closePauses(tx, [{ id: row.m.id, pausedAt: row.m.pausedAt }], date);
      await tx
        .update(groupMemberships)
        .set({ status: "left", leftAt: date, leftReason: reason || null })
        .where(eq(groupMemberships.id, row.m.id));
    });
    await membershipAudit(ctx, row, "leave", { date, ...(reason ? { reason } : {}), from: row.m.status });
    refresh(row.g.id, row.s.id);
    return { ok: true };
  });
}
