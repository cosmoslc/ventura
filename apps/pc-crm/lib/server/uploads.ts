import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function getUploadsDir(): string {
  const custom = process.env.VENTURA_PC_UPLOADS_DIR;
  const baseDir = custom || path.join(process.cwd(), "public", "uploads");

  if (!fs.existsSync(baseDir)) {
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  return baseDir;
}

export function sanitizeFilename(originalName: string, forcedExt?: string): string {
  const ext = (forcedExt || path.extname(originalName) || ".webp").toLowerCase();
  const rawBase = path.basename(originalName, path.extname(originalName));
  const cleanBase = rawBase.replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, "_").slice(0, 40) || "product";
  const unique = randomUUID().slice(0, 8);
  return `${Date.now()}_${unique}_${cleanBase}${ext}`;
}

export const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

export async function saveUploadedBuffer(
  buffer: Buffer,
  originalName: string,
  forcedExt?: string,
): Promise<{ url: string; filename: string; size: number }> {
  const uploadsDir = getUploadsDir();
  const filename = sanitizeFilename(originalName, forcedExt);
  const filePath = path.join(uploadsDir, filename);

  await fs.promises.writeFile(filePath, buffer);

  return {
    url: `/uploads/${filename}`,
    filename,
    size: buffer.length,
  };
}

export async function saveBase64Image(
  dataUrl: string,
  preferredName = "product-clean.webp",
): Promise<{ url: string; filename: string; size: number }> {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Noto'g'ri Base64 rasm formati");
  }

  const rawExt = match[1]?.toLowerCase() === "jpeg" ? ".jpg" : `.${match[1]}`;
  const base64Data = match[2];
  if (!base64Data) {
    throw new Error("Bo'sh Base64 rasm ma'lumoti");
  }
  const buffer = Buffer.from(base64Data, "base64");

  return saveUploadedBuffer(buffer, preferredName, rawExt);
}
