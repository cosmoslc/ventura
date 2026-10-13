import "server-only";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { positions, userPositions, users } from "@ventura/db/schema/tenant";

export interface PositionRow {
  id: string;
  code: string | null;
  name: string;
  color: string;
  permissions: string[];
  /** "Tasdiq bilan" ruxsatlar (ADR 0019) */
  approvals: string[];
  system: boolean;
  /** Shu lavozimdagi faol (bo'shatilmagan) xodimlar soni */
  users: number;
}

export async function listPositions(db: TenantDb): Promise<PositionRow[]> {
  const [rows, counts] = await Promise.all([
    db.select().from(positions).orderBy(asc(positions.createdAt), asc(positions.name)),
    db
      .select({ positionId: userPositions.positionId, n: count() })
      .from(userPositions)
      .innerJoin(users, and(eq(users.id, userPositions.userId), isNull(users.archivedAt)))
      .groupBy(userPositions.positionId),
  ]);
  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    color: p.color,
    permissions: p.permissions,
    approvals: p.approvals,
    system: p.system,
    users: counts.find((c) => c.positionId === p.id)?.n ?? 0,
  }));
}
