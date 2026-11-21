/*
 * Telegram Bot API klienti (SPEC 2: ogohlantirishlar; 1-bosqich: 2FA kodlari).
 * Token faqat server kodida; logga yozilmaydi.
 */

/** Standart manzil. `TELEGRAM_API_URL` — o'z Bot API serveri yoki e2e testlardagi soxta server uchun. */
const DEFAULT_API = "https://api.telegram.org";

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
  };
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: TelegramUser;
    text?: string;
    date: number;
    contact?: TelegramContact;
  };
  callback_query?: TelegramCallbackQuery;
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

export function createTelegram(
  token: string | undefined = process.env.TELEGRAM_BOT_TOKEN,
  api: string = process.env.TELEGRAM_API_URL || DEFAULT_API,
) {
  async function call<T>(method: string, body?: Record<string, unknown>, timeoutMs = 15_000): Promise<T> {
    if (!token) throw new TelegramError("TELEGRAM_BOT_TOKEN berilmagan");
    const res = await fetch(`${api}/bot${token}/${method}`, {
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
        { offset, timeout: timeoutSec, allowed_updates: ["message", "callback_query"] },
        (timeoutSec + 10) * 1000,
      ),
    sendMessage: (
      chatId: string | number,
      html: string,
      options?: {
        reply_markup?: unknown;
        parse_mode?: string;
        disable_web_page_preview?: boolean;
      },
    ) =>
      call<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text: html,
        parse_mode: options?.parse_mode ?? "HTML",
        disable_web_page_preview: options?.disable_web_page_preview ?? true,
        ...(options?.reply_markup ? { reply_markup: options.reply_markup } : {}),
      }),
    setWebhook: (url: string, secretToken?: string) =>
      call<boolean>("setWebhook", {
        url,
        ...(secretToken ? { secret_token: secretToken } : {}),
      }),
    deleteWebhook: () => call<boolean>("deleteWebhook"),
    answerCallbackQuery: (callbackQueryId: string, text?: string) =>
      call<boolean>("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
      }),
  };
}

export type Telegram = ReturnType<typeof createTelegram>;
