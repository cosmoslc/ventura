import { Plus } from "lucide-react";
import Link from "next/link";
import { can } from "@ventura/auth";
import { Button } from "@ventura/ui/button";
import { PageHeader } from "@/components/page-header";
import { listProjects } from "@/lib/server/projects-query";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ProjectsTable } from "./projects-table";

export const metadata = { title: `${uz.projects.title} · ${uz.app.name}` };

export default async function ProjectsPage() {
  const viewer = await requireViewer();
  const rows = await listProjects(false);
  const canWrite = can(viewer.role, "projects.write");
  return (
    <>
      <PageHeader
        title={uz.projects.title}
        description={uz.projects.description}
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/projects/new">
                <Plus /> {uz.projects.new}
              </Link>
            </Button>
          ) : null
        }
      />
      <ProjectsTable rows={rows} canWrite={canWrite} mode="active" />
    </>
  );
}
