import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { featureForPath } from "@ventura/tenants";
import { features } from "@/lib/manifest";
import { tenantForHost } from "@/lib/server/tenant";

/*
 * So'rov ilovaga yetishidan oldin (Next 16 Proxy, Node runtime):
 * 1) o'chirilgan bo'lim manzili va API yo'llari — 404 (SPEC 8; ma'lumot o'chmaydi, qayta yoqilsa ochiladi);
 * 2) sessiya cookie'si bo'lmasa — /login (optimistik; haqiqiy tekshiruv serverda: requireStaff, requireFeature).
 */

// /api/sms/eskiz, /api/telegram — webhooklar (sessiyasiz), /api/uploads — fayllar
const PUBLIC = ["/login", "/health", "/bolim-yopiq", "/muzlatilgan", "/ariza", "/api/sms/eskiz", "/api/telegram", "/api/uploads"];
/** Boshqa saytga iframe qilib qo'yiladigan yoki Telegram Mini App sahifalari (ADR 0026) */
const EMBEDDABLE = ["/ariza", "/kabinet", "/portal"];

const under = (list: readonly string[], pathname: string) =>
  list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

function framing(res: NextResponse, pathname: string): NextResponse {
  if (!under(EMBEDDABLE, pathname)) {
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
  return res;
}

/** Yo'naltirish so'rov domeniga (mijoz domeni): `request.url` da server ichki manzili bo'lishi mumkin. */
function sameHost(request: NextRequest, path: string): URL {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ? "https" : "http";
  return new URL(path, `${proto}://${request.headers.get("host") ?? request.nextUrl.host}`);
}

export function proxy(request: NextRequest) {
  return framing(route(request), request.nextUrl.pathname);
}

function route(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const tenant = tenantForHost(request.headers.get("host"));
  // Notanish domen: sahifalar o'zi "Bunday tizim topilmadi" ko'rsatadi
  if (!tenant) return NextResponse.next();

  // Muzlatilgan (to'xtatilgan) loyiha
  if (tenant.status === "paused") {
    if (pathname === "/health" || pathname === "/muzlatilgan") return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "project_paused" }, { status: 403 });
    return NextResponse.rewrite(new URL("/muzlatilgan", request.url));
  }

  const feature = featureForPath(features, pathname);
  if (feature && !tenant.features.includes(feature)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // Shell'siz sahifa: kirmagan foydalanuvchiga ham login emas, 404 ko'rinadi
    return NextResponse.rewrite(new URL("/bolim-yopiq", request.url));
  }

  if (under(PUBLIC, pathname)) return NextResponse.next();
  if (!getSessionCookie(request, { cookiePrefix: "edu" })) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(sameHost(request, "/login"));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp|woff2?)$).*)"],
};
