/*
 * Telegram Bot API klienti (SPEC 2: ogohlantirishlar; 1-bosqich: 2FA kodlari).
 * Token faqat server kodida; logga yozilmaydi.
 */

const API = "https://api.telegram.org";

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: TelegramUser;
    text?: string;
    date: number;
  };
}

export interface WebhookInfo {
  url: string;
  pending_update_count: number;
}

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "TelegramError";
  }
}

/** HTML parse_mode uchun matnni xavfsiz qiladi. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function createTelegram(token: string | undefined = process.env.TELEGRAM_BOT_TOKEN) {
  async function call<T>(method: string, body?: Record<string, unknown>, timeoutMs = 15_000): Promise<T> {
    if (!token) throw new TelegramError("TELEGRAM_BOT_TOKEN berilmagan");
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string; error_code?: number };
    // Xato matniga token tushmaydi — faqat Telegram javobining tavsifi
    if (!data.ok) throw new TelegramError(data.description ?? `Telegram ${method} xatosi`, data.error_code);
    return data.result as T;
  }

  return {
    getMe: () => call<TelegramUser>("getMe"),
    getWebhookInfo: () => call<WebhookInfo>("getWebhookInfo"),
    /** Long polling; webhook o'rnatilgan botda ishlamaydi (Telegram 409 qaytaradi). */
    getUpdates: (offset?: number, timeoutSec = 0) =>
      call<TelegramUpdate[]>(
        "getUpdates",
        { offset, timeout: timeoutSec, allowed_updates: ["message"] },
        (timeoutSec + 10) * 1000,
      ),
    sendMessage: (chatId: string | number, html: string) =>
      call<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
  };
}

export type Telegram = ReturnType<typeof createTelegram>;
