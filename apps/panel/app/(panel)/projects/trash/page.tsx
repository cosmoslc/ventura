import { isNotNull } from "drizzle-orm";
import { can } from "@ventura/auth";
import { servers } from "@ventura/db/schema/panel";
import { Notice } from "@ventura/ui/notice";
import { PageHeader } from "@ventura/ui/page-header";
import { deps } from "@/lib/server/deps";
import { listProjects } from "@/lib/server/projects-query";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ProjectsTable } from "../projects-table";

export const metadata = { title: `${uz.projects.trashTitle} · ${uz.app.name}` };

export default async function TrashPage() {
  const viewer = await requireViewer();
  const rows = await listProjects(true);
  // Butunlay o'chirish serverda ishchi jarayonda bajariladi (ADR 0058): oxirgi natijasi shu yerda ko'rinadi
  const purges = (
    await deps().db.select({ lastAction: servers.lastAction }).from(servers).where(isNotNull(servers.lastAction))
  )
    .map((s) => s.lastAction)
    .filter((a) => a?.kind === "project_purge");
  return (
    <div className="space-y-section">
      <PageHeader title={uz.projects.trashTitle} description={uz.projects.trashDescription} />
      {purges.map((a, i) =>
        a ? (
          <Notice key={i} tone={a.status === "error" ? "danger" : a.status === "ok" ? "success" : "info"}>
            {uz.projects.purgeStatus(a.project ?? "", a.status, a.message)}
          </Notice>
        ) : null,
      )}
      <ProjectsTable
        rows={rows}
        canWrite={can(viewer.role, "projects.write")}
        canPurge={viewer.role === "super_admin"}
        mode="trash"
      />
    </div>
  );
}
