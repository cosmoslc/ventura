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

export function getUploadsDir(): string {
  const custom = process.env.VENTURA_UPLOADS_DIR;
  if (custom) {
    if (!fs.existsSync(custom)) fs.mkdirSync(custom, { recursive: true });
    return custom;
  }

  const shared = "/home/deploy/apps/edu-crm/shared/uploads";
  if (fs.existsSync("/home/deploy/apps/edu-crm/shared")) {
    try {
      if (!fs.existsSync(shared)) fs.mkdirSync(shared, { recursive: true });
      return shared;
    } catch {
      // ruxsat bo'lmasa quyidagi zaxira papkaga o'tadi
    }
  }

  const local = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(local)) fs.mkdirSync(local, { recursive: true });
  return local;
}

export function sanitizeFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
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
