import { can } from "@ventura/auth";
import { listServers } from "@/lib/server/servers-query";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ServersView } from "./servers-view";

export const metadata = { title: `${uz.servers.title} · ${uz.app.name}` };

export default async function ServersPage() {
  const viewer = await requireViewer();
  const rows = await listServers();
  return <ServersView rows={rows} canManage={can(viewer.role, "servers.manage")} />;
}
