import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
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
    /** Qaysi drayver bajargan: `sim`, `ssh` */
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

/* ---------- Serverlar (SPEC 6 va 9-bo'limlar) ---------- */

/** `home` — uydagi server (hozircha WSL), `online` — VPS */
export const SERVER_KINDS = ["home", "online"] as const;
/** `new` — qo'shilgan, hali tekshirilmagan; `ready` — ulanish va dasturlar joyida; `error` — oxirgi tekshiruv yiqilgan */
export const SERVER_STATUSES = ["new", "ready", "error"] as const;

export interface ServerInfo {
  os?: string;
  node?: string;
  pnpm?: string;
  pm2?: string;
  nginx?: string;
  postgres?: string;
  certbot?: string;
  git?: string;
  memoryMb?: number;
  diskFreeGb?: number;
  cpus?: number;
}

/** Ishlab turgan PM2 jarayoni (metrika so'rovidan; muhit o'zgaruvchilari olinmaydi) */
export interface ServerProcess {
  name: string;
  status: string;
  /** % (bitta yadroga nisbatan, PM2 bo'yicha) */
  cpu: number;
  memoryMb: number;
  restarts: number;
  /** Ishga tushgan vaqt (ms, epoch) */
  startedAt: number | null;
}

/** Serverdagi PostgreSQL bazasi (`ventura-db list`, ADR 0057) */
export interface ServerDatabase {
  name: string;
  owner: string;
  sizeBytes: number;
  connections: number;
}

/** Oxirgi metrika: serverning joriy holati */
export interface ServerMetrics {
  cpuPercent: number;
  cpus: number;
  load: [number, number, number];
  memTotalMb: number;
  memUsedMb: number;
  diskTotalGb: number;
  diskUsedGb: number;
  uptimeSec: number;
  processes: ServerProcess[];
  /** Bazalar; yo'q — serverdagi yordamchi eski (setup.sh qayta ishga tushirilmagan) */
  databases?: ServerDatabase[];
  /** Bazalar ro'yxatini olib bo'lmagan sabab */
  databasesError?: string;
  /** Umumiy bazalarda har mijoz egallagan joy (bayt), soatiga bir marta (ADR 0059) */
  tenantUsage?: { db: string; at: string; tenants: Record<string, number> }[];
}

/** Ogohlantirish holati: Telegram faqat o'zgarganda yuboriladi (SPEC 10: disk 85%, RAM 90%) */
export interface ServerAlerts {
  /** Ketma-ket yiqilgan so'rovlar */
  failures?: number;
  offline?: boolean;
  disk?: boolean;
  memory?: boolean;
  /** Hajm chegarasidan oshgan bazalar (ADR 0057) */
  databases?: string[];
  /** Joy limitidan oshgan loyihalar (slug, ADR 0059) */
  quotas?: string[];
}

/**
 * Server buyruqlari: `check` — tekshirish; `reload` / `stop` / `start` — ilova (PM2); `power_on` / `power_off` — uydagi
 * WSL serverni yoqish va o'chirish (ishchi shu Windows kompyuterida ishlaganda); `db_create` — yangi bo'sh baza;
 * `db_drop` — bazani o'chirish; `project_purge` — savatdagi loyihani serverdan va paneldan butunlay o'chirish (ADR 0058);
 * `db_move` — markazni umumiy ↔ alohida bazaga ko'chirish (ADR 0059).
 */
export const SERVER_ACTIONS = [
  "check",
  "reload",
  "stop",
  "start",
  "power_on",
  "power_off",
  "db_create",
  "db_drop",
  "project_purge",
  "db_move",
] as const;
export type ServerActionKind = (typeof SERVER_ACTIONS)[number];

