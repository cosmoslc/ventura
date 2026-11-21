import "server-only";
import { createTelegram } from "@ventura/integrations";
import type { Tenant } from "@ventura/tenants";
import type { BotRole, SingleBotSettings } from "@/lib/telegram-bots";
import { tenantDeps } from "./deps";
import { getBotWebhookSecret, getTelegramBotsConfig } from "./telegram-bots";
import { allTenants } from "./tenant";

/*
 * Telegram webhook'larini sir kaliti bilan qayta ro'yxatdan o'tkazish.
 * Webhook endi X-Telegram-Bot-Api-Secret-Token sarlavhasini talab qiladi: avval siz o'rnatilgan botlar
 * shu sinxronlashsiz 401 olib to'xtab qolardi. Ilova har ishga tushganda (deploy) bir marta chaqiriladi.
 */

const BOT_KEYS = { teacher: "teacherBot", student: "studentBot", parent: "parentBot" } as const satisfies Record<
  BotRole,
  string
>;

/** Markazning ommaviy webhook manzili (localhost emas) */
export function botWebhookUrl(tenant: Tenant, role: BotRole): string {
  const domain =
    tenant.hosts?.find((h) => !h.includes("localhost") && !h.includes("127.0.0.1")) ?? `${tenant.slug}.ventura.uz`;
  return `https://${domain}/api/telegram/webhook?role=${role}`;
}

export async function syncTenantBotWebhooks(tenant: Tenant): Promise<void> {
  const deps = tenantDeps(tenant);
  if (!deps) return;
  const config = await getTelegramBotsConfig(deps.db);
  for (const role of Object.keys(BOT_KEYS) as BotRole[]) {
    const bot: SingleBotSettings = config[BOT_KEYS[role]];
    if (!bot.token || !bot.enabled) continue;
    try {
      await createTelegram(bot.token).setWebhook(botWebhookUrl(tenant, role), getBotWebhookSecret(bot, deps.secret, role));
    } catch (e) {
      // Token yoki tarmoq xatosi bitta botni to'xtatadi, qolganlarini emas (token logga yozilmaydi)
      console.warn(`[telegram-webhook-sync] ${tenant.slug}/${role}:`, e instanceof Error ? e.message : "xato");
    }
  }
}

export async function syncAllBotWebhooks(): Promise<void> {
  for (const tenant of allTenants()) {
    try {
      await syncTenantBotWebhooks(tenant);
    } catch (e) {
      console.warn(`[telegram-webhook-sync] ${tenant.slug}:`, e instanceof Error ? e.message : "xato");
    }
  }
}
