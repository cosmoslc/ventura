import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type TelegramUpdate } from "@ventura/integrations";
import { tenantDeps } from "@/lib/server/deps";
import { getBotWebhookSecret, getTelegramBotsConfig, handleTelegramWebhook } from "@/lib/server/telegram-bots";
import { tenantForHost } from "@/lib/server/tenant";
import type { BotRole } from "@/lib/telegram-bots";

const telegramUserSchema = z
  .object({
    id: z.number(),
    first_name: z.string().optional().default(""),
    username: z.string().optional(),
  })
  .passthrough();

const telegramContactSchema = z
  .object({
    phone_number: z.string(),
    first_name: z.string().optional().default(""),
    last_name: z.string().optional(),
    user_id: z.number().optional(),
  })
  .passthrough();

const telegramChatSchema = z
  .object({
    id: z.number(),
    type: z.string().optional().default("private"),
  })
  .passthrough();

const telegramMessageSchema = z
  .object({
    message_id: z.number(),
    chat: telegramChatSchema,
    from: telegramUserSchema.optional(),
    text: z.string().optional(),
    date: z.number().optional().default(0),
    contact: telegramContactSchema.optional(),
  })
  .passthrough();

const telegramCallbackQuerySchema = z
  .object({
    id: z.string(),
    from: telegramUserSchema,
    message: z
      .object({
        message_id: z.number(),
        chat: telegramChatSchema,
        text: z.string().optional(),
      })
      .passthrough()
      .optional(),
    data: z.string().optional(),
  })
  .passthrough();

export const telegramUpdateSchema = z
  .object({
    update_id: z.number(),
    message: telegramMessageSchema.optional(),
    callback_query: telegramCallbackQuerySchema.optional(),
  })
  .passthrough();

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
  if (roleParam !== "teacher" && roleParam !== "student" && roleParam !== "parent") {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }
  const role: BotRole = roleParam;

  const config = await getTelegramBotsConfig(deps.db);
  const bot = role === "teacher" ? config.teacherBot : role === "student" ? config.studentBot : config.parentBot;

  if (!bot.token) {
    return NextResponse.json({ error: "bot_not_configured" }, { status: 404 });
  }

  // Webhook siri tekshiruvi: X-Telegram-Bot-Api-Secret-Token sarlavhasi mos bo'lishi shart
  const expectedSecret = getBotWebhookSecret(bot, deps.secret, role);
  const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";

  const a = Buffer.from(receivedSecret);
  const b = Buffer.from(expectedSecret);
  if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ? "https" : "http";
  const originUrl = `${proto}://${host ?? req.nextUrl.host}`;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parseResult = telegramUpdateSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json({ error: "invalid_payload", details: parseResult.error.issues }, { status: 400 });
  }

  const update: TelegramUpdate = parseResult.data;
  const result = await handleTelegramWebhook(deps.db, tenant, role, update, originUrl);
  return NextResponse.json(result);
}
