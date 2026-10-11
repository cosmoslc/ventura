import { count, desc, isNotNull, isNull } from "drizzle-orm";
import { Activity, FolderKanban, Plus, Trash2, Users, UserCog } from "lucide-react";
import Link from "next/link";
import { can } from "@ventura/auth";
import { auditEvents, clients, projects, users } from "@ventura/db/schema/panel";
import { Button } from "@ventura/ui/button";
import { Card, CardHeader, CardTitle } from "@ventura/ui/card";
import { StatCard } from "@ventura/ui/stat-card";
import { EmptyState, PageHeader } from "@/components/page-header";
import { AuditRow } from "@/components/audit-row";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

export const metadata = { title: `${uz.dashboard.title} · ${uz.app.name}` };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ ruxsat?: string }> }) {
  const viewer = await requireViewer();
  const { db } = deps();
  const { ruxsat } = await searchParams;

  const [[active], [trash], [clientCount], [adminCount], recent] = await Promise.all([
    db.select({ n: count() }).from(projects).where(isNull(projects.deletedAt)),
    db.select({ n: count() }).from(projects).where(isNotNull(projects.deletedAt)),
    db.select({ n: count() }).from(clients),
    db.select({ n: count() }).from(users),
    db.select().from(auditEvents).orderBy(desc(auditEvents.seq)).limit(10),
  ]);

  return (
    <>
      <PageHeader
        title={uz.dashboard.greeting(viewer.name.split(" ")[0] ?? viewer.name)}
        description={ruxsat === "yoq" ? uz.dashboard.noPermission : uz.app.subtitle}
        actions={
          can(viewer.role, "projects.write") ? (
            <>
              <Button variant="ghost" asChild>
                <Link href="/clients?yangi=1">
                  <Users /> {uz.dashboard.quickNewClient}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/projects/new">
                  <Plus /> {uz.dashboard.quickNewProject}
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3.5 min-[560px]:grid-cols-2 min-[1200px]:grid-cols-4">
        <StatCard icon={<FolderKanban />} label={uz.dashboard.activeProjects} value={String(active?.n ?? 0)} tone={1} />
        <StatCard icon={<Users />} label={uz.dashboard.clients} value={String(clientCount?.n ?? 0)} tone={2} />
        <StatCard icon={<Trash2 />} label={uz.dashboard.trash} value={String(trash?.n ?? 0)} tone={3} />
        <StatCard icon={<UserCog />} label={uz.dashboard.admins} value={String(adminCount?.n ?? 0)} tone={4} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>{uz.dashboard.recent}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/audit">{uz.dashboard.allAudit}</Link>
          </Button>
        </CardHeader>
        {recent.length ? (
          <ul className="divide-y divide-border-soft">
            {recent.map((e) => (
              <AuditRow key={e.id} event={e} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Activity />} title={uz.dashboard.noEvents} />
        )}
      </Card>
    </>
  );
}
