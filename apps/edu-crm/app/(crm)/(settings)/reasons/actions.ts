"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Permission } from "@ventura/auth/staff/policy";
import { settings } from "@ventura/db/schema/tenant";
import {
  REASON_CATEGORIES,
  REASON_CATEGORY_IDS,
  REASON_SWITCHES_KEY,
  type ReasonsConfig,
  parseSwitches,
} from "@/lib/reasons";
import { reasonListInput } from "@/lib/rules";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { getReasonsConfig } from "@/lib/server/reasons";
import { uz } from "@/lib/uz";

/*
 * Sabablar sahifasi (ADR 0035). Ro'yxatni va yoqgichni o'zgartirish — shu tur tegishli bo'limning tahrirlash ruxsati
 * bilan (o'quvchi — students.edit, guruh — groups.edit, lid — leads.edit). O'qish dialoglar uchun: bu amallardan
 * birortasini qila oladigan xodimga.
 */

const FEATURE = "students";

/** Sabab so'raladigan amallarning ruxsatlari: dialoglar ro'yxatni shular bilan o'qiydi */
const READ_PERMISSIONS: readonly Permission[] = [
  "students.edit",
  "students.delete",
  "students.freeze",
  "groups.edit",
  "groups.delete",
  "groups.remove_student",
  "leads.edit",
  "leads.delete",
];

const categoryId = z.enum(REASON_CATEGORY_IDS);

/** Dialoglar uchun: hamma ro'yxat va yoqgichlar (dialog ochilganda bir marta o'qiladi) */
export async function reasonsConfigAction(): Promise<ActionResult<{ config: ReasonsConfig }>> {
  return crmAction<{ config: ReasonsConfig }>(FEATURE, READ_PERMISSIONS, async (ctx) => ({
    ok: true,
    config: await getReasonsConfig(ctx.db),
  }));
}

async function upsert(ctx: ActionCtx, key: string, value: unknown) {
  await ctx.db
    .insert(settings)
    .values({ key, value, updatedBy: ctx.staff.id })
    .onConflictDoUpdate({
      target: [settings.tenantId, settings.key],
      set: { value, updatedBy: ctx.staff.id, updatedAt: new Date() },
    });
}

/** Bitta tur ro'yxatini saqlash; eski yozuvlardagi sabablar o'zgarmaydi */
export async function saveReasonListAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, READ_PERMISSIONS, async (ctx) => {
    const parsed = z.object({ category: categoryId, list: reasonListInput }).safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const cat = REASON_CATEGORIES[parsed.data.category];
    const gate = await ctx.requireAny([cat.permission]);
    if (gate) return gate;
    const list = [...new Set(parsed.data.list)];
    await upsert(ctx, cat.key, list);
    await ctx.audit("settings.update", { type: "setting", id: cat.key }, { reasons: list });
    revalidatePath("/reasons");
    revalidatePath("/reports/leaves");
    return { ok: true };
  });
}

/** "Sabab so'ralsinmi" yoqgichi (faqat yoqgichi bor turlar) */
export async function saveReasonSwitchAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, READ_PERMISSIONS, async (ctx) => {
    const parsed = z.object({ category: categoryId, enabled: z.boolean() }).safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const cat = REASON_CATEGORIES[parsed.data.category];
    if (!cat.switchable) return { ok: false, error: uz.common.invalid };
    const gate = await ctx.requireAny([cat.permission]);
    if (gate) return gate;
    const current = (await getReasonsConfig(ctx.db)).switches;
    const next = parseSwitches({ ...current, [cat.id]: parsed.data.enabled });
    await upsert(ctx, REASON_SWITCHES_KEY, next);
    await ctx.audit("settings.update", { type: "setting", id: REASON_SWITCHES_KEY }, { [cat.id]: parsed.data.enabled });
    revalidatePath("/reasons");
    return { ok: true };
  });
}
