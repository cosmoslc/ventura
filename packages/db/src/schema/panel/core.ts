import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ---------- Sozlamalar (kalit → JSON qiymat) ---------- */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Mijozlar ---------- */

export const CLIENT_STATUSES = ["active", "inactive"] as const;

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone"),
    company: text("company"),
    note: text("note"),
    status: text("status", { enum: CLIENT_STATUSES }).notNull().default("active"),
    ...timestamps,
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

/* ---------- Shablonlar (apps/<shablon>/features.ts dan sinxronlanadi) ---------- */

export const templates = pgTable("templates", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  appPath: text("app_path").notNull(),
  version: text("version").notNull(),
  /** FeatureManifest — bo'limlar ro'yxati */
  manifest: jsonb("manifest").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Loyihalar (mijoz tizimlari) ---------- */

export const DEPLOY_MODES = ["shared", "dedicated", "fork"] as const;
export const TARGET_KINDS = ["home", "vps", "vercel"] as const;
export const DB_STRATEGIES = ["shared_db", "db_per_tenant", "dedicated_server"] as const;
/** `draft` — hali muvaffaqiyatli deploy bo'lmagan; birinchi `ready` deploy loyihani `active` qiladi */
export const PROJECT_STATUSES = ["draft", "active", "paused"] as const;

export interface ProjectBrand {
  primary: string;
  appearance: "light" | "dark" | "system";
}

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    templateKey: text("template_key")
      .notNull()
      .references(() => templates.key, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    mode: text("mode", { enum: DEPLOY_MODES }).notNull().default("shared"),
    target: text("target", { enum: TARGET_KINDS }).notNull().default("home"),
    dbStrategy: text("db_strategy", { enum: DB_STRATEGIES }).notNull().default("db_per_tenant"),
    status: text("status", { enum: PROJECT_STATUSES }).notNull().default("draft"),
    brand: jsonb("brand").$type<ProjectBrand>().notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    /** Mijoz tizimining ega login'i (paroli secrets jadvalida, shifrlangan) */
    ownerLogin: text("owner_login").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    /** Savat: o'chirilgan vaqt (30 kundan keyin butunlay o'chadi — 2-bosqich fon vazifasi) */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("projects_slug_uq").on(t.slug), index("projects_client_idx").on(t.clientId)],
);

export const projectFeatures = pgTable(
  "project_features",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    featureKey: text("feature_key").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.featureKey] })],
);

export const DOMAIN_KINDS = ["subdomain", "custom"] as const;
export const DOMAIN_STATUSES = ["pending_dns", "verified", "ssl_issuing", "active", "error"] as const;

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    kind: text("kind", { enum: DOMAIN_KINDS }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status", { enum: DOMAIN_STATUSES }).notNull().default("pending_dns"),
    sslExpiresAt: timestamp("ssl_expires_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("domains_hostname_uq").on(t.hostname), index("domains_project_idx").on(t.projectId)],
);

/* ---------- Sirlar (AES-256-GCM; brauzerga hech qachon qaytarilmaydi) ---------- */

export const secrets = pgTable(
  "secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: text("key_version").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("secrets_owner_name_uq").on(t.ownerType, t.ownerId, t.name)],
);

/* ---------- Audit jurnali (o'chmas, xesh zanjiri) ---------- */

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Zanjir tartibi */
    seq: bigserial("seq", { mode: "number" }).notNull().unique(),
    at: timestamp("at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
  },
  (t) => [index("audit_events_at_idx").on(t.at), index("audit_events_target_idx").on(t.targetType, t.targetId)],
);
