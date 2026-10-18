import { and, eq, isNull, lt } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import {
  type ServerActionKind,
  type ServerLastAction,
  type ServerMetrics,
  apps,
  projects,
  serverMetrics,
  servers,
} from "@ventura/db/schema/panel";
import { notifySuperAdmins } from "@ventura/auth";
import { type Telegram, escapeHtml } from "@ventura/integrations";
import { randomBytes } from "node:crypto";
import { type AuditActor, audit, deleteSecrets, putSecret, readSecret } from "@ventura/security";
import {
  DB_LIST_COMMAND,
  DB_NAME_RE,
  DB_PASSWORD_RE,
  SYSTEM_DATABASES,
  dbNameFor,
  dbPasswordOwner,
  TENANT_USAGE_MAX_AGE_MS,
  nextDbAlerts,
  nextQuotaAlerts,
  parseDbList,
  parseTenantSizes,
  projectUsage,
  quotaBytesOf,
  tenantSizesCommand,
} from "./databases";
import { type AlertEvent, METRICS_SCRIPT, nextAlerts, parseMetrics } from "./metrics";
import { moveProjectDb } from "./move";
import { dropDatabase, purgeProject } from "./purge";
import { type Queue, SERVER_QUEUE } from "./queue";
import { type ServerRow, checkServer, openSession } from "./servers";
import { sh } from "./ssh";
import { waitForPort, wslControlError, wslStart, wslStop } from "./wsl";

/*
 * Serverlar monitoringi va boshqaruvi (SPEC 5 /servers, 10 ogohlantirishlar). Hammasi ishchi jarayonda:
 * har daqiqa metrika so'rovi va paneldan berilgan buyruqlar (`server` navbati). Buyruqlar qat'iy ro'yxatdan,
 * ilova nomi esa `apps` jadvalidan — foydalanuvchi matni buyruqqa qo'shilmaydi.
 */

/** Metrikalar tarixi shuncha kun saqlanadi */
export const METRICS_RETENTION_DAYS = 7;

export interface ServerJobData {
  serverId: string;
  kind: ServerActionKind;
  app?: string;
  /** db_create / db_drop: baza nomi */
  database?: string;
  /** project_purge / db_move: loyiha id si va nomi */
  projectId?: string;
  project?: string;
  /** db_move: qayerga — alohida baza yoki umumiy */
  target?: "own" | "shared";
  actor: AuditActor;
}

type ProbeResult = { ok: true; metrics: ServerMetrics; hostKey: string } | { ok: false; error: string };

/** Serverga ulanib metrikani oladi (o'zgartirmaydi) */
export async function probeServer(db: PanelDb, server: ServerRow): Promise<ProbeResult> {
  let session;
  try {
    session = await openSession(db, server);
    const out = await session.exec(`bash -lc ${sh(METRICS_SCRIPT)}`, { timeoutMs: 20_000 });
    if (out.code !== 0) return { ok: false, error: out.stderr.trim().split("\n").pop() || `Kod ${out.code}` };
    const metrics = parseMetrics(out.stdout);
    // Bazalar (ADR 0057): yordamchi eski bo'lsa metrika baribir saqlanadi, sababi ko'rsatiladi
    const dbs = await session.exec(`bash -lc ${sh(DB_LIST_COMMAND)}`, { timeoutMs: 20_000 }).catch((e: Error) => ({
      code: 1,
      stdout: "",
      stderr: e.message,
    }));
    if (dbs.code === 0) metrics.databases = parseDbList(dbs.stdout);
    else metrics.databasesError = dbs.stderr.trim().split("\n").pop() || `Kod ${dbs.code}`;
    // Umumiy bazalarda mijozlar hajmi (ADR 0059): soatiga bir marta, oradagi so'rovlarda oldingisi saqlanadi
    if (metrics.databases) {
      const prev = server.metrics?.tenantUsage ?? [];
      const usage: NonNullable<ServerMetrics["tenantUsage"]> = [];
      for (const d of metrics.databases.filter((x) => x.name.endsWith("_shared"))) {
        const old = prev.find((u) => u.db === d.name);
        if (old && Date.now() - Date.parse(old.at) < TENANT_USAGE_MAX_AGE_MS) {
          usage.push(old);
          continue;
        }
        const out = await session
          .exec(`bash -lc ${sh(tenantSizesCommand(d.name))}`, { timeoutMs: 120_000 })
          .catch(() => null);
        if (out?.code === 0)
          usage.push({ db: d.name, at: new Date().toISOString(), tenants: parseTenantSizes(out.stdout) });
        else if (old) usage.push(old);
      }
      metrics.tenantUsage = usage;
    }
    return { ok: true, metrics, hostKey: session.hostKey };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    session?.close();
  }
}

