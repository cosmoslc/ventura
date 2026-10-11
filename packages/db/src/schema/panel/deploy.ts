import { bigserial, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { projects } from "./core";

/* ---------- Deploylar (SPEC 6 va 9-bo'limlar) ---------- */

/** `queued` → `building` → `deploying` → `ready` yoki `failed` / `canceled`. */
export const DEPLOY_STATUSES = ["queued", "building", "deploying", "ready", "failed", "canceled"] as const;
export type DeployStatus = (typeof DEPLOY_STATUSES)[number];
/** Hali tugamagan holatlar: loyihada bir vaqtda faqat bittasi bo'lishi mumkin. */
export const ACTIVE_DEPLOY_STATUSES = ["queued", "building", "deploying"] as const satisfies readonly DeployStatus[];

export const DEPLOY_TRIGGERS = ["manual", "rollback"] as const;

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Loyiha ichidagi tartib raqami (#1, #2, ...) */
    number: integer("number").notNull(),
    /** Qaysi drayver bajargan: `sim`, `ssh`, `vercel` */
    provider: text("provider").notNull(),
    status: text("status", { enum: DEPLOY_STATUSES }).notNull().default("queued"),
    trigger: text("trigger", { enum: DEPLOY_TRIGGERS }).notNull().default("manual"),
    triggeredBy: uuid("triggered_by").references(() => users.id, { onDelete: "set null" }),
    commitSha: text("commit_sha"),
    branch: text("branch"),
    releasePath: text("release_path"),
    /** Xato bo'lsa — qisqa sabab (sirlarsiz) */
    error: text("error"),
    /** Rollback bo'lsa — qaysi deploy'dan qaytilgan */
    rolledBackFrom: uuid("rolled_back_from"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("deployments_project_number_uq").on(t.projectId, t.number),
    index("deployments_project_created_idx").on(t.projectId, t.createdAt),
    // Bir loyihada bir vaqtda faqat bitta tugallanmagan deploy
    uniqueIndex("deployments_one_active_uq")
      .on(t.projectId)
      .where(sql`${t.status} in ('queued', 'building', 'deploying')`),
  ],
);

export const STEP_STATUSES = ["pending", "running", "ok", "failed", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const deploymentSteps = pgTable(
  "deployment_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployments.id, { onDelete: "cascade" }),
    /** Qadam kaliti: `fetch`, `build`, `health`, ... (packages/deploy STEPS) */
    step: text("step").notNull(),
    position: integer("position").notNull(),
    status: text("status", { enum: STEP_STATUSES }).notNull().default("pending"),
    exitCode: integer("exit_code"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("deployment_steps_uq").on(t.deploymentId, t.step)],
);

/** Log qatorlari alohida jadvalda: jonli ko'rsatish `id` bo'yicha "shundan keyingilari" deb so'raydi. */
export const deploymentLogs = pgTable(
  "deployment_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployments.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    /** `cmd` — bajarilgan buyruq, `out` — natija, `err` — xato oqimi, `info` — drayver izohi */
    stream: text("stream", { enum: ["cmd", "out", "err", "info"] })
      .notNull()
      .default("out"),
    line: text("line").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deployment_logs_dep_idx").on(t.deploymentId, t.id)],
);
