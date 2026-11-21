/*
 * Ilova jarayoni ishga tushganda (Next instrumentation). Faqat Node muhitida.
 * - SMS navbati fon vazifasi (ADR 0055); `SMS_SCHEDULER=off` — o'chirish (masalan e2e testlarda).
 * - Telegram webhook'lari sir kaliti bilan qayta o'rnatiladi (faqat production; `TELEGRAM_WEBHOOK_SYNC=off` — o'chirish).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SMS_SCHEDULER !== "off") {
    const { startSmsScheduler } = await import("./lib/server/sms/scheduler");
    startSmsScheduler();
  }
  if (process.env.NODE_ENV === "production" && process.env.TELEGRAM_WEBHOOK_SYNC !== "off") {
    const { syncAllBotWebhooks } = await import("./lib/server/telegram-webhook-sync");
    // Ishga tushishni kutdirmaydi: Telegram javobi sekin bo'lsa ham ilova ochiladi
    void syncAllBotWebhooks();
  }
}