export type Notify = (html: string) => Promise<void>;

/** Ogohlantirishlar super adminlarga Telegram orqali (deploy xabarlari bilan bir xil yo'l) */
export function createServerNotifier(deps: { db: PanelDb; telegram: Telegram }): Notify {
  return (html) => notifySuperAdmins(deps, html);
}

const ALERT_TEXT: Record<AlertEvent, (name: string, m?: ServerMetrics) => string> = {
  offline: (n) => `🔴 <b>Server javob bermayapti</b>: ${n}`,
  online: (n) => `🟢 <b>Server qayta ishlayapti</b>: ${n}`,
  disk: (n, m) => `💽 <b>Disk to'lmoqda</b>: ${n} — ${m?.diskUsedGb} / ${m?.diskTotalGb} GB`,
  memory: (n, m) => `🧠 <b>Xotira to'lmoqda</b>: ${n} — ${m?.memUsedMb} / ${m?.memTotalMb} MB`,
};

const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(2);

/** So'rov natijasini saqlaydi: joriy holat, tarix qatori va ogohlantirishlar (faqat holat o'zgarganda). */
export async function recordProbe(db: PanelDb, server: ServerRow, result: ProbeResult, notify?: Notify) {
  const next = nextAlerts(server.alerts, result.ok ? { ok: true, metrics: result.metrics } : { ok: false });
  const { events } = next;
  // Bazalar hajmi: ro'yxat kelmagan bo'lsa oldingi holat saqlanadi
  const dbAlert =
    result.ok && result.metrics.databases ? nextDbAlerts(server.alerts.databases, result.metrics.databases) : null;
  // Loyihalar joy limiti (ADR 0059): limit loyiha sozlamasida (`settings.dbQuotaGb`)
  let quotaAlert: { over: string[]; newly: string[] } | null = null;
  let quotaNames = new Map<string, string>();
  if (result.ok && result.metrics.databases) {
    const list = await db
      .select({
        slug: projects.slug,
        name: projects.name,
        templateKey: projects.templateKey,
        dbStrategy: projects.dbStrategy,
        settings: projects.settings,
      })
      .from(projects)
      .where(and(eq(projects.serverId, server.id), isNull(projects.deletedAt)));
    quotaNames = new Map(list.map((p) => [p.slug, p.name]));
    quotaAlert = nextQuotaAlerts(
      server.alerts.quotas,
      list.map((p) => ({
        slug: p.slug,
        usage: projectUsage(p, result.metrics.databases, result.metrics.tenantUsage),
        quotaBytes: quotaBytesOf(p.settings),
      })),
    );
  }
  const alerts = {
    ...next.alerts,
    databases: dbAlert ? dbAlert.over : server.alerts.databases,
    quotas: quotaAlert ? quotaAlert.over : server.alerts.quotas,
  };
  const now = new Date();
  await db
    .update(servers)
    .set({
      probeAt: now,
      probeError: result.ok ? null : result.error,
      alerts,
      ...(result.ok
        ? {
            metrics: result.metrics,
            metricsAt: now,
            lastSeenAt: now,
            ...(server.hostKey ? {} : { hostKey: result.hostKey }),
          }
        : {}),
    })
    .where(eq(servers.id, server.id));
  if (result.ok) {
    const m = result.metrics;
    await db.insert(serverMetrics).values({
      serverId: server.id,
      at: now,
      cpuPercent: m.cpuPercent,
      memUsedMb: m.memUsedMb,
      memTotalMb: m.memTotalMb,
      diskUsedGb: m.diskUsedGb,
      diskTotalGb: m.diskTotalGb,
      load1: m.load[0],
    });
  }
  const dbLines = (dbAlert?.newly ?? []).map(
    (d) => `🗄 <b>Baza kattalashdi</b>: ${escapeHtml(server.name)} — ${escapeHtml(d.name)}, ${gb(d.sizeBytes)} GB`,
  );
  const quotaLines = (quotaAlert?.newly ?? []).map(
    (s) => `📦 <b>Loyiha joy limitidan oshdi</b>: ${escapeHtml(quotaNames.get(s) ?? s)} (${escapeHtml(server.name)})`,
  );
  if ((events.length || dbLines.length || quotaLines.length) && notify) {
    const text = [
      ...events.map((e) => ALERT_TEXT[e](escapeHtml(server.name), result.ok ? result.metrics : undefined)),
      ...dbLines,
      ...quotaLines,
    ].join("\n");
    await notify(text).catch((e: Error) => console.error("[monitor] telegram:", e.message));
  }
  return events;
}

