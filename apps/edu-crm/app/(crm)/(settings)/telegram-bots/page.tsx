import { getTenantDb } from "@/lib/server/deps";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { getTelegramBotsConfig, getTelegramBotsStats } from "@/lib/server/telegram-bots";
import { uz } from "@/lib/uz";
import { TelegramBotsView } from "./telegram-bots-view";

export const metadata = { title: uz.telegramBots.title };

/**
 * Telegram botlar sahifasi (ADR 0064).
 * O'qituvchilar, o'quvchilar va ota-onalar uchun alohida bot xizmatlari,
 * jonli foydalanuvchilar statistikasi va avtomatik bildirishnoma sozlamalari.
 * Muallif / Agent: Google Gemini
 */
export default async function TelegramBotsPage() {
  const tenant = await requireTenant();
  await requireStaff();
  const db = getTenantDb(tenant);

  const [config, stats] = await Promise.all([getTelegramBotsConfig(db), getTelegramBotsStats(db)]);

  return <TelegramBotsView config={config} stats={stats} tenantName={tenant.name} tenantSlug={tenant.slug} />;
}
