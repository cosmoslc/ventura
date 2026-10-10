import "server-only";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { clients, domains, projects, templates } from "@ventura/db/schema/panel";
import { deps } from "./deps";

export interface ProjectListRow {
  id: string;
  name: string;
  slug: string;
  clientName: string;
  templateName: string;
  domain: string | null;
  mode: (typeof projects.$inferSelect)["mode"];
  target: (typeof projects.$inferSelect)["target"];
  status: (typeof projects.$inferSelect)["status"];
  primary: string;
  createdAt: string;
  deletedAt: string | null;
}

export async function listProjects(trashed: boolean): Promise<ProjectListRow[]> {
  const { db } = deps();
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      clientName: clients.name,
      templateName: templates.name,
      domain: domains.hostname,
      mode: projects.mode,
      target: projects.target,
      status: projects.status,
      brand: projects.brand,
      createdAt: projects.createdAt,
      deletedAt: projects.deletedAt,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .innerJoin(templates, eq(templates.key, projects.templateKey))
    .leftJoin(domains, and(eq(domains.projectId, projects.id), eq(domains.isPrimary, true)))
    .where(trashed ? isNotNull(projects.deletedAt) : isNull(projects.deletedAt))
    .orderBy(desc(trashed ? projects.deletedAt : projects.createdAt));
  return rows.map(({ brand, ...r }) => ({
    ...r,
    primary: brand.primary,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null,
  }));
}
