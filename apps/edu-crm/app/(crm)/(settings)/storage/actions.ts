"use server";

import { revalidatePath } from "next/cache";
import { canAny } from "@ventura/auth/staff/policy";
import { pagePermissions } from "@/lib/access";
import { getTenantDb } from "@/lib/server/deps";
import { requireStaff, requireTenant } from "@/lib/server/session";
import {
  type CleanupFilter,
  deleteSingleFile,
  executeCleanup,
  getCleanupEstimate,
} from "@/lib/server/storage";
import { putSetting } from "@/lib/server/center";

/*
 * Xotira va fayllarni tozalash amallari (Server Actions).
 * Muallif / Agent: Google Gemini
 */

async function ensureStorageAccess() {
  const staff = await requireStaff();
  const tenant = await requireTenant();
  const allowed = staff.director || canAny(staff.access, pagePermissions("/storage"));
  if (!allowed) {
    throw new Error("Xotira sozlamalarini boshqarish uchun ruxsat yetarli emas");
  }
  const db = getTenantDb(tenant);
  return { staff, tenant, db };
}

/** Tozalash bo'yicha taxminiy ma'lumotni hisoblash */
export async function getCleanupEstimateAction(filter: CleanupFilter) {
  try {
    const { tenant, db } = await ensureStorageAccess();
    const result = await getCleanupEstimate(tenant, db, filter);
    return { ok: true as const, ...result };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Hisoblashda xatolik";
    return { ok: false as const, error };
  }
}

/** Tanlangan tozalash amalini bajarish */
export async function executeCleanupAction(filter: CleanupFilter) {
  try {
    const { staff, tenant, db } = await ensureStorageAccess();
    const result = await executeCleanup(tenant, db, { id: staff.id, name: staff.name }, filter);

    revalidatePath("/storage");
    revalidatePath("/settings");
    revalidatePath("/kabinet/uy-ishi");
    revalidatePath("/portal/uy-ishi");

    return { ok: true as const, filesDeleted: result.filesDeleted, bytesFreed: result.bytesFreed };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Tozalashda xatolik yuz berdi";
    return { ok: false as const, error };
  }
}

/** Alohida bitta faylni o'chirish */
export async function deleteSingleFileAction(fileUrl: string) {
  try {
    const { staff, tenant, db } = await ensureStorageAccess();
    const result = await deleteSingleFile(tenant, db, { id: staff.id, name: staff.name }, fileUrl);

    if (result.ok) {
      revalidatePath("/storage");
      revalidatePath("/kabinet/uy-ishi");
      revalidatePath("/portal/uy-ishi");
    }

    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : "Faylni o'chirishda xatolik yuz berdi";
    return { ok: false, error };
  }
}

/** Xotira limitini qo'lda o'zgartirish (faqat direktor uchun) */
export async function updateStorageLimitSettingAction(limitGb: number) {
  try {
    const { staff, db } = await ensureStorageAccess();
    if (!staff.director) {
      return { ok: false, error: "Limitni faqat direktor o'zgartira oladi" };
    }

    const limitMb = Math.max(100, Math.round(limitGb * 1024));
    await putSetting(db, "storage_limit", { limitMb, limitGb }, staff.id);

    revalidatePath("/storage");
    return { ok: true as const };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Limitni saqlashda xatolik";
    return { ok: false, error };
  }
}
