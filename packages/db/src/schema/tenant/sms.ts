import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { students } from "./students";
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
    /** ventura — Ventura paketi (standart, ADR 0056); own — markazning o'z Eskiz hisobi */
    mode: text("mode", { enum: SMS_MODES }).notNull().default("ventura"),
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

/*
 * SMS xabarlari (S3): bitta jadval ham navbat (outbox), ham tarix. Biznes amal xabarni `queued` qilib yozadi, fon
 * jarayoni (lib/server/sms/outbox.ts) yuboradi. `dedupe_key` takrorni to'xtatadi (masalan `absence:<davomat id>`).
 * Xabar o'chirilmaydi — hisobot (S5) shu jadvaldan. `group_id` va `branch_id` — hisobot o'lchovlari (FK siz).
 */

export const SMS_MESSAGE_STATUSES = ["queued", "sending", "sent", "delivered", "failed", "cancelled"] as const;
export type SmsMessageStatus = (typeof SMS_MESSAGE_STATUSES)[number];

export const SMS_RECIPIENTS = ["student", "parent", "staff", "other"] as const;

export const smsDispatches = pgTable(
  "sms_dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    title: text("title").notNull(),
    kind: text("kind", { enum: SMS_TEMPLATE_KIND_VALUES }).notNull(),
    total: integer("total").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("sms_dispatches_tenant_id_uq").on(t.tenantId, t.id),
    check("sms_dispatches_title_len", sql`length(${t.title}) between 1 and 200`),
    tenantPolicy("sms_dispatches"),
  ],
);

export const smsMessages = pgTable(
  "sms_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    kind: text("kind", { enum: SMS_TEMPLATE_KIND_VALUES }).notNull(),
    templateId: uuid("template_id").references(() => smsTemplates.id, { onDelete: "set null" }),
    dispatchId: uuid("dispatch_id"),
    studentId: uuid("student_id"),
    staffId: uuid("staff_id"),
    groupId: uuid("group_id"),
    branchId: uuid("branch_id"),
    recipient: text("recipient", { enum: SMS_RECIPIENTS }).notNull(),
    /** 998XXXXXXXXX */
    phone: text("phone").notNull(),
    text: text("text").notNull(),
    parts: smallint("parts").notNull().default(1),
    /** Eskiz hisoblagan narx (so'm), yetkazilgandan keyin */
    cost: integer("cost"),
    status: text("status", { enum: SMS_MESSAGE_STATUSES }).notNull().default("queued"),
    providerId: text("provider_id"),
    error: text("error"),
    attempts: smallint("attempts").notNull().default(0),
    sendAfter: timestamp("send_after", { withTimezone: true }).notNull().defaultNow(),
    /** Yuborish uchun olingan payt: jarayon to'xtab qolsa — qaytadan navbatga */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    dedupeKey: text("dedupe_key"),
  },
  (t) => [
    unique("sms_messages_dedupe_uq").on(t.tenantId, t.dedupeKey),
    index("sms_messages_queue_idx")
      .on(t.sendAfter)
      .where(sql`${t.status} = 'queued'`),
    index("sms_messages_provider_idx").on(t.providerId),
    index("sms_messages_created_idx").on(t.createdAt.desc()),
    index("sms_messages_student_idx").on(t.studentId, t.createdAt.desc()),
    index("sms_messages_group_idx").on(t.groupId, t.createdAt.desc()),
    index("sms_messages_dispatch_idx").on(t.dispatchId),
    foreignKey({
      name: "sms_messages_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "sms_messages_staff_fk",
      columns: [t.tenantId, t.staffId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "sms_messages_dispatch_fk",
      columns: [t.tenantId, t.dispatchId],
      foreignColumns: [smsDispatches.tenantId, smsDispatches.id],
    }).onDelete("cascade"),
    check("sms_messages_phone", sql`${t.phone} ~ '^998[0-9]{9}$'`),
    check("sms_messages_text_len", sql`length(${t.text}) between 1 and 1000`),
    check("sms_messages_attempts", sql`${t.attempts} between 0 and 10`),
    tenantPolicy("sms_messages"),
  ],
);
