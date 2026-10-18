import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { eskizDeliveryState } from "@ventura/integrations/eskiz";
import { tenantDeps } from "@/lib/server/deps";
import { applyDelivery } from "@/lib/server/sms/outbox";
import { callbackToken } from "@/lib/server/sms/sender";
import { tenantForHost } from "@/lib/server/tenant";

/*
 * Eskiz yetkazish xabari (docs/EDU-CRM-SMS.md, 4.5): `{request_id, status, sms_count, status_date, ...}`.
 * Manzildagi token tenant `authSecret`idan HMAC — boshqa markaz yoki begona so'rov xabar holatini o'zgartira olmaydi.
 * Sessiyasiz (proxy.ts PUBLIC); bo'lim o'chirilgan bo'lsa proxy 404 qaytaradi.
 */

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) return (await req.json()) as Record<string, unknown>;
    return Object.fromEntries((await req.formData()).entries());
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const tenant = tenantForHost(req.headers.get("host"));
  const deps = tenant ? tenantDeps(tenant) : null;
  const { token } = await params;
  if (!deps || !same(token, callbackToken(deps.secret))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = await readBody(req);
  const providerId = typeof body.request_id === "string" ? body.request_id : null;
  const status = typeof body.status === "string" ? body.status : "";
  if (!providerId) return NextResponse.json({ ok: true });
  const parts = Number(body.sms_count);
  const at = typeof body.status_date === "string" ? new Date(body.status_date) : undefined;
  await applyDelivery(deps.db, providerId, eskizDeliveryState(status), {
    parts: Number.isFinite(parts) && parts > 0 ? parts : null,
    at: at && !Number.isNaN(at.getTime()) ? at : undefined,
  });
  return NextResponse.json({ ok: true });
}
