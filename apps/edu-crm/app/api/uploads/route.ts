import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getMimeType, getUploadsDir, sanitizeFilename } from "@/lib/server/uploads";

export const dynamic = "force-dynamic";

/** Fayl yuklash (maksimal 25MB) */
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

    const savedName = sanitizeFilename(file.name);
    const uploadsDir = getUploadsDir();
    const filePath = path.join(uploadsDir, savedName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    const mimeType = file.type || getMimeType(file.name);

    return NextResponse.json({
      ok: true,
      file: {
        id: randomUUID(),
        name: file.name,
        url: `/api/uploads/${savedName}`,
        size: file.size,
        mimeType,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fayl yuklashda xatolik yuz berdi";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
