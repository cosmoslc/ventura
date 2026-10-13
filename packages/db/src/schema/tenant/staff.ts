import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";

/*
 * Lavozimlar (EDU-CRM-PLAN 14-qaror): eski tizimdagidek har markaz o'z lavozimlarini yaratadi va ruxsatlarini
 * belgilaydi. Ruxsatlar katalogi — packages/auth/src/staff/permissions.ts. Birinchi kirishda 7 ta tayyor shablon
 * qo'shiladi (ensurePositions).
 */
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    /** Tayyor shablondan bo'lsa — uning kodi (masalan `branch_manager`) */
    code: text("code"),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6366f1"),
    permissions: text("permissions")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** "Tasdiq bilan" ruxsatlar — amal direktor tasdig'idan keyin bajariladi (ADR 0019) */
    approvals: text("approvals")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Tizim lavozimi (Bosh Direktor): o'chirilmaydi, ruxsatlari o'zgartirilmaydi */
    system: boolean("system").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("positions_tenant_name_uq").on(t.tenantId, t.name),
    unique("positions_tenant_id_uq").on(t.tenantId, t.id),
    check("positions_color_hex", sql`${t.color} ~ '^#[0-9a-f]{6}$'`),
    tenantPolicy("positions"),
  ],
);

/** Xodimning lavozimlari (bir nechta bo'lishi mumkin — ruxsatlar birlashadi, eski tizimdagidek) */
export const userPositions = pgTable(
  "user_positions",
  {
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    positionId: uuid("position_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.positionId] }),
    foreignKey({
      name: "user_positions_user_fk",
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "user_positions_position_fk",
      columns: [t.tenantId, t.positionId],
      foreignColumns: [positions.tenantId, positions.id],
    }).onDelete("restrict"),
    tenantPolicy("user_positions"),
  ],
);
