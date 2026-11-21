import { type NextRequest, NextResponse } from "next/server";
import { saveUploadedBuffer } from "@/lib/server/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.REMOVE_BG_API_KEY;
    const body = await request.json().catch(() => ({}));
    const { imageUrl, imageBase64 } = body;

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "REMOVE_BG_API_KEY sozlanmagan. Tizim o'rnatilgan aqlli brauzer qirqish mexanizmiga o'tadi.",
        clientFallback: true,
      });
    }

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ ok: false, error: "imageUrl yoki imageBase64 kiritilishi shart" }, { status: 400 });
    }

    const payload: Record<string, string> = {
      size: "auto",
      format: "webp",
    };

    if (imageUrl) {
      payload.image_url = imageUrl;
    } else if (imageBase64) {
      payload.image_file_b64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, "");
    }

    const formData = new FormData();
    for (const [key, val] of Object.entries(payload)) {
      formData.append(key, val);
    }

    const apiRes = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: formData,
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return NextResponse.json({
        ok: false,
        error: `Remove.bg API xatoligi (${apiRes.status}): ${errText}`,
        clientFallback: true,
      });
    }

    const arrayBuffer = await apiRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const saved = await saveUploadedBuffer(buffer, "ai-clean.webp", ".webp");

    return NextResponse.json({
      ok: true,
      file: saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI fon tozalashda xatolik";
    return NextResponse.json({ ok: false, error: message, clientFallback: true }, { status: 500 });
  }
}
