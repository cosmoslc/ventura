import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy } from "./columns";

/*
 * SMS provayderi (docs/EDU-CRM-SMS.md, S1): markazning Eskiz ulanishi — har mijozda bitta qator. Maxfiy kalit va
 * token shifrlangan (AES-GCM, kalit tenant `authSecret`idan HKDF bilan — lib/server/sms/secret.ts); brauzerga faqat
 * "ulangan / ulanmagan", email va yuboruvchi nomi qaytadi. Tinch soatlar — avto-SMS shu oraliqda ketmaydi (S4).
 */

export const SMS_MODES = ["own", "ventura"] as const;
export type SmsMode = (typeof SMS_MODES)[number];

export const smsProvider = pgTable(
  "sms_provider",
  {
    tenantId: tenantId(),
    /** own — markazning o'z Eskiz hisobi; ventura — Ventura paketi (S6) */
    mode: text("mode", { enum: SMS_MODES }).notNull().default("own"),
    provider: text("provider", { enum: ["eskiz"] })
      .notNull()
      .default("eskiz"),
    email: text("email"),
    /** Shifrlangan maxfiy kalit (JSON: ciphertext, iv, authTag, keyVersion) */
    secretEnc: text("secret_enc"),
    tokenEnc: text("token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    /** Yuboruvchi nomi (Eskiz nikneymi); null — standart 4546 */
    sender: text("sender"),
    /** Avto-SMS umumiy kaliti (qo'lda yuborish bunga bog'liq emas) */
    enabled: boolean("enabled").notNull().default(false),
    quietFrom: smallint("quiet_from").notNull().default(21),
    quietTo: smallint("quiet_to").notNull().default(8),
    /** Oxirgi muvaffaqiyatli tekshiruv */
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId] }),
    check("sms_provider_quiet_hours", sql`${t.quietFrom} between 0 and 23 and ${t.quietTo} between 0 and 23`),
    check("sms_provider_email_len", sql`${t.email} is null or length(${t.email}) between 3 and 200`),
    check("sms_provider_sender_len", sql`${t.sender} is null or length(${t.sender}) between 1 and 20`),
    tenantPolicy("sms_provider"),
  ],
);

/*
 * SMS shablonlari (S2). `kind` — qaysi avto-SMS uchun (S4); `moderation` — Eskiz holati: avto-SMS faqat `approved`
 * shablon bilan ketadi. Eskiz yuborishda id qaytarmaydi — sinxronlashda matni bo'yicha topilib `provider_template_id`
 * yoziladi. O'chirilgan shablon arxivlanadi (yuborilgan xabarlar unga bog'liq bo'ladi — S3).
 */

export const SMS_TEMPLATE_KIND_VALUES = [
  "payment_received",
  "payment_reminder",
  "debt_warning",
  "absence",
  "salary_paid",
  "birthday",
  "custom",
] as const;

export const SMS_MODERATION_VALUES = ["draft", "moderation", "approved", "advert", "rejected"] as const;

export const smsTemplates = pgTable(
  "sms_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    kind: text("kind", { enum: SMS_TEMPLATE_KIND_VALUES }).notNull(),
    name: text("name").notNull(),
    body: text("body").notNull(),
    /** Namunadagi qismlar soni (ro'yxatda ko'rsatish uchun) */
    parts: smallint("parts").notNull().default(1),
    providerTemplateId: integer("provider_template_id"),
    moderation: text("moderation", { enum: SMS_MODERATION_VALUES }).notNull().default("draft"),
    /** Eskiz'ga yuborilgan matn — keyin o'zgarsa qayta moderatsiya kerak */
    submittedBody: text("submitted_body"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("sms_templates_kind_idx")
      .on(t.kind)
      .where(sql`${t.archivedAt} is null`),
    check("sms_templates_name_len", sql`length(${t.name}) between 1 and 80`),
    check("sms_templates_body_len", sql`length(${t.body}) between 1 and 1000`),
    check("sms_templates_parts", sql`${t.parts} between 1 and 20`),
    tenantPolicy("sms_templates"),
  ],
);
