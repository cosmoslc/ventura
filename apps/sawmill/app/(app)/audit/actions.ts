"use server";

import { desc } from "drizzle-orm";
import { auditEvents } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/server/session";

export interface AuditItem {
  id: string;
  seq: number;
  at: Date;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
}

export async function getAuditEventsAction(limit = 100) {
  const { user, deps } = await requireUser();
  if (!can(user.role, "audit.view")) {
    throw new Error("Ruxsat yo'q");
  }

  const rows = await deps.db.select().from(auditEvents).orderBy(desc(auditEvents.seq)).limit(limit);

  return rows as AuditItem[];
}

export async function verifyAuditChainAction() {
  const { user, deps } = await requireUser();
  if (!can(user.role, "audit.view")) {
    throw new Error("Ruxsat yo'q");
  }

  return tenantAudit.verify(deps.db);
}
