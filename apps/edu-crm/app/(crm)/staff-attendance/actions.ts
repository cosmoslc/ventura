"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EMPLOYEE_ATTENDANCE_STATUSES, employeeAttendance } from "@ventura/db/schema/tenant";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { todayTashkent } from "@/lib/server/memberships";
import { uz } from "@/lib/uz";
import { type Employee, employeeRecords, listEmployees } from "./data";

/*
 * Xodim davomatini belgilash (ADR 0014). Eski tizimda bu sahifada belgilab bo'lmas edi va belgisi yo'q xodim
 * "Kelgan" ko'rinar edi; bu yerda belgisiz xodim — "Belgilanmagan".
 */

const FEATURE = "attendance";
const PERM = "attendance.employee_mark";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PATH = "/staff-attendance";

const personWhere = (e: Employee, date: string) =>
  and(
    e.kind === "user" ? eq(employeeAttendance.userId, e.id) : eq(employeeAttendance.teacherId, e.id),
    eq(employeeAttendance.date, date),
  );

async function employeesInScope(ctx: ActionCtx) {
  return listEmployees(ctx.db, ctx.staff, ctx.branch.filter);
}

export async function markEmployeeAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, PERM, async (ctx) => {
    const parsed = z
      .object({
        key: z.string().regex(/^[ut]:[0-9a-f-]{36}$/),
        date: day,
        /** null — belgini olib tashlash */
        status: z.enum(EMPLOYEE_ATTENDANCE_STATUSES).nullable(),
        checkIn: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable()
          .default(null),
        note: z.string().trim().max(500).default(""),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const v = parsed.data;
    if (v.date > todayTashkent()) return { ok: false, error: uz.staffAttendance.future };
    const person = (await employeesInScope(ctx)).find((e) => e.key === v.key);
    if (!person) return { ok: false, error: uz.common.gone };

    const [before] = await ctx.db.select().from(employeeAttendance).where(personWhere(person, v.date));
    // Kelgan vaqt faqat kelgan/kechikkan uchun
    const checkIn = v.status === "absent" ? null : v.checkIn;
    const note = v.note || null;
    if (v.status === null) {
      if (!before) return { ok: true };
      await ctx.db.delete(employeeAttendance).where(eq(employeeAttendance.id, before.id));
    } else if (before) {
      if (before.status === v.status && before.checkIn === checkIn && before.note === note) return { ok: true };
      await ctx.db
        .update(employeeAttendance)
        .set({ status: v.status, checkIn, note, markedBy: ctx.staff.id, markedAt: new Date() })
        .where(eq(employeeAttendance.id, before.id));
    } else {
      await ctx.db.insert(employeeAttendance).values({
        userId: person.kind === "user" ? person.id : null,
        teacherId: person.kind === "teacher" ? person.id : null,
        date: v.date,
        status: v.status,
        checkIn,
        note,
        markedBy: ctx.staff.id,
      });
    }
    await ctx.audit(
      "employee_attendance.mark",
      { type: person.kind === "user" ? "user" : "teacher", id: person.id },
      {
        name: person.name,
        date: v.date,
        from: before?.status ?? null,
        to: v.status,
      },
    );
    revalidatePath(PATH);
    return { ok: true };
  });
}

/** Belgilanmagan xodimlarni "Kelgan" qilish — mavjud belgilar o'zgarmaydi */
export async function markEmployeesPresentAction(input: unknown): Promise<ActionResult<{ marked: number }>> {
  return crmAction<{ marked: number }>(FEATURE, PERM, async (ctx) => {
    const parsed = z.object({ date: day }).safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const { date } = parsed.data;
    if (date > todayTashkent()) return { ok: false, error: uz.staffAttendance.future };
    const [people, existing] = await Promise.all([employeesInScope(ctx), employeeRecords(ctx.db, date, date)]);
    const marked = new Set(existing.map((r) => r.key));
    const targets = people.filter((p) => !marked.has(p.key));
    if (!targets.length) return { ok: true, marked: 0 };
    await ctx.db
      .insert(employeeAttendance)
      .values(
        targets.map((p) => ({
          userId: p.kind === "user" ? p.id : null,
          teacherId: p.kind === "teacher" ? p.id : null,
          date,
          status: "present" as const,
          markedBy: ctx.staff.id,
        })),
      )
      .onConflictDoNothing();
    await ctx.audit("employee_attendance.mark_all", { type: "date", id: date }, { marked: targets.length });
    revalidatePath(PATH);
    return { ok: true, marked: targets.length };
  });
}
