import { date, foreignKey, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { groups } from "./groups";

/*
 * Guruh uy vazifalari (ADR 0063). O'qituvchi tomonidan dars uchun topshiriladigan vazifalar:
 * mavzu/sarlavha, batafsil tavsif, dars sanasi va topshirish muddati.
 * O'quvchilar kabinetidagi "Uy ishi" sahifasida ko'rinadi.
 */

export const groupHomeworks = pgTable(
  "group_homeworks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    groupId: uuid("group_id").notNull(),
    lessonDate: date("lesson_date", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date", { mode: "string" }),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    unique("group_homeworks_tenant_id_uq").on(t.tenantId, t.id),
    index("group_homeworks_group_idx").on(t.groupId, t.lessonDate),
    foreignKey({
      name: "group_homeworks_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "group_homeworks_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("set null"),
    tenantPolicy("group_homeworks"),
  ],
);