/** Hamma serverlar: parallel so'rov, natijani saqlash va eski tarixni tozalash. */
export async function monitorServers(db: PanelDb, notify?: Notify) {
  const rows = await db.select().from(servers);
  await Promise.all(rows.map(async (s) => recordProbe(db, s, await probeServer(db, s), notify)));
  const cutoff = new Date(Date.now() - METRICS_RETENTION_DAYS * 24 * 3_600_000);
  await db.delete(serverMetrics).where(lt(serverMetrics.at, cutoff));
  return rows.length;
}

/* ---------- Paneldan buyruqlar ---------- */

const APP_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

const COMMANDS: Record<"reload" | "stop" | "start", (app: string) => string> = {
  reload: (app) => `pm2 reload ${sh(app)} --update-env`,
  stop: (app) => `pm2 stop ${sh(app)}`,
  start: (app) => `pm2 start ${sh(app)}`,
};

async function setLastAction(db: PanelDb, serverId: string, action: ServerLastAction) {
  await db.update(servers).set({ lastAction: action }).where(eq(servers.id, serverId));
}

/** Panel: buyruqni navbatga qo'yadi (bajarish — ishchi jarayonda). */
export async function enqueueServerJob(db: PanelDb, queue: Queue, data: ServerJobData) {
  await setLastAction(db, data.serverId, {
    kind: data.kind,
    ...(data.app ? { app: data.app } : {}),
    ...(data.database ? { database: data.database } : {}),
    ...(data.project ? { project: data.project } : {}),
    status: "queued",
    by: data.actor.name ?? undefined,
    at: new Date().toISOString(),
  });
  const id = await queue.send(SERVER_QUEUE, data, {
    singletonKey: `${data.serverId}:${data.kind}:${data.app ?? data.database ?? data.projectId ?? ""}`,
  });
  if (!id) throw new Error("Vazifa navbatga qo'shilmadi");
}

