import "server-only";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { deploymentLogs, deploymentSteps, deployments, settings, users } from "@ventura/db/schema/panel";
import { WORKER_HEARTBEAT_KEY, WORKER_STALE_MS } from "@ventura/deploy";
import { deps } from "./deps";

export interface DeploymentRow {
  id: string;
  number: number;
  status: (typeof deployments.$inferSelect)["status"];
  provider: string;
  commitSha: string | null;
  error: string | null;
  by: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface DeploymentState {
  deployment: DeploymentRow;
  steps: { step: string; status: (typeof deploymentSteps.$inferSelect)["status"]; seconds: number | null }[];
  /** `afterLogId` dan keyingi qatorlar */
  logs: { id: number; step: string; stream: "cmd" | "out" | "err" | "info"; line: string }[];
  workerAlive: boolean;
}

const LOG_PAGE = 500;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

const columns = {
  id: deployments.id,
  number: deployments.number,
  status: deployments.status,
  provider: deployments.provider,
  commitSha: deployments.commitSha,
  error: deployments.error,
  by: users.name,
  createdAt: deployments.createdAt,
  startedAt: deployments.startedAt,
  finishedAt: deployments.finishedAt,
};

type Raw = Omit<DeploymentRow, "createdAt" | "startedAt" | "finishedAt"> & {
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};
const toRow = (r: Raw): DeploymentRow => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  startedAt: iso(r.startedAt),
  finishedAt: iso(r.finishedAt),
});

export async function listDeployments(projectId: string, limit = 20): Promise<DeploymentRow[]> {
  const { db } = deps();
  const rows = await db
    .select(columns)
    .from(deployments)
    .leftJoin(users, eq(users.id, deployments.triggeredBy))
    .where(eq(deployments.projectId, projectId))
    .orderBy(desc(deployments.number))
    .limit(limit);
  return rows.map(toRow);
}

export async function workerAlive(): Promise<boolean> {
  const { db } = deps();
  const [row] = await db
    .select({ updatedAt: settings.updatedAt })
    .from(settings)
    .where(eq(settings.key, WORKER_HEARTBEAT_KEY))
    .limit(1);
  return !!row && Date.now() - row.updatedAt.getTime() < WORKER_STALE_MS;
}

export async function deploymentState(id: string, afterLogId = 0): Promise<DeploymentState | null> {
  const { db } = deps();
  const [dep] = await db
    .select(columns)
    .from(deployments)
    .leftJoin(users, eq(users.id, deployments.triggeredBy))
    .where(eq(deployments.id, id))
    .limit(1);
  if (!dep) return null;
  const [steps, logs, alive] = await Promise.all([
    db
      .select()
      .from(deploymentSteps)
      .where(eq(deploymentSteps.deploymentId, id))
      .orderBy(asc(deploymentSteps.position)),
    db
      .select({
        id: deploymentLogs.id,
        step: deploymentLogs.step,
        stream: deploymentLogs.stream,
        line: deploymentLogs.line,
      })
      .from(deploymentLogs)
      .where(and(eq(deploymentLogs.deploymentId, id), gt(deploymentLogs.id, afterLogId)))
      .orderBy(asc(deploymentLogs.id))
      .limit(LOG_PAGE),
    workerAlive(),
  ]);
  return {
    deployment: toRow(dep),
    steps: steps.map((s) => ({
      step: s.step,
      status: s.status,
      seconds: s.startedAt && s.finishedAt ? Math.round((s.finishedAt.getTime() - s.startedAt.getTime()) / 1000) : null,
    })),
    logs,
    workerAlive: alive,
  };
}
