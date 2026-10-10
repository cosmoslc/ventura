import { can } from "@ventura/auth";
import { PageHeader } from "@/components/page-header";
import { listProjects } from "@/lib/server/projects-query";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ProjectsTable } from "../projects-table";

export const metadata = { title: `${uz.projects.trashTitle} · ${uz.app.name}` };

export default async function TrashPage() {
  const viewer = await requireViewer();
  const rows = await listProjects(true);
  return (
    <>
      <PageHeader title={uz.projects.trashTitle} description={uz.projects.trashDescription} />
      <ProjectsTable rows={rows} canWrite={can(viewer.role, "projects.write")} mode="trash" />
    </>
  );
}
