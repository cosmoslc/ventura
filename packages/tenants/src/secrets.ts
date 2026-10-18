import { z } from "zod";

/*
 * Mijozlarning maxfiy sozlamalari: baza manzili (parol bilan) va Telegram bot tokeni (EDU-CRM-PLAN 8a-qaror).
 * Ochiq ro'yxatdan (tenants.json) alohida faylda turadi: panel deploy paytida 0600 huquq bilan yozadi,
 * ilova faqat server kodida o'qiydi. Hech qachon brauzerga, logga yoki repoga tushmaydi.
 */

/** @BotFather bergan token: `<bot id>:<kalit>`. Panel kiritishda, deploy yozishda va ilova o'qishda shu bilan */
export const TELEGRAM_BOT_TOKEN_RE = /^\d+:[\w-]{20,}$/;

export const tenantSecretSchema = z.object({
  /** Shu mijoz bazasi: umumiy baza (shared_db) yoki o'z bazasi (db_per_tenant, dedicated_server) */
  databaseUrl: z.string().regex(/^postgres(ql)?:\/\//, "databaseUrl: postgres:// manzil"),
  /** Shu mijoz sessiyalari va kirish oralig'idagi imzolar uchun kalit (panel yaratadi, kamida 32 belgi) */
  authSecret: z.string().min(32, "authSecret: kamida 32 belgi"),
  /** Mijozning o'z boti: xodimlarga kirish kodini yuboradi. Botsiz loyihada xodimlar kira olmaydi. */
  telegramBotToken: z.string().regex(TELEGRAM_BOT_TOKEN_RE, "telegramBotToken: @BotFather bergan token").optional(),
  /**
   * Ventura SMS paketi (ADR 0056): panel manzili va shu loyihaning relay kaliti (so'rovlarni imzolash uchun).
   * Ventura'ning Eskiz kaliti markaz serveriga tushmaydi — SMS panel orqali ketadi.
   */
  smsRelay: z
    .object({
      url: z.string().regex(/^https?:\/\/\S+$/, "smsRelay.url: http(s):// manzil"),
      key: z.string().min(32, "smsRelay.key: kamida 32 belgi"),
    })
    .optional(),
});

export const tenantSecretsSchema = z.object({
  version: z.literal(1),
  tenants: z.record(z.string().min(1), tenantSecretSchema),
});

export type TenantSecret = z.infer<typeof tenantSecretSchema>;
export type TenantSecrets = z.infer<typeof tenantSecretsSchema>;

export const emptySecrets = (): TenantSecrets => ({ version: 1, tenants: {} });

/** Bo'sh yoki buzilgan fayl jim qabul qilinmaydi. Xato matnida qiymatlar (sirlar) ko'rsatilmaydi. */
export function parseSecrets(text: string): TenantSecrets {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Maxfiy sozlamalar fayli JSON emas");
  }
  const parsed = tenantSecretsSchema.safeParse(raw);
  if (!parsed.success) {
    const where = parsed.error.issues.map((i) => i.path.join(".") || "(ildiz)").join(", ");
    throw new Error(`Maxfiy sozlamalar fayli noto'g'ri: ${where}`);
  }
  return parsed.data;
}
