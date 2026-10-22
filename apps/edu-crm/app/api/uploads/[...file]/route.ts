import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { getMimeType, getUploadsDir } from "@/lib/server/uploads";
import { currentTenant } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

/*
 * Yuklangan fayllarni o'qish / ko'rsatish / yuklab olish (streaming API).
 * Qat'iy Multi-tenant izolyatsiyasi: har bir markaz faqat o'z fayllarini ko'ra oladi.
 * Muallif / Agent: Google Gemini
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file: string[] }> },
) {
  const { file } = await params;
  const relativePath = file.join("/");

  // Directory traversal himoyasi
  if (relativePath.includes("..") || path.isAbsolute(relativePath)) {
    return new NextResponse("Noto'g'ri fayl yo'li", { status: 400 });
  }

  const tenant = await currentTenant();
  const uploadsDir = getUploadsDir();

  // Multi-tenant izolyatsiyasi:
  // Agar yo'lda mijoz slug'i berilgan bo'lsa (masalan /api/uploads/bilim/photo.jpg),
  // joriy so'rov domeni aynan shu mijozga tegishli bo'lishi shart!
  if (tenant && file.length > 1) {
    const requestedSlug = file[0];
    if (requestedSlug !== tenant.slug) {
      // Begona markaz faylini ochishga urinish — bloklanadi
      return new NextResponse("Fayl topilmadi", { status: 404 });
    }
  }

  let filePath = path.join(uploadsDir, relativePath);

  // Agar bitta nom bilan chaqirilgan bo'lsa (/api/uploads/file.pdf)
  if (!fs.existsSync(filePath) && file.length === 1 && tenant) {
    // Faqat joriy mijozning o'z papkasidan qidirish (begona markaz papkalariga kirmaydi)
    const tenantSpecific = path.join(uploadsDir, tenant.slug, file[0]!);
    if (fs.existsSync(tenantSpecific)) {
      filePath = tenantSpecific;
    }
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Fayl topilmadi", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return new NextResponse("Noto'g'ri fayl", { status: 400 });
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
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(filePath))}"`,
    },
  });
}
