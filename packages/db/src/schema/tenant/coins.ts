import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { groups } from "./groups";
import { students } from "./students";

/*
 * Coinlar (ADR 0061): bitta tur, faqat avtomatik — oldindan to'lov, davomat, uy vazifasi. Daftar yozuvi
 * o'chirilmaydi: sabab yo'qolsa `revoked_at` qo'yiladi, qaytsa olib tashlanadi. (o'quvchi, qoida, sabab) noyob —
 * bir sabab uchun coin ikki marta berilmaydi. Balans — bekor qilinmagan yozuvlar yig'indisi.
 */

export const COIN_RULES = ["prepay", "attendance", "homework"] as const;
export type CoinRule = (typeof COIN_RULES)[number];

export const coinEntries = pgTable(
  "coin_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    studentId: uuid("student_id").notNull(),
    groupId: uuid("group_id"),
    rule: text("rule", { enum: COIN_RULES }).notNull(),
    /** Sabab kaliti: `prepay:<guruh>:<oy>`, `att:<guruh>:<sana>`, `hw:<guruh>:<sana>` */
    sourceKey: text("source_key").notNull(),
    /** Berilgan paytdagi sozlama miqdori */
    amount: integer("amount").notNull(),
    /** Sabab sanasi: dars kuni yoki to'lov oyining 1-kuni */
    refDate: date("ref_date", { mode: "string" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("coin_entries_source_uq").on(t.tenantId, t.studentId, t.rule, t.sourceKey),
    index("coin_entries_student_idx").on(t.studentId, t.refDate),
    index("coin_entries_ref_date_idx").on(t.refDate),
    foreignKey({
      name: "coin_entries_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "coin_entries_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("restrict"),
    check("coin_entries_amount", sql`${t.amount} between 1 and 100000`),
    check("coin_entries_source_len", sql`length(${t.sourceKey}) between 1 and 200`),
    tenantPolicy("coin_entries"),
  ],
);
