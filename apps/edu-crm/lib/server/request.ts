import "server-only";
import { cookies, headers } from "next/headers";
import { type RequestMeta, newDeviceId } from "@ventura/auth";

export const DEVICE_COOKIE = "edu.device";
export const PENDING_COOKIE = "edu.pending";

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
  return { ip, userAgent: h.get("user-agent") };
}

/** So'rov manzili: nginx orqasida — X-Forwarded-Proto bo'yicha. Cookie'ning `Secure` belgisi shunga bog'liq. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ? "https" : "http";
  return `${proto}://${h.get("host") ?? "localhost"}`;
}

export async function secureRequest(): Promise<boolean> {
  return (await requestOrigin()).startsWith("https://");
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
    secure: await secureRequest(),
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
  });
  return id;
}

/** Joriy qurilma identifikatori (cookie'ni o'zgartirmaydi); kirishdan oldin yoki o'chirilgan bo'lsa — null. */
export async function currentDeviceId(): Promise<string | null> {
  return (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
}
