import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { getMimeType, getUploadsDir } from "@/lib/server/uploads";

export const dynamic = "force-dynamic";

/*
 * Yuklangan fayllarni o'qish / ko'rsatish / yuklab olish (streaming API).
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

  const uploadsDir = getUploadsDir();
  let filePath = path.join(uploadsDir, relativePath);

  if (!fs.existsSync(filePath)) {
    // Agar to'g'ridan-to'g'ri topilmasa va bitta nom bo'lsa, mijoz ichki papkalaridan qidiramiz
    if (!relativePath.includes("/")) {
      try {
        const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const sub = path.join(uploadsDir, entry.name, relativePath);
            if (fs.existsSync(sub)) {
              filePath = sub;
              break;
            }
          }
        }
      } catch {
        // ignore
      }
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
