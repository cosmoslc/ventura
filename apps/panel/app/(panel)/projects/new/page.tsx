import { asc } from "drizzle-orm";
import { clients, templates } from "@ventura/db/schema/panel";
import type { Feature } from "@ventura/tenants";
import { PageHeader } from "@/components/page-header";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ProjectWizard } from "./wizard";

export const metadata = { title: `${uz.wizard.title} · ${uz.app.name}` };

export default async function NewProjectPage() {
  await requireViewer("projects.write");
  const { db } = deps();
  const [tpls, cls] = await Promise.all([
    db.select().from(templates).orderBy(asc(templates.name)),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
  ]);
  return (
    <>
      <PageHeader title={uz.wizard.title} description={uz.wizard.description} />
      <ProjectWizard
        templates={tpls.map((t) => ({
          key: t.key,
          name: t.name,
          description: t.description,
          version: t.version,
          features: t.manifest as Feature[],
        }))}
        clients={cls}
      />
    </>
  );
}