/** Ishchi jarayon: bitta buyruqni bajaradi, natijani serverga va faoliyat jurnaliga yozadi. */
export async function runServerJob(db: PanelDb, data: ServerJobData, notify?: Notify): Promise<ServerLastAction> {
  const [server] = await db.select().from(servers).where(eq(servers.id, data.serverId));
  const base = {
    kind: data.kind,
    ...(data.app ? { app: data.app } : {}),
    ...(data.database ? { database: data.database } : {}),
    ...(data.project ? { project: data.project } : {}),
    by: data.actor.name ?? undefined,
  };
  if (!server) return { ...base, status: "error", message: "Server topilmadi", at: new Date().toISOString() };
  await setLastAction(db, server.id, { ...base, status: "running", at: new Date().toISOString() });

  let status: ServerLastAction["status"] = "ok";
  let message: string | undefined;
  if (data.kind === "check") {
    const check = await checkServer(db, server, data.actor);
    if (!check.ok) {
      status = "error";
      message = check.error ?? `Yetishmaydi: ${check.missing.join(", ")}`;
    }
    const [fresh] = await db.select().from(servers).where(eq(servers.id, server.id));
    await recordProbe(db, fresh ?? server, await probeServer(db, fresh ?? server), notify);
  } else if (data.kind === "db_create") {
    const res = await createDatabase(db, server, data.database ?? "");
    if (!res.ok) {
      status = "error";
      message = res.error;
    }
    await audit.record(db, {
      actor: data.actor,
      action: "database.create",
      target: { type: "server", id: server.id },
      metadata: { database: data.database, ok: res.ok, ...(res.ok ? {} : { error: res.error }) },
    });
    // Ro'yxat va hajm darhol yangilansin
    if (res.ok) await recordProbe(db, server, await probeServer(db, server), notify);
  } else if (data.kind === "db_move") {
    const res = await moveProjectDb(db, server, data.projectId ?? "", data.target === "shared" ? "shared" : "own");
    if (!res.ok) {
      status = "error";
      message = res.error;
    } else message = res.detail;
    await audit.record(db, {
      actor: data.actor,
      action: "project.db_move",
      target: { type: "project", id: data.projectId ?? "" },
      metadata: {
        server: server.name,
        project: data.project,
        target: data.target,
        ok: res.ok,
        ...(res.ok ? { detail: res.detail } : { error: res.error }),
      },
    });
    await recordProbe(db, server, await probeServer(db, server), notify);
  } else if (data.kind === "db_drop" || data.kind === "project_purge") {
    // Qaytarib bo'lmaydigan amallar (ADR 0058): faqat super admin navbatga qo'yadi
    const res =
      data.kind === "db_drop"
        ? await dropDatabase(db, server, data.database ?? "")
        : await purgeProject(db, server, data.projectId ?? "");
    if (!res.ok) {
      status = "error";
      message = res.error;
    } else if (res.detail) message = res.detail;
    await audit.record(db, {
      actor: data.actor,
      action: data.kind === "db_drop" ? "database.drop" : "project.purge",
      target:
        data.kind === "db_drop" ? { type: "server", id: server.id } : { type: "project", id: data.projectId ?? "" },
      metadata: {
        server: server.name,
        ...(data.database ? { database: data.database } : {}),
        ...(data.project ? { project: data.project } : {}),
        ok: res.ok,
        ...(res.ok ? { detail: res.detail } : { error: res.error }),
      },
    });
    if (res.ok) await recordProbe(db, server, await probeServer(db, server), notify);
  } else if (data.kind === "power_on" || data.kind === "power_off") {
    // Uydagi WSL server (ADR 0025): faqat shu Windows kompyuteridagi ishchi boshqaradi
    const blocked = wslControlError(server);
    if (blocked) {
      status = "error";
      message = blocked;
    } else {
      try {
        if (data.kind === "power_on") {
          wslStart(server);
          if (!(await waitForPort(server.host, server.sshPort, 90_000))) {
            status = "error";
            message = "WSL yondi, lekin SSH 90 soniyada javob bermadi";
          }
        } else {
          await wslStop(server);
        }
      } catch (e) {
        status = "error";
        message = (e as Error).message;
      }
    }
    await audit.record(db, {
      actor: data.actor,
      action: `server.${data.kind}`,
      target: { type: "server", id: server.id },
      metadata: { distro: server.wslDistro, ok: status === "ok", ...(message ? { error: message } : {}) },
    });
    // Holat darhol yangilansin (yoqilgan bo'lsa — metrika, o'chirilgan bo'lsa — oflayn)
    if (status === "ok") await recordProbe(db, server, await probeServer(db, server), notify);
  } else {
    const kind = data.kind;
    const app = data.app ?? "";
    const [known] = APP_NAME.test(app)
      ? await db
          .select({ id: apps.id })
          .from(apps)
          .where(and(eq(apps.serverId, server.id), eq(apps.name, app)))
      : [];
    if (!known) {
      status = "error";
      message = "Bu serverda bunday ilova yo'q";
    } else {
      let session;
      try {
        session = await openSession(db, server);
        const out = await session.exec(`bash -lc ${sh(COMMANDS[kind](app))}`, { timeoutMs: 60_000 });
        if (out.code !== 0) {
          status = "error";
          message = out.stderr.trim().split("\n").pop() || `Kod ${out.code}`;
        }
      } catch (e) {
        status = "error";
        message = (e as Error).message;
      } finally {
        session?.close();
      }
      await audit.record(db, {
        actor: data.actor,
        action: `server.app_${kind}`,
        target: { type: "server", id: server.id },
        metadata: { app, ok: status === "ok", ...(message ? { error: message } : {}) },
      });
      // Jarayonlar holati darhol yangilansin
      await recordProbe(db, server, await probeServer(db, server), notify);
    }
  }
  const result: ServerLastAction = { ...base, status, ...(message ? { message } : {}), at: new Date().toISOString() };
  await setLastAction(db, server.id, result);
  return result;
}

