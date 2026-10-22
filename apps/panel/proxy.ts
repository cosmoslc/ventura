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
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const isCrmHost = host.startsWith("crm.");
  const { pathname } = request.nextUrl;

  // crm.ventura.uz yoki crm.localhost uchun qat'iy qoidalar:
  // Bu subdomenda HECH QACHON admin login yoki boshqaruv paneli ko'rinmaydi.
  if (isCrmHost) {
    if (pathname === "/") {
      const response = NextResponse.rewrite(new URL("/crm", request.url));
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }
    if (pathname === "/crm") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Agar foydalanuvchi /login ga kirsa (yoki avvalgi kesh bo'lsa), darhol landing sahifasiga qaytaramiz
    if (pathname === "/login" || pathname.startsWith("/login/")) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }
    // Statik fayllar va Next ichki resurslari
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api/crm") ||
      pathname === "/icon.svg" ||
      pathname === "/favicon.ico"
    ) {
      return NextResponse.next();
    }
    // crm.ventura.uz dagi boshqa barcha yo'llar (masalan admin panel sahifalari) landingga qaytadi
    return NextResponse.redirect(new URL("/", request.url));
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
