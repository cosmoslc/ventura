import { and, eq, lt } from "drizzle-orm";
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
import { type AuditActor, audit, deleteSecrets } from "@ventura/security";
import { type AlertEvent, METRICS_SCRIPT, nextAlerts, parseMetrics } from "./metrics";
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
    return { ok: true, metrics: parseMetrics(out.stdout), hostKey: session.hostKey };
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

/** So'rov natijasini saqlaydi: joriy holat, tarix qatori va ogohlantirishlar (faqat holat o'zgarganda). */
export async function recordProbe(db: PanelDb, server: ServerRow, result: ProbeResult, notify?: Notify) {
  const { alerts, events } = nextAlerts(
    server.alerts,
    result.ok ? { ok: true, metrics: result.metrics } : { ok: false },
  );
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
  if (events.length && notify) {
    const text = events
      .map((e) => ALERT_TEXT[e](escapeHtml(server.name), result.ok ? result.metrics : undefined))
      .join("\n");
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
    status: "queued",
    by: data.actor.name ?? undefined,
    at: new Date().toISOString(),
  });
  const id = await queue.send(SERVER_QUEUE, data, { singletonKey: `${data.serverId}:${data.kind}:${data.app ?? ""}` });
  if (!id) throw new Error("Vazifa navbatga qo'shilmadi");
}

/** Ishchi jarayon: bitta buyruqni bajaradi, natijani serverga va faoliyat jurnaliga yozadi. */
export async function runServerJob(db: PanelDb, data: ServerJobData, notify?: Notify): Promise<ServerLastAction> {
  const [server] = await db.select().from(servers).where(eq(servers.id, data.serverId));
  const base = {
    kind: data.kind,
    ...(data.app ? { app: data.app } : {}),
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
        const out = await session.exec(`bash -lc ${sh(COMMANDS[data.kind](app))}`, { timeoutMs: 60_000 });
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
        action: `server.app_${data.kind}`,
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
