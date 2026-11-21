import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { type HomeworkAttachment, groupHomeworks, homeworkSubmissions, settings } from "@ventura/db/schema/tenant";
import { tenantAudit } from "@ventura/security";
import type { Tenant } from "@ventura/tenants";
import { deleteUploadedFile, scanTenantDiskFiles } from "./uploads";

/*
 * Xotira va fayllarni boshqarish xizmati.
 * O'quv markazi uchun ajratilgan limit (boshqaruv panelidan / tarifdan), ishlatilgan hajm,
 * toifalar bo'yicha taqsimot va muddat bo'yicha tozalash (1, 3, 4, 6 oylik).
 * Muallif / Agent: Google Gemini
 */

export interface StorageCategoryStats {
  filesCount: number;
  bytes: number;
}

export interface StorageFileRecord {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  category: "homework_teacher" | "homework_submission" | "other";
  sourceTitle: string;
  createdAt: string; // ISO format
  ageDays: number;
}

export interface StorageStats {
  limitMb: number;
  limitBytes: number;
  usedBytes: number;
  usedMb: number;
  freeBytes: number;
  freeMb: number;
  percentUsed: number;
  totalFiles: number;
  categories: {
    homeworkTeacher: StorageCategoryStats;
    homeworkSubmissions: StorageCategoryStats;
    other: StorageCategoryStats;
  };
  recentFiles: StorageFileRecord[];
}

export type CleanupFilter = "1m" | "3m" | "4m" | "6m" | "all_submissions" | "orphans";

const FILTER_DAYS: Record<string, number> = {
  "1m": 30,
  "3m": 90,
  "4m": 120,
  "6m": 180,
};

/** Markaz uchun belgilangan xotira limitini (MB da) aniqlaydi */
export async function getTenantStorageLimitMb(tenant: Tenant, db: TenantDb): Promise<number> {
  // 1. Agar tenants.json da berilgan bo'lsa
  if (typeof tenant.storageLimitMb === "number" && tenant.storageLimitMb > 0) {
    return tenant.storageLimitMb;
  }

  // 2. Bazadagi settings jadvalidan tekshirish
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "storage_limit"))
      .limit(1);
    if (row?.value && typeof row.value === "object" && "limitMb" in row.value) {
      const val = Number((row.value as Record<string, unknown>).limitMb);
      if (val > 0) return val;
    }
  } catch {
    // ignore
  }

  // 3. Standart 5 GB = 5120 MB
  return 5120;
}

