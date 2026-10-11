import "server-only";
import { cookies, headers } from "next/headers";
import { newDeviceId, type RequestMeta } from "@ventura/auth";

export const DEVICE_COOKIE = "ventura.device";
export const PENDING_COOKIE = "ventura.pending";

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
  return { ip, userAgent: h.get("user-agent") };
}

/** Qurilma identifikatori (1 yil) — "yangi qurilmadan kirildi" ogohlantirishi uchun. */
export async function ensureDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing) return existing;
  const id = newDeviceId();
  store.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
  });
  return id;
}
