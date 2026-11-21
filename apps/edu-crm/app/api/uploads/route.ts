import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getMimeType, getUploadsDir, sanitizeFilename } from "@/lib/server/uploads";
import { currentTenant } from "@/lib/server/tenant";
import { getTenantDb } from "@/lib/server/deps";
import { getStaff } from "@/lib/server/session";
import { getStorageStats } from "@/lib/server/storage";
import { uz } from "@/lib/uz";

export const dynamic = "force-dynamic";

/*
 * Fayl yuklash (faqat autentifikatsiyalangan sessiya, maksimal 25MB va limit tekshiruvi bilan).
 * Muallif / Agent: Google Gemini
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await currentTenant();
    if (!tenant) {
      return NextResponse.json({ ok: false, error: uz.uploads.tizimTopilmadi }, { status: 404 });
    }

    const staff = await getStaff();
    if (!staff || staff.state !== "ok") {
      return NextResponse.json({ ok: false, error: uz.uploads.ruxsatBerilmagan }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: uz.uploads.faylYuborilmadi }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: uz.uploads.faylHajmi25Mb }, { status: 400 });
    }

    try {
      const db = getTenantDb(tenant);
      const stats = await getStorageStats(tenant, db);
      if (stats.usedBytes + file.size > stats.limitBytes) {
        return NextResponse.json(
          {
            ok: false,
            error: uz.uploads.storageFull(stats.limitMb),
          },
          { status: 400 },
        );
      }
    } catch (err) {
      console.error("[POST /api/uploads] xotira tekshiruvida xatolik:", err);
    }

    const savedName = sanitizeFilename(file.name);
    const uploadsDir = getUploadsDir(tenant.slug);
    const filePath = path.join(uploadsDir, savedName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    const mimeType = file.type || getMimeType(file.name);
    const url = `/api/uploads/${tenant.slug}/${savedName}`;

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
    const message = e instanceof Error ? e.message : uz.uploads.faylYuklashdaXatolikYuz;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
