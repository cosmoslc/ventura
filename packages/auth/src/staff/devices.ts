import { createHash } from "node:crypto";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { knownDevices, sessions } from "@ventura/db/schema/tenant";

/*
 * Qurilmalar (E6g, ADR 0040): qurilma cookie'sining xeshi xodim bilan birga `known_devices` da turadi. Direktor
 * qurilmani bloklasa, undan kirib ham, ochiq sessiya bilan ishlab ham bo'lmaydi (getStaff har so'rovda tekshiradi).
 */

export const deviceHash = (deviceId: string) => createHash("sha256").update(deviceId).digest("hex");

/** Brauzer va operatsion tizim: "Chrome · Windows". Tanilmasa — null (ko'rsatishda "Noma'lum qurilma"). */
export function describeUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /YaBrowser\//.test(ua)
          ? "Yandex"
          : /(?:Firefox|FxiOS)\//.test(ua)
            ? "Firefox"
            : /(?:Chrome|CriOS)\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Shu xodimning shu qurilmasi bloklanganmi. Qurilma aniqlanmasa (cookie yo'q) — bloklanmagan deb olinadi:
 * bunday so'rovda qurilmani aytib bo'lmaydi (yangi kirishda baribir yangi cookie beriladi).
 */
export async function isDeviceBlocked(db: TenantDb, userId: string, deviceId: string | null | undefined) {
  if (!deviceId) return false;
  const [row] = await db
    .select({ id: knownDevices.id })
    .from(knownDevices)
    .where(
      and(
        eq(knownDevices.userId, userId),
        eq(knownDevices.deviceHash, deviceHash(deviceId)),
        isNotNull(knownDevices.blockedAt),
      ),
    )
    .limit(1);
  return !!row;
}

/** Joriy sessiyadan boshqa hamma sessiyalar yopiladi; yopilganlar soni qaytadi. */
export async function endOtherSessions(db: TenantDb, userId: string, currentSessionId: string): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
    .returning({ id: sessions.id });
  return rows.length;
}

/**
 * Bloklangan qurilmaning ochiq sessiyalarini yopish: sessiya qurilmaga bog'lanmagan, shuning uchun xodimning
 * shu brauzer belgisi (user-agent) bilan ochilgan sessiyalari yopiladi (cookie o'chirilsa ham kirib bo'lmasin).
 */
export async function revokeSessionsByAgent(
  db: TenantDb,
  userId: string,
  userAgent: string | null,
  exceptSessionId?: string,
): Promise<number> {
  if (!userAgent) return 0;
  const rows = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.userAgent, userAgent),
        exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
      ),
    )
    .returning({ id: sessions.id });
  return rows.length;
}
