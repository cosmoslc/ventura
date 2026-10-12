import "server-only";
import { and, asc, count, eq, gte, isNull } from "drizzle-orm";
import { type ServerState, serverState } from "@ventura/deploy";
import {
  type ServerInfo,
  type ServerLastAction,
  type ServerMetrics,
  apps,
  domains,
  projects,
  serverMetrics,
  servers,
} from "@ventura/db/schema/panel";
import { deps } from "./deps";

/* Serverlar sahifasi uchun so'rovlar. Yopiq kalit va sirlar bu yerda o'qilmaydi. */

export interface ServerCard {
  id: string;
  name: string;
  kind: "home" | "online";
  host: string;
  sshPort: number;
  sshUser: string;
  status: "new" | "ready" | "error";
  state: ServerState;
  metrics: ServerMetrics | null;
  metricsAt: string | null;
  probeError: string | null;
  lastError: string | null;
  projects: number;
  apps: string[];
}

function toCard(s: typeof servers.$inferSelect, projectCount: number, appNames: string[]): ServerCard {
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    host: s.host,
    sshPort: s.sshPort,
    sshUser: s.sshUser,
    status: s.status,
    state: serverState(s),
    metrics: s.metrics ?? null,
    metricsAt: s.metricsAt?.toISOString() ?? null,
    probeError: s.probeError,
    lastError: s.lastError,
    projects: projectCount,
    apps: appNames,
  };
}

export async function listServers(): Promise<ServerCard[]> {
  const { db } = deps();
  const [rows, pc, appRows] = await Promise.all([
    db.select().from(servers).orderBy(asc(servers.createdAt)),
    db
      .select({ serverId: projects.serverId, n: count() })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .groupBy(projects.serverId),
    db.select({ serverId: apps.serverId, name: apps.name }).from(apps),
  ]);
  return rows.map((s) =>
    toCard(
      s,
      pc.find((p) => p.serverId === s.id)?.n ?? 0,
      appRows.filter((a) => a.serverId === s.id).map((a) => a.name),
    ),
  );
}

export interface ServerDetail extends ServerCard {
  info: ServerInfo;
  hostKey: string | null;
  publicKey: string;
  lastAction: ServerLastAction | null;
  history: { at: number; cpu: number; mem: number }[];
  projectRows: { id: string; name: string; slug: string; status: string; domain: string | null }[];
}

export async function getServer(id: string): Promise<ServerDetail | null> {
  const { db } = deps();
  const [s] = await db.select().from(servers).where(eq(servers.id, id));
  if (!s) return null;
  const since = new Date(Date.now() - 24 * 3_600_000);
  const [history, projectRows, appRows] = await Promise.all([
    db
      .select({
        at: serverMetrics.at,
        cpu: serverMetrics.cpuPercent,
        used: serverMetrics.memUsedMb,
        total: serverMetrics.memTotalMb,
      })
      .from(serverMetrics)
      .where(and(eq(serverMetrics.serverId, id), gte(serverMetrics.at, since)))
      .orderBy(asc(serverMetrics.at)),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        domain: domains.hostname,
      })
      .from(projects)
      .leftJoin(domains, and(eq(domains.projectId, projects.id), eq(domains.kind, "subdomain")))
      .where(and(eq(projects.serverId, id), isNull(projects.deletedAt)))
      .orderBy(asc(projects.name)),
    db.select({ name: apps.name }).from(apps).where(eq(apps.serverId, id)),
  ]);
  // Bitta loyihaga bir nechta domen bo'lsa — birinchisi
  const seen = new Set<string>();
  const uniqueProjects = projectRows.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  return {
    ...toCard(
      s,
      uniqueProjects.length,
      appRows.map((a) => a.name),
    ),
    info: s.info,
    hostKey: s.hostKey,
    publicKey: s.publicKey,
    lastAction: s.lastAction ?? null,
    history: history.map((h) => ({
      at: h.at.getTime(),
      cpu: h.cpu,
      mem: h.total > 0 ? Math.round((h.used / h.total) * 1000) / 10 : 0,
    })),
    projectRows: uniqueProjects,
  };
}
