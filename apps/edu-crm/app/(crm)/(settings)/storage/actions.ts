"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canAny } from "@ventura/auth/staff/policy";
import { pagePermissions } from "@/lib/access";
import { getTenantDb } from "@/lib/server/deps";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { type CleanupFilter, deleteSingleFile, executeCleanup, getCleanupEstimate } from "@/lib/server/storage";
import { uz } from "@/lib/uz";

/*
 * Xotira va fayllarni tozalash amallari (Server Actions).
 * Muallif / Agent: Google Gemini
 */

const cleanupFilterSchema: z.ZodType<CleanupFilter> = z.enum(["1m", "3m", "4m", "6m", "all_submissions", "orphans"]);

async function ensureStorageAccess() {
  const staff = await requireStaff();
  const tenant = await requireTenant();
  const allowed = staff.director || canAny(staff.access, pagePermissions("/storage"));
  if (!allowed) {
    throw new Error(uz.storage.xotiraSozlamalariniBoshqarishUchun);
  }
  const db = getTenantDb(tenant);
  return { staff, tenant, db };
}

/** Tozalash bo'yicha taxminiy ma'lumotni hisoblash */
export async function getCleanupEstimateAction(input: unknown) {
  try {
    const filter = cleanupFilterSchema.parse(input);
    const { tenant, db } = await ensureStorageAccess();
    const result = await getCleanupEstimate(tenant, db, filter);
    return { ok: true as const, ...result };
  } catch (e) {
    const error = e instanceof Error ? e.message : uz.storage.hisoblashdaXatolik;
    return { ok: false as const, error };
  }
}

/** Tanlangan tozalash amalini bajarish */
export async function executeCleanupAction(input: unknown) {
  try {
    const filter = cleanupFilterSchema.parse(input);
    const { staff, tenant, db } = await ensureStorageAccess();
    const result = await executeCleanup(tenant, db, { id: staff.id, name: staff.name }, filter);

    revalidatePath("/storage");
    revalidatePath("/settings");
    revalidatePath("/kabinet/uy-ishi");
    revalidatePath("/portal/uy-ishi");

    return { ok: true as const, filesDeleted: result.filesDeleted, bytesFreed: result.bytesFreed };
  } catch (e) {
    const error = e instanceof Error ? e.message : uz.storage.tozalashdaXatolikYuzBerdi;
    return { ok: false as const, error };
  }
}

/** Alohida bitta faylni o'chirish */
export async function deleteSingleFileAction(input: unknown) {
  try {
    const fileUrl = z
      .string()
      .max(512)
      .regex(/^\/api\/uploads\//)
      .parse(input);
    const { staff, tenant, db } = await ensureStorageAccess();
    const result = await deleteSingleFile(tenant, db, { id: staff.id, name: staff.name }, fileUrl);

    if (result.ok) {
      revalidatePath("/storage");
      revalidatePath("/kabinet/uy-ishi");
      revalidatePath("/portal/uy-ishi");
    }

    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : uz.storage.faylniOchirishdaXatolikYuz;
    return { ok: false, error };
  }
}
