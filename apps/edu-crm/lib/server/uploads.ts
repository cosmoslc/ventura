import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/*
 * Fayllarni saqlash va boshqarish (ADR 0063 / Uy vazifalari).
 * Deploy qilingan serverda fayllar /home/deploy/apps/edu-crm/shared/uploads papkasida
 * relizlar almashganda ham saqlanib qoladi.
 * Muallif / Agent: Google Gemini
 */

export function getUploadsDir(tenantSlug?: string): string {
  const custom = process.env.VENTURA_UPLOADS_DIR;
  let baseDir: string;
  if (custom) {
    baseDir = custom;
  } else {
    const shared = "/home/deploy/apps/edu-crm/shared/uploads";
    if (fs.existsSync("/home/deploy/apps/edu-crm/shared")) {
      try {
        if (!fs.existsSync(shared)) fs.mkdirSync(shared, { recursive: true });
        baseDir = shared;
      } catch {
        baseDir = path.join(process.cwd(), "uploads");
      }
    } else {
      baseDir = path.join(process.cwd(), "uploads");
    }
  }

  if (!fs.existsSync(baseDir)) {
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  if (tenantSlug) {
    const safeSlug = tenantSlug.replace(/[^a-zA-Z0-9_\-]/g, "");
    const tenantDir = path.join(baseDir, safeSlug);
    if (!fs.existsSync(tenantDir)) {
      try {
        fs.mkdirSync(tenantDir, { recursive: true });
      } catch {
        // fallback to baseDir if failed
        return baseDir;
      }
    }
    return tenantDir;
  }

  return baseDir;
}

/** Berilgan manzil yoki nomdagi faylni diskdan xavfsiz o'chiradi (qat'iy multi-tenant tekshiruvi bilan) */
export function deleteUploadedFile(fileUrlOrName: string, tenantSlug?: string): boolean {
  try {
    const clean = fileUrlOrName.replace(/^\/api\/uploads\/?/, "");
    const parts = clean.split("/").filter(Boolean);
    const filename = parts[parts.length - 1];
    if (!filename) return false;

    // Traversal himoyasi
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return false;
    }

    const baseDir = getUploadsDir();

    // Multi-tenant izolyatsiyasi:
    // Agar tenantSlug berilgan bo'lsa, URL dagi papka aynan shu tenant bo'lishi shart
    if (tenantSlug) {
      if (parts.length !== 2 || parts[0] !== tenantSlug) {
        console.warn(`[deleteUploadedFile] Multi-tenant bloklandi: ${tenantSlug} boshqa mijoz (${parts[0]}) faylini o'chirishga urindi.`);
        return false;
      }

      // Faqat shu mijozning o'z papkasidan o'chirish
      const tenantFile = path.join(getUploadsDir(tenantSlug), filename);
      if (fs.existsSync(tenantFile)) {
        fs.unlinkSync(tenantFile);
        return true;
      }

      // Ildiz papkadagi (umumiy) fayllar hech qaysi mijozniki emas — o'chirilmaydi
      return false;
    }

    // tenantSlug berilmagan bo'lsa faqat ildizdan
    const directPath = path.join(baseDir, filename);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      fs.unlinkSync(directPath);
      return true;
    }

    return false;
  } catch (e) {
    console.error("[deleteUploadedFile] xatolik:", e);
    return false;
  }
}

export interface DiskFileInfo {
  filename: string;
  url: string;
  size: number;
  createdAt: Date;
}

/** Diskdagi mijoz fayllarini o'qiydi */
export function scanTenantDiskFiles(tenantSlug?: string): DiskFileInfo[] {
  const result: DiskFileInfo[] = [];
  try {
    const dir = getUploadsDir(tenantSlug);
    if (!fs.existsSync(dir)) return result;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(dir, entry.name);
      const stat = fs.statSync(fullPath);
      const url = tenantSlug ? `/api/uploads/${tenantSlug}/${entry.name}` : `/api/uploads/${entry.name}`;
      result.push({
        filename: entry.name,
        url,
        size: stat.size,
        createdAt: stat.birthtime || stat.mtime,
      });
    }
  } catch (e) {
    console.error("[scanTenantDiskFiles] xatolik:", e);
  }
  return result;
}

export function sanitizeFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 10);
  const rawBase = path.basename(originalName, ext);
  const cleanBase = rawBase.replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, "_").slice(0, 50) || "file";
  const unique = randomUUID().slice(0, 8);
  return `${Date.now()}_${unique}_${cleanBase}${ext}`;
}

export const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}
