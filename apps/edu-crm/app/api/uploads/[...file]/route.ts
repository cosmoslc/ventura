import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { getMimeType, getUploadsDir } from "@/lib/server/uploads";
import { getStaff } from "@/lib/server/session";
import { currentTenant } from "@/lib/server/tenant";
import { uz } from "@/lib/uz";

export const dynamic = "force-dynamic";

/** Brauzerda ochiladigan xavfsiz turlar; qolgani (svg, html, office...) yuklab olinadi */
const INLINE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "video/mp4",
]);

/*
 * Yuklangan fayllarni o'qish / ko'rsatish / yuklab olish (streaming API).
 * Qat'iy Multi-tenant izolyatsiyasi: har bir markaz faqat o'z fayllarini ko'ra oladi.
 * Muallif / Agent: Google Gemini
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ file: string[] }> }) {
  const { file } = await params;

  // Directory traversal himoyasi
  if (
    !file ||
    file.length === 0 ||
    file.some(
      (segment) => segment.includes("..") || segment.includes("/") || segment.includes("\\") || segment.includes("\0"),
    )
  ) {
    return new NextResponse(uz.uploads.notogriFaylYoli, { status: 400 });
  }

  const relativePath = file.join("/");
  if (path.isAbsolute(relativePath)) {
    return new NextResponse(uz.uploads.notogriFaylYoli, { status: 400 });
  }

  const tenant = await currentTenant();
  if (!tenant) {
    return new NextResponse(uz.uploads.faylTopilmadi, { status: 404 });
  }

  // Fayllar (uy vazifalari, javoblar) shaxsiy: faqat shu markazga kirgan foydalanuvchi ochadi
  const viewer = await getStaff();
  if (!viewer || viewer.state !== "ok") {
    return new NextResponse(uz.uploads.ruxsatBerilmagan, { status: 401 });
  }

  // Multi-tenant izolyatsiyasi:
  // Fayl yo'lining birinchi segmenti qat'iy joriy mijoz (tenant.slug) ga mos kelishi shart.
  if (file.length < 2 || file[0] !== tenant.slug) {
    return new NextResponse(uz.uploads.faylTopilmadi, { status: 404 });
  }

  const uploadsDir = getUploadsDir();
  const safeBase = path.resolve(uploadsDir, tenant.slug);
  const filePath = path.resolve(uploadsDir, ...file);

  if (!filePath.startsWith(safeBase + path.sep)) {
    return new NextResponse(uz.uploads.notogriFaylYoli, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse(uz.uploads.faylTopilmadi, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return new NextResponse(uz.uploads.notogriFayl, { status: 400 });
  }

  const mimeType = getMimeType(filePath);
  const stream = fs.createReadStream(filePath);
  // Node stream'ni web ReadableStream'ga o'tkazamiz
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=31536000, immutable",
      // Yuklangan fayl skript ishga tushira olmasin (SVG/HTML orqali XSS)
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${INLINE_TYPES.has(mimeType) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`,
    },
  });
}
