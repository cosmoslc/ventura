import { and, asc, eq, isNull, like } from "drizzle-orm";
import { can } from "@ventura/auth";
import { projects, secrets, servers } from "@ventura/db/schema/panel";
import { DB_SIZE_ALERT_BYTES, dbNameFor, serverState } from "@ventura/deploy";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { type DbRow, DatabasesView, type ServerBlock } from "./databases-view";

export const metadata = { title: `${uz.databases.title} · ${uz.app.name}` };

/**
 * Bazalar (ADR 0057): har serverdagi PostgreSQL bazalari — turi, qaysi loyihalar ishlatadi, hajmi va ulanishlar.
 * Ro'yxat va hajm har daqiqalik metrika so'rovidan (server `ventura-db list`); bog'lanish — panel ma'lumotidan.
 */
export default async function DatabasesPage() {
  const viewer = await requireViewer();
  const { db } = deps();
  const [serverRows, projectRows, dbSecrets] = await Promise.all([
    db.select().from(servers).orderBy(asc(servers.name)),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        templateKey: projects.templateKey,
        dbStrategy: projects.dbStrategy,
        serverId: projects.serverId,
      })
      .from(projects)
      .where(isNull(projects.deletedAt)),
    db
      .select({ ownerId: secrets.ownerId, name: secrets.name })
      .from(secrets)
      .where(and(eq(secrets.ownerType, "server"), like(secrets.name, "db:%"))),
  ]);

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
        projects: users.map((p) => ({ id: p.id, name: p.name })),
        sizeBytes: d.sizeBytes,
        connections: d.connections,
        missing: false,
        large: d.sizeBytes >= DB_SIZE_ALERT_BYTES,
      };
    });
    // Loyiha kutayotgan, lekin serverda topilmagan baza (deploy qilinmagan yoki o'chirilgan)
    if (live) {
      for (const [name, users] of byDb) {
        if (seen.has(name)) continue;
        rows.push({
          name,
          kind: users.some((p) => p.dbStrategy === "shared_db") ? "shared" : "project",
          projects: users.map((p) => ({ id: p.id, name: p.name })),
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
      lastAction: s.lastAction?.kind === "db_create" ? s.lastAction : null,
      rows: rows.sort((a, b) => b.sizeBytes - a.sizeBytes || a.name.localeCompare(b.name)),
    };
  });

  return (
    <DatabasesView
      servers={blocks}
      canCreate={can(viewer.role, "servers.manage")}
      canReveal={viewer.role === "super_admin"}
      alertBytes={DB_SIZE_ALERT_BYTES}
    />
  );
}
