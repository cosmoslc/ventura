import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { can } from "@ventura/auth";
import { clients, domains, projectFeatures, projects, templates } from "@ventura/db/schema/panel";
import { providerFor } from "@ventura/deploy";
import { hasSecret } from "@ventura/security";
import type { Feature } from "@ventura/tenants";
import { Badge } from "@ventura/ui/badge";
import { PageHeader } from "@ventura/ui/page-header";
import { listDeployments, workerAlive } from "@/lib/server/deployments-query";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ProjectEditor } from "./editor";

const STATUS_TONE = { draft: "neutral", active: "success", paused: "warning" } as const;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = deps();

  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!p) notFound();

  const owner = { type: "project", id };
  const [tpl, cls, feats, doms, ownerPassword, telegramToken, deployRows, alive] = await Promise.all([
    db.select().from(templates).where(eq(templates.key, p.templateKey)).limit(1),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    db.select().from(projectFeatures).where(eq(projectFeatures.projectId, id)),
    db.select().from(domains).where(eq(domains.projectId, id)).orderBy(asc(domains.createdAt)),
    hasSecret(db, owner, "owner_password"),
    hasSecret(db, owner, "telegram_bot_token"),
    listDeployments(id),
    workerAlive(),
  ]);
  const primary = doms.find((d) => d.isPrimary) ?? doms[0];

  return (
    <>
      <PageHeader
        title={p.name}
        description={primary?.hostname}
        actions={
          <Badge tone={STATUS_TONE[p.status]} dot>
            {uz.projects.statusLabels[p.status]}
          </Badge>
        }
      />
      <ProjectEditor
        canWrite={can(viewer.role, "projects.write")}
        project={{
          id: p.id,
          name: p.name,
          slug: p.slug,
          clientId: p.clientId,
          status: p.status,
          mode: p.mode,
          target: p.target,
          dbStrategy: p.dbStrategy,
          brand: p.brand,
          ownerName: p.ownerName,
          ownerPhone: p.ownerPhone,
          templateName: tpl[0]?.name ?? p.templateKey,
        }}
        clients={cls}
        features={(tpl[0]?.manifest as Feature[] | undefined) ?? []}
        enabled={feats.filter((f) => f.enabled).map((f) => f.featureKey)}
        domains={doms.map((d) => ({ hostname: d.hostname, kind: d.kind, isPrimary: d.isPrimary, status: d.status }))}
        secrets={{ ownerPassword, telegramToken }}
        deploys={{
          rows: deployRows,
          workerAlive: alive,
          simulated: providerFor() === "sim",
          canDeploy: can(viewer.role, "projects.deploy"),
        }}
      />
    </>
  );
}