/** Markaz xotira statistikasini to'liq hisoblaydi */
export async function getStorageStats(tenant: Tenant, db: TenantDb): Promise<StorageStats> {
  const limitMb = await getTenantStorageLimitMb(tenant, db);
  const limitBytes = limitMb * 1024 * 1024;
  const now = Date.now();

  const fileMap = new Map<string, StorageFileRecord>();
  let teacherBytes = 0;
  let teacherCount = 0;
  let submissionsBytes = 0;
  let submissionsCount = 0;

  // 1. O'qituvchilar yuklagan vazifa fayllari
  const hwRows = await db
    .select({
      id: groupHomeworks.id,
      title: groupHomeworks.title,
      attachments: groupHomeworks.attachments,
      createdAt: groupHomeworks.createdAt,
    })
    .from(groupHomeworks)
    .where(eq(groupHomeworks.tenantId, tenant.slug))
    .orderBy(desc(groupHomeworks.createdAt));

  for (const row of hwRows) {
    const createdTime = row.createdAt ? new Date(row.createdAt).getTime() : now;
    const ageDays = Math.max(0, Math.floor((now - createdTime) / (1000 * 60 * 60 * 24)));
    const dateIso = row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString();

    for (const att of row.attachments || []) {
      if (!att.url) continue;
      teacherBytes += att.size || 0;
      teacherCount++;
      fileMap.set(att.url, {
        id: att.id || att.url,
        name: att.name || "Fayl",
        url: att.url,
        size: att.size || 0,
        mimeType: att.mimeType || "application/octet-stream",
        category: "homework_teacher",
        sourceTitle: `Uy vazifasi: ${row.title || "Vazifa"}`,
        createdAt: dateIso,
        ageDays,
      });
    }
  }

  // 2. O'quvchilar topshirgan javob fayllari
  const subRows = await db
    .select({
      id: homeworkSubmissions.id,
      homeworkId: homeworkSubmissions.homeworkId,
      attachments: homeworkSubmissions.attachments,
      createdAt: homeworkSubmissions.createdAt,
    })
    .from(homeworkSubmissions)
    .where(eq(homeworkSubmissions.tenantId, tenant.slug))
    .orderBy(desc(homeworkSubmissions.createdAt));

  for (const row of subRows) {
    const createdTime = row.createdAt ? new Date(row.createdAt).getTime() : now;
    const ageDays = Math.max(0, Math.floor((now - createdTime) / (1000 * 60 * 60 * 24)));
    const dateIso = row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString();

    for (const att of row.attachments || []) {
      if (!att.url) continue;
      submissionsBytes += att.size || 0;
      submissionsCount++;
      fileMap.set(att.url, {
        id: att.id || att.url,
        name: att.name || "Javob fayli",
        url: att.url,
        size: att.size || 0,
        mimeType: att.mimeType || "application/octet-stream",
        category: "homework_submission",
        sourceTitle: "O'quvchi javobi",
        createdAt: dateIso,
        ageDays,
      });
    }
  }

  // 3. Diskdagi boshqa fayllar (DB da ro'yxatga kirmagan yoki yetim fayllar)
  let otherBytes = 0;
  let otherCount = 0;
  const diskFiles = scanTenantDiskFiles(tenant.slug);
  for (const df of diskFiles) {
    // Agar DB da topilmasa
    if (!fileMap.has(df.url) && !fileMap.has(`/api/uploads/${df.filename}`)) {
      otherBytes += df.size;
      otherCount++;
      const ageDays = Math.max(0, Math.floor((now - df.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
      fileMap.set(df.url, {
        id: df.url,
        name: df.filename,
        url: df.url,
        size: df.size,
        mimeType: "application/octet-stream",
        category: "other",
        sourceTitle: "Umumiy / Zaxira fayl",
        createdAt: df.createdAt.toISOString(),
        ageDays,
      });
    }
  }

  const allFiles = Array.from(fileMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const usedBytes = teacherBytes + submissionsBytes + otherBytes;
  const usedMb = Math.round((usedBytes / (1024 * 1024)) * 10) / 10;
  const freeBytes = Math.max(0, limitBytes - usedBytes);
  const freeMb = Math.round((freeBytes / (1024 * 1024)) * 10) / 10;
  const percentUsed = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10) : 0;

  return {
    limitMb,
    limitBytes,
    usedBytes,
    usedMb,
    freeBytes,
    freeMb,
    percentUsed,
    totalFiles: allFiles.length,
    categories: {
      homeworkTeacher: { filesCount: teacherCount, bytes: teacherBytes },
      homeworkSubmissions: { filesCount: submissionsCount, bytes: submissionsBytes },
      other: { filesCount: otherCount, bytes: otherBytes },
    },
    recentFiles: allFiles.slice(0, 100),
  };
}

/** Tozalash amali oldidan taxminiy o'chiriladigan fayllar soni va hajmini hisoblaydi */
export async function getCleanupEstimate(
  tenant: Tenant,
  db: TenantDb,
  filter: CleanupFilter,
): Promise<{ filesCount: number; bytes: number; label: string }> {
  const stats = await getStorageStats(tenant, db);
  let matchingFiles = stats.recentFiles;

  let label = "";
  if (filter in FILTER_DAYS) {
    const days = FILTER_DAYS[filter]!;
    matchingFiles = matchingFiles.filter((f) => f.ageDays >= days);
    label = `${filter.replace("m", "")} oydan eski barcha fayllar`;
  } else if (filter === "all_submissions") {
    matchingFiles = matchingFiles.filter((f) => f.category === "homework_submission");
    label = "Barcha o'quvchi javob fayllari";
  } else if (filter === "orphans") {
    matchingFiles = matchingFiles.filter((f) => f.category === "other");
    label = "Bog'lanmagan (yetim) fayllar";
  }

  const filesCount = matchingFiles.length;
  const bytes = matchingFiles.reduce((acc, f) => acc + f.size, 0);

  return { filesCount, bytes, label };
}

/** Tozalash amalini bajaradi */
export async function executeCleanup(
  tenant: Tenant,
  db: TenantDb,
  actor: { id: string; name: string },
  filter: CleanupFilter,
): Promise<{ ok: boolean; filesDeleted: number; bytesFreed: number }> {
  const stats = await getStorageStats(tenant, db);
  let targetFiles = stats.recentFiles;

  if (filter in FILTER_DAYS) {
    const days = FILTER_DAYS[filter]!;
    targetFiles = targetFiles.filter((f) => f.ageDays >= days);
  } else if (filter === "all_submissions") {
    targetFiles = targetFiles.filter((f) => f.category === "homework_submission");
  } else if (filter === "orphans") {
    targetFiles = targetFiles.filter((f) => f.category === "other");
  }

  if (targetFiles.length === 0) {
    return { ok: true, filesDeleted: 0, bytesFreed: 0 };
  }

  const urlsToDelete = new Set(targetFiles.map((f) => f.url));
  let bytesFreed = 0;
  let filesDeleted = 0;

  // 1. Diskdan fayllarni o'chirish
  for (const f of targetFiles) {
    const deleted = deleteUploadedFile(f.url, tenant.slug);
    if (deleted) {
      bytesFreed += f.size;
      filesDeleted++;
    } else {
      // Diskda topilmasa ham DB dan tozalab hisobga kiritamiz
      bytesFreed += f.size;
      filesDeleted++;
    }
  }

  // 2. DB dagi groupHomeworks attachments larini tozalash
  const hwRows = await db
    .select({ id: groupHomeworks.id, attachments: groupHomeworks.attachments })
    .from(groupHomeworks)
    .where(eq(groupHomeworks.tenantId, tenant.slug));

  for (const row of hwRows) {
    if (!row.attachments || row.attachments.length === 0) continue;
    const remaining = (row.attachments as HomeworkAttachment[]).filter(
      (a: HomeworkAttachment) => !urlsToDelete.has(a.url),
    );
    if (remaining.length !== row.attachments.length) {
      await db
        .update(groupHomeworks)
        .set({ attachments: remaining, updatedAt: new Date() })
        .where(and(eq(groupHomeworks.tenantId, tenant.slug), eq(groupHomeworks.id, row.id)));
    }
  }

  // 3. DB dagi homeworkSubmissions attachments larini tozalash
  const subRows = await db
    .select({ id: homeworkSubmissions.id, attachments: homeworkSubmissions.attachments })
    .from(homeworkSubmissions)
    .where(eq(homeworkSubmissions.tenantId, tenant.slug));

  for (const row of subRows) {
    if (!row.attachments || row.attachments.length === 0) continue;
    const remaining = (row.attachments as HomeworkAttachment[]).filter(
      (a: HomeworkAttachment) => !urlsToDelete.has(a.url),
    );
    if (remaining.length !== row.attachments.length) {
      await db
        .update(homeworkSubmissions)
        .set({ attachments: remaining, updatedAt: new Date() })
        .where(and(eq(homeworkSubmissions.tenantId, tenant.slug), eq(homeworkSubmissions.id, row.id)));
    }
  }

  // 4. Audit jurnaliga qayd etish
  await tenantAudit.record(db, {
    actor: { type: "user", id: actor.id, name: actor.name },
    action: "storage.cleanup",
    target: { type: "storage", id: tenant.slug },
    metadata: {
      filter,
      filesDeleted,
      bytesFreed,
      bytesFreedMb: Math.round((bytesFreed / (1024 * 1024)) * 10) / 10,
    },
  });

  return { ok: true, filesDeleted, bytesFreed };
}

/** Bitta faylni to'liq o'chiradi */
export async function deleteSingleFile(
  tenant: Tenant,
  db: TenantDb,
  actor: { id: string; name: string },
  fileUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    deleteUploadedFile(fileUrl, tenant.slug);

    // groupHomeworks attachments dan olib tashlash
    const hwRows = await db
      .select({ id: groupHomeworks.id, attachments: groupHomeworks.attachments })
      .from(groupHomeworks)
      .where(eq(groupHomeworks.tenantId, tenant.slug));

    for (const row of hwRows) {
      const atts = row.attachments as HomeworkAttachment[] | null;
      if (atts?.some((a: HomeworkAttachment) => a.url === fileUrl)) {
        const remaining = atts.filter((a: HomeworkAttachment) => a.url !== fileUrl);
        await db
          .update(groupHomeworks)
          .set({ attachments: remaining, updatedAt: new Date() })
          .where(and(eq(groupHomeworks.tenantId, tenant.slug), eq(groupHomeworks.id, row.id)));
      }
    }

    // homeworkSubmissions attachments dan olib tashlash
    const subRows = await db
      .select({ id: homeworkSubmissions.id, attachments: homeworkSubmissions.attachments })
      .from(homeworkSubmissions)
      .where(eq(homeworkSubmissions.tenantId, tenant.slug));

    for (const row of subRows) {
      const atts = row.attachments as HomeworkAttachment[] | null;
      if (atts?.some((a: HomeworkAttachment) => a.url === fileUrl)) {
        const remaining = atts.filter((a: HomeworkAttachment) => a.url !== fileUrl);
        await db
          .update(homeworkSubmissions)
          .set({ attachments: remaining, updatedAt: new Date() })
          .where(and(eq(homeworkSubmissions.tenantId, tenant.slug), eq(homeworkSubmissions.id, row.id)));
      }
    }

    await tenantAudit.record(db, {
      actor: { type: "user", id: actor.id, name: actor.name },
      action: "storage.file_delete",
      target: { type: "file", id: fileUrl },
      metadata: { fileUrl },
    });

    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Faylni o'chirishda xatolik";
    return { ok: false, error };
  }
}
