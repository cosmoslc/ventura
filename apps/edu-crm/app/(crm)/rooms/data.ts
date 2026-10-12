import "server-only";
import { asc, inArray, isNull, or } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { rooms } from "@ventura/db/schema/tenant";
import type { BranchContext } from "@/lib/server/branch";

export interface RoomGroup {
  id: string;
  name: string;
  days: string[];
  time: string | null;
}

export interface RoomRow {
  id: string;
  branchId: string | null;
  name: string;
  capacity: number;
  /** Xonani band qilgan guruhlar — guruhlar jadvali bilan (E1d); hozircha yo'q */
  groups: RoomGroup[];
}

export async function listRooms(db: TenantDb, branch: BranchContext): Promise<RoomRow[]> {
  const scope =
    branch.filter === null
      ? undefined
      : branch.filter.length
        ? or(isNull(rooms.branchId), inArray(rooms.branchId, branch.filter))
        : isNull(rooms.branchId);
  const rows = await db.select().from(rooms).where(scope).orderBy(asc(rooms.createdAt));
  return rows.map((r) => ({ id: r.id, branchId: r.branchId, name: r.name, capacity: r.capacity, groups: [] }));
}
