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

const PUBLIC = ["/login", "/health", "/bolim-yopiq"];

/** Yo'naltirish so'rov domeniga (mijoz domeni): `request.url` da server ichki manzili bo'lishi mumkin. */
function sameHost(request: NextRequest, path: string): URL {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ? "https" : "http";
  return new URL(path, `${proto}://${request.headers.get("host") ?? request.nextUrl.host}`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenant = tenantForHost(request.headers.get("host"));
  // Notanish domen: sahifalar o'zi "Bunday tizim topilmadi" ko'rsatadi
  if (!tenant) return NextResponse.next();

  const feature = featureForPath(features, pathname);
  if (feature && !tenant.features.includes(feature)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // Shell'siz sahifa: kirmagan foydalanuvchiga ham login emas, 404 ko'rinadi
    return NextResponse.rewrite(new URL("/bolim-yopiq", request.url));
  }

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (!getSessionCookie(request, { cookiePrefix: "edu" })) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(sameHost(request, "/login"));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp|woff2?)$).*)"],
};
