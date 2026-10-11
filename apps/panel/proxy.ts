import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/*
 * Optimistik tekshiruv (Next 16 Proxy): sessiya cookie'si bo'lmasa /login ga yo'naltiradi.
 * Haqiqiy tekshiruv (muddat, bloklash, 2FA, rol) server tomonida — requireViewer().
 */

const PUBLIC = ["/login", "/ui-preview", "/preview"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
