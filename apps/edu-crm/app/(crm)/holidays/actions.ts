"use server";

import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HOLIDAY_TYPES, attendance, groups, holidayBranches, holidays } from "@ventura/db/schema/tenant";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";
import { listHolidays } from "./data";

/*
 * Dam olish kunlari (EDU-CRM-PLAN E2, ADR 0014) — "Filiallarni boshqarish" ruxsati bilan (eski tizimdagidek).
 * Filial cheklovi bor xodim faqat o'z filiallariga tegishli bayramni boshqaradi; "barcha filiallar" — direktor.
 */

const FEATURE = "holidays";
const PERMISSION = "settings.branches";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const holidayInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, uz.holidays.nameRequired).max(120),
  startDate: day,
  days: z.number().int().min(1, uz.holidays.durationInvalid).max(60, uz.holidays.durationInvalid),
  type: z.enum(HOLIDAY_TYPES),
  affectsLessons: z.boolean(),
  /** bo'sh — barcha filiallar */
  branchIds: z.array(z.uuid()).max(100),
  note: z.string().trim().max(500).default(""),
});

const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd! + n)).toISOString().slice(0, 10);
};

/** Xodim shu filiallar to'plamini boshqara oladimi */
function canManage(ctx: ActionCtx, branchIds: readonly string[] | null) {
  if (ctx.staff.scope === "all") return true;
  if (!branchIds?.length) return false;
  return branchIds.every((b) => ctx.branch.options.some((o) => o.id === b));
}

/** "Ha" tanlangan bayram kunlarida allaqachon olingan davomat (bu darslar bekor bo'ladi) */
async function attendanceInRange(ctx: ActionCtx, from: string, to: string, branchIds: readonly string[] | null) {
  const [r] = await ctx.db
    .select({ n: count() })
    .from(attendance)
    .innerJoin(groups, eq(groups.id, attendance.groupId))
    .where(
      and(
        gte(attendance.date, from),
        lte(attendance.date, to),
        branchIds?.length ? inArray(groups.branchId, [...branchIds]) : undefined,
      ),
    );
  return r?.n ?? 0;
}

export async function saveHolidayAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>(FEATURE, PERMISSION, async (ctx) => {
    const parsed = holidayInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const branchIds = v.branchIds.length ? [...new Set(v.branchIds)] : null;
    if (!canManage(ctx, branchIds)) return { ok: false, error: uz.common.branchForbidden };
    const endDate = addDays(v.startDate, v.days - 1);

    let existing: Awaited<ReturnType<typeof listHolidays>>[number] | undefined;
    if (v.id) {
      existing = (await listHolidays(ctx.db, null)).find((h) => h.id === v.id);
      if (!existing) return { ok: false, error: uz.common.gone };
      if (!canManage(ctx, existing.branchIds)) return { ok: false, error: uz.common.branchForbidden };
    }
    // Darslarni bekor qiladigan bayram olingan davomat ustiga tushmasin (tarix buzilmaydi)
    if (v.affectsLessons) {
      const n = await attendanceInRange(ctx, v.startDate, endDate, branchIds);
      if (n > 0) return { ok: false, error: uz.holidays.attendanceExists(n) };
    }

    const values = {
      name: v.name,
      startDate: v.startDate,
      endDate,
      type: v.type,
      affectsLessons: v.affectsLessons,
      note: v.note || null,
    };
    const id = await ctx.db.transaction(async (tx) => {
      let hid = existing?.id;
      if (hid) {
        await tx.update(holidays).set(values).where(eq(holidays.id, hid));
        await tx.delete(holidayBranches).where(eq(holidayBranches.holidayId, hid));
      } else {
        const [row] = await tx
          .insert(holidays)
          .values({ ...values, createdBy: ctx.staff.id })
          .returning({ id: holidays.id });
        hid = row!.id;
      }
      if (branchIds)
        await tx.insert(holidayBranches).values(branchIds.map((branchId) => ({ holidayId: hid!, branchId })));
      return hid;
    });
    await ctx.audit(
      existing ? "holiday.update" : "holiday.create",
      { type: "holiday", id },
      {
        name: v.name,
        startDate: v.startDate,
        endDate,
        affectsLessons: v.affectsLessons,
        branches: branchIds ?? "all",
      },
    );
    revalidatePath("/holidays");
    revalidatePath("/attendance");
    return { ok: true, id };
  });
}

export async function deleteHolidayAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, PERMISSION, async (ctx) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const h = (await listHolidays(ctx.db, null)).find((x) => x.id === parsed.data);
    if (!h) return { ok: false, error: uz.common.gone };
    if (!canManage(ctx, h.branchIds)) return { ok: false, error: uz.common.branchForbidden };
    await ctx.db.delete(holidays).where(eq(holidays.id, h.id));
    await ctx.audit(
      "holiday.delete",
      { type: "holiday", id: h.id },
      {
        name: h.name,
        startDate: h.startDate,
        endDate: h.endDate,
      },
    );
    revalidatePath("/holidays");
    revalidatePath("/attendance");
    return { ok: true };
  });
}
