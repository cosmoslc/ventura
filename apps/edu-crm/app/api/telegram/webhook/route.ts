import { type NextRequest, NextResponse } from "next/server";
import { type TelegramUpdate } from "@ventura/integrations";
import { tenantDeps } from "@/lib/server/deps";
import { handleTelegramWebhook } from "@/lib/server/telegram-bots";
import { tenantForHost } from "@/lib/server/tenant";
import type { BotRole } from "@/lib/telegram-bots";

export async function POST(req: NextRequest) {
  const host = req.headers.get("host");
  const tenant = tenantForHost(host);
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const deps = tenantDeps(tenant);
  if (!deps) {
    return NextResponse.json({ error: "deps_not_ready" }, { status: 500 });
  }

  const roleParam = req.nextUrl.searchParams.get("role");
  const role: BotRole =
    roleParam === "student" ? "student" : roleParam === "parent" ? "parent" : "teacher";

  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ? "https" : "http";
  const originUrl = `${proto}://${host ?? req.nextUrl.host}`;

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await handleTelegramWebhook(deps.db, tenant, role, update, originUrl);
  return NextResponse.json(result);
}
