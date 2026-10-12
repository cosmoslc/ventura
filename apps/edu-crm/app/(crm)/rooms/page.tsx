import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requireFeature } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listRooms } from "./data";
import { RoomsView } from "./rooms-view";

export const metadata = { title: uz.rooms.title };

/** Xonalar — guruhlar bo'limining bir qismi (manifestda `groups` → `/rooms`). */
export default async function RoomsPage() {
  const { tenant, staff } = await requireFeature("groups");
  const branch = await getBranchContext();
  const rows = await listRooms(getTenantDb(tenant), branch);
  return (
    <RoomsView
      rows={rows}
      branches={branch.options}
      selectedBranch={branch.selected}
      canWrite={can(staff.role, "groups.write")}
    />
  );
}
