import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { can } from "@ventura/auth";
import { projects, servers } from "@ventura/db/schema/panel";
import { DB_NAME_RE, dbNameFor, projectUsage, quotaBytesOf } from "@ventura/deploy";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { DatabaseProfile } from "./profile-view";

export const metadata = { title: `${uz.databases.title} · ${uz.app.name}` };

/**
 * Baza profili (ADR 0059): bazadagi loyihalar, har biri egallagan joy va limiti. Umumiy bazada mijoz hajmi soatiga bir
 * marta yig'iladi (qatorlar hajmi, indekslarsiz — taxminiy); alohida bazada — butun baza hajmi.
 */
export default async function DatabaseProfilePage({ params }: { params: Promise<{ serverId: string; name: string }> }) {
  const viewer = await requireViewer();
  const { serverId, name } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(serverId) || !DB_NAME_RE.test(name)) notFound();
  const { db } = deps();
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId));
  if (!server) notFound();
  const live = server.metrics?.databases?.find((d) => d.name === name) ?? null;

  const list = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      templateKey: projects.templateKey,
      dbStrategy: projects.dbStrategy,
      status: projects.status,
      settings: projects.settings,
    })
    .from(projects)
    .where(and(eq(projects.serverId, serverId), isNull(projects.deletedAt)))
    .orderBy(asc(projects.name));
  const mine = list.filter((p) => dbNameFor(p.templateKey, p.slug, p.dbStrategy) === name);
  if (!live && !mine.length) notFound();
  const usage = server.metrics?.tenantUsage?.find((u) => u.db === name) ?? null;

  return (
    <DatabaseProfile
      server={{ id: server.id, name: server.name }}
      database={{
        name,
        shared: name.endsWith("_shared"),
        sizeBytes: live?.sizeBytes ?? null,
        connections: live?.connections ?? null,
        usageAt: usage?.at ?? null,
      }}
      projects={mine.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        dbStrategy: p.dbStrategy,
        status: p.status,
        usage: projectUsage(p, server.metrics?.databases, server.metrics?.tenantUsage),
        quotaBytes: quotaBytesOf(p.settings),
      }))}
      canEdit={can(viewer.role, "projects.write")}
      canMove={viewer.role === "super_admin"}
      moveAction={server.lastAction?.kind === "db_move" ? server.lastAction : null}
    />
  );
}