/* ---------- Bazalar (ADR 0057) ---------- */

/**
 * Yangi bo'sh baza va uning roli (nomi bir xil). `ventura-db ensure` bor bazaning parolini paneldagi qiymatga
 * tenglashtiradi — shuning uchun serverda bor yoki loyiha ishlatadigan nom rad etiladi (ishlab turgan ilovaning
 * paroli buzilmasin). Parol server sirlarida (`db:<nom>`).
 */
export async function createDatabase(
  db: PanelDb,
  server: ServerRow,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!DB_NAME_RE.test(name) || SYSTEM_DATABASES.has(name)) return { ok: false, error: "Baza nomi noto'g'ri" };
  const used = await db
    .select({ slug: projects.slug, templateKey: projects.templateKey, dbStrategy: projects.dbStrategy })
    .from(projects)
    .where(eq(projects.serverId, server.id));
  if (used.some((p) => dbNameFor(p.templateKey, p.slug, p.dbStrategy) === name)) {
    return { ok: false, error: "Bu nomdagi bazani loyiha ishlatadi" };
  }
  const pw = dbPasswordOwner("manual", { serverId: server.id }, name);
  let session;
  try {
    session = await openSession(db, server);
    const list = await session.exec(`bash -lc ${sh(DB_LIST_COMMAND)}`, { timeoutMs: 20_000 });
    if (list.code !== 0) return { ok: false, error: "Serverdagi ventura-db eski: setup.sh ni qayta ishga tushiring" };
    if (parseDbList(list.stdout).some((d) => d.name === name))
      return { ok: false, error: "Bu nomdagi baza serverda bor" };
    const password = (await readSecret(db, pw.owner, pw.name)) ?? randomBytes(32).toString("base64url");
    if (!DB_PASSWORD_RE.test(password)) return { ok: false, error: "Baza paroli noto'g'ri" };
    await putSecret(db, pw.owner, pw.name, password);
    const out = await session.exec(`bash -lc ${sh(`sudo -n /usr/local/sbin/ventura-db ensure ${name} ${name}`)}`, {
      timeoutMs: 60_000,
      input: `${password}\n`,
    });
    if (out.code !== 0) return { ok: false, error: out.stderr.trim().split("\n").pop() || `Kod ${out.code}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    session?.close();
  }
}

/* ---------- O'chirish ---------- */

export type DeleteServerResult = { ok: true } | { ok: false; reason: "not_found" | "in_use" };

/** Serverni ro'yxatdan o'chiradi: faqat unda loyiha va ilova bo'lmasa. Kalit (sir) ham o'chadi. */
export async function deleteServer(db: PanelDb, serverId: string, actor: AuditActor): Promise<DeleteServerResult> {
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId));
  if (!server) return { ok: false, reason: "not_found" };
  const [[p], [a]] = await Promise.all([
    db.select({ id: projects.id }).from(projects).where(eq(projects.serverId, serverId)).limit(1),
    db.select({ id: apps.id }).from(apps).where(eq(apps.serverId, serverId)).limit(1),
  ]);
  if (p || a) return { ok: false, reason: "in_use" };
  await db.delete(servers).where(eq(servers.id, serverId));
  await deleteSecrets(db, { type: "server", id: serverId });
  await audit.record(db, {
    actor,
    action: "server.delete",
    target: { type: "server", id: serverId },
    metadata: { name: server.name, host: server.host },
  });
  return { ok: true };
}
