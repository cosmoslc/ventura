// Muallif / Agent: Google Gemini
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/*
 * Optimistik tekshiruv (Next 16 Proxy): sessiya cookie'si bo'lmasa /login ga yo'naltiradi.
 * Haqiqiy tekshiruv (muddat, bloklash, 2FA, rol) server tomonida — requireViewer().
 */

// /api/sms/relay — markaz ilovalaridan imzolangan so'rovlar (sessiyasiz, imzo route ichida tekshiriladi)
const PUBLIC = ["/login", "/ui-preview", "/preview", "/api/sms/relay", "/crm"];

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isCrmHost = host.startsWith("crm.");
  const { pathname } = request.nextUrl;

  if (isCrmHost) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/crm", request.url));
    }
    return NextResponse.next();
  }

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (!getSessionCookie(request, { cookiePrefix: "ventura" })) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Statik fayllar va Next ichki yo'llari tekshirilmaydi
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp|woff2?)$).*)"],
};
