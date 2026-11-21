import { and, asc, eq, isNull, like } from "drizzle-orm";
import { can } from "@ventura/auth";
import { projects, secrets, servers } from "@ventura/db/schema/panel";
import {
  DB_SIZE_ALERT_BYTES,
  dbNameFor,
  getSupabaseDatabaseUsage,
  listSupabaseProjects,
  serverState,
  type SupabaseProject,
} from "@ventura/deploy";
import { readSecret } from "@ventura/security";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import {
  type DbRow,
  DatabasesView,
  type ServerBlock,
  type SupabaseBlock,
  type ProjectDatabaseInfo,
} from "./databases-view";

export const metadata = { title: `${uz.databases.title} · ${uz.app.name}` };

const SYSTEM_OWNER = { type: "system", id: "00000000-0000-0000-0000-000000000000" };
const SUPABASE_TOKEN_KEY = "supabase:token";

/**
 * Bazalar (ADR 0057, ADR 0060): VPS va Supabase PostgreSQL bazalari.
 * 1. VPS PostgreSQL bazalari: mahalliy serverdagi bazalar va ulanishlar.
 * 2. Supabase PostgreSQL bazalari: Management API orqali loyihalar, mintaqalar va ulangan markazlar.
 */
export default async function DatabasesPage() {
  const viewer = await requireViewer();
  const { db } = deps();
  const [serverRows, projectRows, dbSecrets, supaToken] = await Promise.all([
    db.select().from(servers).orderBy(asc(servers.name)),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        templateKey: projects.templateKey,
        dbStrategy: projects.dbStrategy,
        serverId: projects.serverId,
        settings: projects.settings,
      })
      .from(projects)
      .where(isNull(projects.deletedAt)),
    db
      .select({ ownerId: secrets.ownerId, name: secrets.name })
      .from(secrets)
      .where(and(eq(secrets.ownerType, "server"), like(secrets.name, "db:%"))),
    readSecret(db, SYSTEM_OWNER, SUPABASE_TOKEN_KEY),
  ]);

  let supabaseProjects: SupabaseProject[] = [];
  let supabaseError: string | null = null;

  if (supaToken) {
    try {
      const rawProjects = await listSupabaseProjects(supaToken);
      const usages = await Promise.allSettled(
        rawProjects.map((p) =>
          p.status === "ACTIVE_HEALTHY" ? getSupabaseDatabaseUsage(supaToken, p.id) : Promise.resolve(null),
        ),
      );
      supabaseProjects = rawProjects.map((p, idx) => {
        const u = usages[idx]?.status === "fulfilled" ? usages[idx]?.value : null;
        return {
          ...p,
          sizeBytes: u?.sizeBytes ?? null,
          tableCount: u?.tableCount ?? null,
        };
      });
    } catch (e) {
      supabaseError = (e as Error).message;
    }
  }

  const allProjects: ProjectDatabaseInfo[] = projectRows.map((p) => {
    const s = p.settings as {
      supabase?: { projectRef: string; projectName: string; projectUrl: string; mode: string };
    };
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      templateKey: p.templateKey,
      dbStrategy: p.dbStrategy,
      serverId: p.serverId,
      supabase: s?.supabase ?? null,
    };
  });

  const blocks: ServerBlock[] = serverRows.map((s) => {
    const mine = projectRows.filter((p) => p.serverId === s.id);
    const byDb = new Map<string, typeof mine>();
    for (const p of mine) {
      const name = dbNameFor(p.templateKey, p.slug, p.dbStrategy);
      byDb.set(name, [...(byDb.get(name) ?? []), p]);
    }
    const manual = new Set(dbSecrets.filter((x) => x.ownerId === s.id).map((x) => x.name.slice(3)));
    const live = s.metrics?.databases;
    const seen = new Set<string>();
    const rows: DbRow[] = (live ?? []).map((d) => {
      seen.add(d.name);
      const users = byDb.get(d.name) ?? [];
      const kind: DbRow["kind"] = users.length
        ? users.some((p) => p.dbStrategy === "shared_db")
          ? "shared"
          : "project"
        : manual.has(d.name)
          ? "manual"
          : "other";
      return {
        name: d.name,
        kind,
        projects: users.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          isSupabase: !!(p.settings as { supabase?: unknown })?.supabase,
        })),
        sizeBytes: d.sizeBytes,
        connections: d.connections,
        missing: false,
        large: d.sizeBytes >= DB_SIZE_ALERT_BYTES,
      };
    });

    if (live) {
      for (const [name, users] of byDb) {
        if (seen.has(name)) continue;
        rows.push({
          name,
          kind: users.some((p) => p.dbStrategy === "shared_db") ? "shared" : "project",
          projects: users.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            isSupabase: !!(p.settings as { supabase?: unknown })?.supabase,
          })),
          sizeBytes: 0,
          connections: 0,
          missing: true,
          large: false,
        });
      }
    }
    return {
      id: s.id,
      name: s.name,
      host: s.host,
      online: serverState(s) === "online",
      metricsAt: s.metricsAt?.toISOString() ?? null,
      diskUsedGb: s.metrics?.diskUsedGb ?? null,
      diskTotalGb: s.metrics?.diskTotalGb ?? null,
      listError: live ? null : (s.metrics?.databasesError ?? null),
      hasList: !!live,
      lastAction:
        s.lastAction?.kind === "db_create" ||
        s.lastAction?.kind === "db_drop" ||
        s.lastAction?.kind === "db_move" ||
        s.lastAction?.kind === "db_move_supabase"
          ? s.lastAction
          : null,
      rows: rows.sort((a, b) => b.sizeBytes - a.sizeBytes || a.name.localeCompare(b.name)),
    };
  });

  const supabaseBlock: SupabaseBlock = {
    hasToken: !!supaToken,
    tokenPreview: supaToken
      ? supaToken.length > 8
        ? `${supaToken.slice(0, 4)}...${supaToken.slice(-4)}`
        : "••••••••"
      : null,
    projects: supabaseProjects,
    error: supabaseError,
  };

  return (
    <DatabasesView
      servers={blocks}
      supabase={supabaseBlock}
      allProjects={allProjects}
      canCreate={can(viewer.role, "servers.manage")}
      canReveal={viewer.role === "super_admin"}
      alertBytes={DB_SIZE_ALERT_BYTES}
    />
  );
}
