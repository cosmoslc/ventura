import { notFound } from "next/navigation";
import { z } from "zod";
import { can } from "@ventura/auth";
import { getServer } from "@/lib/server/servers-query";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ServerDetailView } from "./server-detail";

export const metadata = { title: `${uz.servers.title} · ${uz.app.name}` };

export default async function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const server = await getServer(id);
  if (!server) notFound();
  return (
    <ServerDetailView
      server={server}
      canManage={can(viewer.role, "servers.manage")}
      canOperate={can(viewer.role, "projects.deploy")}
    />
  );
}
