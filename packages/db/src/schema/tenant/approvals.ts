import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";

/*
 * Tasdiq so'rovlari (EDU-CRM-PLAN E3d, ADR 0019). Lavozimida "tasdiq bilan" belgilangan amalni xodim bajarmoqchi
 * bo'lsa, amal bajarilmaydi — shu yerga so'rov yoziladi. Direktor tasdiqlasa amal server reyestridan (amal kaliti)
 * saqlangan ma'lumot bilan, direktor nomidan bajariladi; bajarilmasa so'rov kutilmoqda holatiga qaytadi va sabab
 * yoziladi. Xodim faqat o'zining kutilayotgan so'rovini bekor qiladi.
 */

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    requestedBy: uuid("requested_by").notNull(),
    /** Qaysi ruxsat tasdiq bilan edi */
    permission: text("permission").notNull(),
    /** Server reyestridagi amal kaliti (masalan `payments.record`) */
    action: text("action").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    /** Amalga beriladigan kirish (bajarishda amalning o'z Zod sxemasi qayta tekshiradi) */
    payload: jsonb("payload").$type<unknown>().notNull(),
    status: text("status", { enum: APPROVAL_STATUSES }).notNull().default("pending"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    /** Tasdiqlanganda amal bajarilmagan bo'lsa — sababi (so'rov qayta ochiladi) */
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    unique("approval_requests_tenant_id_uq").on(t.tenantId, t.id),
    index("approval_requests_status_idx").on(t.status),
    index("approval_requests_requested_by_idx").on(t.requestedBy),
    foreignKey({
      name: "approval_requests_requested_by_fk",
      columns: [t.tenantId, t.requestedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "approval_requests_decided_by_fk",
      columns: [t.tenantId, t.decidedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("approval_requests_title_len", sql`length(${t.title}) between 1 and 300`),
    check("approval_requests_note_len", sql`${t.decisionNote} is null or length(${t.decisionNote}) <= 500`),
    check(
      "approval_requests_decided",
      sql`(${t.status} in ('pending', 'cancelled')) or (${t.decidedBy} is not null and ${t.decidedAt} is not null)`,
    ),
    tenantPolicy("approval_requests"),
  ],
);