/** Paneldan berilgan oxirgi buyruq (fon vazifasi) va uning natijasi — sahifada ko'rsatiladi */
export interface ServerLastAction {
  kind: ServerActionKind;
  /** reload/stop/start uchun ilova nomi */
  app?: string;
  /** db_create / db_drop uchun baza nomi */
  database?: string;
  /** project_purge: loyiha nomi (loyiha o'chgandan keyin ham natija ko'rinsin) */
  project?: string;
  status: "queued" | "running" | "ok" | "error";
  message?: string;
  by?: string;
  at: string;
}

export const servers = pgTable(
  "servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: text("kind", { enum: SERVER_KINDS }).notNull().default("online"),
    host: text("host").notNull(),
    sshPort: integer("ssh_port").notNull().default(22),
    sshUser: text("ssh_user").notNull().default("deploy"),
    /** Ochiq kalit — serverga shu qo'yiladi. Yopiq kalit `secrets` jadvalida, shifrlangan. */
    publicKey: text("public_key").notNull(),
    /** Serverning o'z kaliti izi (SHA256). Birinchi ulanishda eslab qolinadi, keyin o'zgarsa ulanish rad etiladi. */
    hostKey: text("host_key"),
    deployRoot: text("deploy_root").notNull().default("/home/deploy/apps"),
    /** Serverga sig'adigan loyihalar soni (bo'sh — cheklanmagan); hozircha faqat ko'rsatiladi */
    capacity: integer("capacity"),
    /** Adminlar uchun izoh (provayder, tarif, joylashuv) */
    note: text("note"),
    /** Uydagi WSL server: distributiv nomi (masalan Ubuntu-24.04) — paneldan yoqish va o'chirish uchun */
    wslDistro: text("wsl_distro"),
    status: text("status", { enum: SERVER_STATUSES }).notNull().default("new"),
    info: jsonb("info").$type<ServerInfo>().notNull().default({}),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastError: text("last_error"),
    /** Har daqiqalik so'rov: oxirgi muvaffaqiyatli metrika va oxirgi urinish natijasi */
    metrics: jsonb("metrics").$type<ServerMetrics>(),
    metricsAt: timestamp("metrics_at", { withTimezone: true }),
    probeAt: timestamp("probe_at", { withTimezone: true }),
    probeError: text("probe_error"),
    alerts: jsonb("alerts").$type<ServerAlerts>().notNull().default({}),
    lastAction: jsonb("last_action").$type<ServerLastAction>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("servers_name_uq").on(t.name)],
);

/** Metrikalar tarixi (grafiklar uchun): har daqiqa bitta qator, 7 kundan eskisi o'chiriladi */
export const serverMetrics = pgTable(
  "server_metrics",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    cpuPercent: real("cpu_percent").notNull(),
    memUsedMb: integer("mem_used_mb").notNull(),
    memTotalMb: integer("mem_total_mb").notNull(),
    diskUsedGb: real("disk_used_gb").notNull(),
    diskTotalGb: real("disk_total_gb").notNull(),
    load1: real("load1").notNull(),
  },
  (t) => [index("server_metrics_server_at_idx").on(t.serverId, t.at)],
);

/* ---------- Ishlab turgan ilovalar ---------- */

/**
 * Serverdagi bitta ilova nusxasi. `shared` rejimda bitta shablon ilovasi shu serverdagi hamma mijozga
 * xizmat qiladi (mijoz domen bo'yicha aniqlanadi); `dedicated` rejimda har loyihaning o'zi (`<shablon>-<slug>`, ADR 0048).
 */
export const apps = pgTable(
  "apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "restrict" }),
    templateKey: text("template_key").notNull(),
    /** Serverdagi papka va PM2 jarayoni nomi, masalan `edu-crm` */
    name: text("name").notNull(),
    /** Ilova tinglaydigan mahalliy port (nginx shu portga yo'naltiradi) */
    port: integer("port").notNull(),
    commitSha: text("commit_sha"),
    releasePath: text("release_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("apps_server_name_uq").on(t.serverId, t.name),
    uniqueIndex("apps_server_port_uq").on(t.serverId, t.port),
  ],
);
