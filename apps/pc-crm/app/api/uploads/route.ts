import { type NextRequest, NextResponse } from "next/server";
import { saveBase64Image, saveUploadedBuffer } from "@/lib/server/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // 1. JSON orqali (Base64 dataUrl)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { dataUrl, filename } = body;

      if (!dataUrl || typeof dataUrl !== "string") {
        return NextResponse.json({ ok: false, error: "dataUrl majburiy" }, { status: 400 });
      }

      const saved = await saveBase64Image(dataUrl, filename || "cleaned-product.webp");
      return NextResponse.json({ ok: true, file: saved });
    }

    // 2. FormData orqali (File upload)
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Fayl topilmadi" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Fayl hajmi 20MB dan oshmasligi kerak" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const saved = await saveUploadedBuffer(buffer, file.name);

    return NextResponse.json({ ok: true, file: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fayl yuklashda xatolik";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
