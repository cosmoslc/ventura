"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createTelegram, escapeHtml } from "@ventura/integrations";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { getTelegramBotsConfig, saveTelegramBotsConfig } from "@/lib/server/telegram-bots";
import { type TelegramBotsConfig } from "@/lib/telegram-bots";
import { uz } from "@/lib/uz";

const botRoleSchema = z.enum(["teacher", "student", "parent"]);

const saveBotSchema = z.object({
  role: botRoleSchema,
  token: z.string().trim(),
  username: z.string().trim(),
  enabled: z.boolean(),
  miniAppUrl: z.string().trim(),
  notifications: z.record(z.string(), z.boolean()),
});

const PERM = "settings.sms_gateways";

export async function saveBotConfigAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ db, tenant, staff, audit }) => {
    const parsed = saveBotSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };

    const { role, token, username, enabled, miniAppUrl, notifications } = parsed.data;
    const currentConfig = await getTelegramBotsConfig(db);

    const botKey: keyof TelegramBotsConfig =
      role === "teacher" ? "teacherBot" : role === "student" ? "studentBot" : "parentBot";

    const nextConfig: TelegramBotsConfig = {
      ...currentConfig,
      [botKey]: {
        ...currentConfig[botKey],
        token,
        username: username.replace(/^@/, ""),
        enabled,
        miniAppUrl,
        notifications,
      },
    };

    await saveTelegramBotsConfig(db, nextConfig, staff.id);

    // Agar token bor bo'lsa, Telegram Webhookni avtomatik yangilashga urinamiz
    if (token) {
      try {
        const tg = createTelegram(token);
        if (enabled) {
          // Webhook manzilini markazning o'z subdomeni bo'yicha quramiz
          const domain =
            tenant.hosts?.find((h) => !h.includes("localhost") && !h.includes("127.0.0.1")) ||
            `${tenant.slug}.ventura.uz`;
          const webhookUrl = `https://${domain}/api/telegram/webhook?role=${role}`;
          await tg.setWebhook(webhookUrl);
        } else {
          await tg.deleteWebhook().catch(() => {});
        }
      } catch (e) {
        console.warn("[saveBotConfigAction] webhook yangilashda ogohlantirish:", e);
      }
    }

    await audit(
      "telegram_bots.update",
      { type: "settings", id: "telegram_bots" },
      { role, enabled, username },
    );

    revalidatePath("/telegram-bots");
    return { ok: true };
  });
}

const testMessageSchema = z.object({
  role: botRoleSchema,
  chatId: z.string().trim().min(1, "Chat ID kiritilishi shart"),
  message: z.string().trim().min(1, "Xabar matni kiritilishi shart"),
});

export async function sendTestBotMessageAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ db }) => {
    const parsed = testMessageSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };

    const { role, chatId, message } = parsed.data;
    const config = await getTelegramBotsConfig(db);
    const bot =
      role === "teacher"
        ? config.teacherBot
        : role === "student"
          ? config.studentBot
          : config.parentBot;

    if (!bot.token) {
      return { ok: false, error: "Bot tokeni sozlanmagan. Avval tokenni kiriting va saqlang." };
    }

    try {
      const tg = createTelegram(bot.token);
      await tg.sendMessage(
        chatId,
        `🔔 <b>Ventura CRM — Test bildirishnoma</b>\n\n` +
          `Bot: <b>${escapeHtml(bot.name)}</b> (@${escapeHtml(bot.username || "bot")})\n\n` +
          `${escapeHtml(message)}\n\n` +
          `<i>Bu xabar tizim sozlamalarini tekshirish uchun yuborildi.</i>`,
      );
      return { ok: true };
    } catch (e) {
      const err = e as Error;
      return { ok: false, error: `Telegram xatosi: ${err.message}` };
    }
  });
}

const syncWebhookSchema = z.object({
  role: botRoleSchema,
});

export async function syncBotWebhookAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ db, tenant }) => {
    const parsed = syncWebhookSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };

    const { role } = parsed.data;
    const config = await getTelegramBotsConfig(db);
    const bot =
      role === "teacher"
        ? config.teacherBot
        : role === "student"
          ? config.studentBot
          : config.parentBot;

    if (!bot.token) {
      return { ok: false, error: "Bot tokeni mavjud emas" };
    }

    try {
      const tg = createTelegram(bot.token);
      const domain =
        tenant.hosts?.find((h) => !h.includes("localhost") && !h.includes("127.0.0.1")) ||
        `${tenant.slug}.ventura.uz`;
      const webhookUrl = `https://${domain}/api/telegram/webhook?role=${role}`;
      await tg.setWebhook(webhookUrl);
      revalidatePath("/telegram-bots");
      return { ok: true };
    } catch (e) {
      const err = e as Error;
      return { ok: false, error: `Webhook o'rnatishda xato: ${err.message}` };
    }
  });
}
