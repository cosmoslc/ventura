import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getMimeType, getUploadsDir, sanitizeFilename } from "@/lib/server/uploads";
import { currentTenant } from "@/lib/server/tenant";
import { getTenantDb } from "@/lib/server/deps";
import { getStorageStats } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/*
 * Fayl yuklash (maksimal 25MB va limit tekshiruvi bilan).
 * Muallif / Agent: Google Gemini
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Fayl yuborilmadi" }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "Fayl hajmi 25 MB dan oshmasligi kerak" },
        { status: 400 },
      );
    }

    const tenant = await currentTenant();
    if (tenant) {
      try {
        const db = getTenantDb(tenant);
        const stats = await getStorageStats(tenant, db);
        if (stats.usedBytes + file.size > stats.limitBytes) {
          return NextResponse.json(
            {
              ok: false,
              error: `Xotira to'ldi. Markaz uchun ajratilgan limit (${stats.limitMb} MB) to'lgan. Keraksiz fayllarni o'chiring yoki limitni oshiring.`,
            },
            { status: 400 },
          );
        }
      } catch (err) {
        console.error("[POST /api/uploads] xotira tekshiruvida xatolik:", err);
      }
    }

    const savedName = sanitizeFilename(file.name);
    const uploadsDir = getUploadsDir(tenant?.slug);
    const filePath = path.join(uploadsDir, savedName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    const mimeType = file.type || getMimeType(file.name);
    const url = tenant?.slug ? `/api/uploads/${tenant.slug}/${savedName}` : `/api/uploads/${savedName}`;

    return NextResponse.json({
      ok: true,
      file: {
        id: randomUUID(),
        name: file.name,
        url,
        size: file.size,
        mimeType,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fayl yuklashda xatolik yuz berdi";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
