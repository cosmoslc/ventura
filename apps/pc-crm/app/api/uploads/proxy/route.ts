import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return new NextResponse("url parametri majburiy", { status: 400 });
    }

    // SSRF himoyasi: faqat http/https
    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      return new NextResponse("Faqat HTTP yoki HTTPS havolalar qabul qilinadi", { status: 400 });
    }

    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Ventura-Storefront-Proxy/1.0)",
      },
    });

    if (!res.ok) {
      return new NextResponse(`Rasm yuklab olinmadi: ${res.statusText}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rasm proksisida xatolik";
    return new NextResponse(message, { status: 500 });
  }
}
