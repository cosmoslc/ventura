import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { can } from "@ventura/auth";
import { clients, projects } from "@ventura/db/schema/panel";
import { PageHeader } from "@ventura/ui/page-header";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ClientsView } from "./clients-view";

export const metadata = { title: `${uz.clients.title} · ${uz.app.name}` };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ yangi?: string }> }) {
  const viewer = await requireViewer();
  const { db } = deps();
  const { yangi } = await searchParams;

  // Savatdagi loyihalar sanalmaydi
  const pc = db
    .select({ clientId: projects.clientId, n: count().as("n") })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .groupBy(projects.clientId)
    .as("pc");

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      company: clients.company,
      note: clients.note,
      status: clients.status,
      createdAt: clients.createdAt,
      projects: sql<number>`coalesce(${pc.n}, 0)`.mapWith(Number),
    })
    .from(clients)
    .leftJoin(pc, eq(pc.clientId, clients.id))
    .orderBy(desc(clients.createdAt));

  return (
    <>
      <PageHeader title={uz.clients.title} description={uz.clients.description} />
      <ClientsView
        rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
        canWrite={can(viewer.role, "clients.write")}
        openNew={yangi === "1"}
      />
    </>
  );
}
