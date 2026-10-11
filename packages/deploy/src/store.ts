import { and, eq, inArray, sql } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import {
  ACTIVE_DEPLOY_STATUSES,
  deploymentLogs,
  deploymentSteps,
  deployments,
  projects,
  templates,
} from "@ventura/db/schema/panel";
import type { DeployStore } from "./runner";

/** Runner uchun baza qatlami (panel bazasi, Drizzle). */
export function createDeployStore(db: PanelDb): DeployStore {
  return {
    async load(id) {
      const [row] = await db
        .select({
          id: deployments.id,
          number: deployments.number,
          status: deployments.status,
          provider: deployments.provider,
          projectId: projects.id,
          slug: projects.slug,
          name: projects.name,
          templateKey: projects.templateKey,
          appPath: templates.appPath,
          mode: projects.mode,
          dbStrategy: projects.dbStrategy,
        })
        .from(deployments)
        .innerJoin(projects, eq(projects.id, deployments.projectId))
        .innerJoin(templates, eq(templates.key, projects.templateKey))
        .where(eq(deployments.id, id))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        number: row.number,
        status: row.status,
        provider: row.provider,
        project: {
          id: row.projectId,
          slug: row.slug,
          name: row.name,
          templateKey: row.templateKey,
          appPath: row.appPath,
          mode: row.mode,
          dbStrategy: row.dbStrategy,
        },
        // Haqiqiy sirlar (baza paroli, tokenlar) SSH drayveri bilan birga qo'shiladi
        secrets: [],
      };
    },

    async claim(id) {
      const rows = await db
        .update(deployments)
        .set({ status: "building", startedAt: new Date() })
        .where(and(eq(deployments.id, id), eq(deployments.status, "queued")))
        .returning({ id: deployments.id });
      return rows.length === 1;
    },

    async setStatus(id, status) {
      await db.update(deployments).set({ status }).where(eq(deployments.id, id));
    },

    async setStep(id, step, status, exitCode) {
      const now = new Date();
      await db
        .update(deploymentSteps)
        .set({
          status,
          exitCode: exitCode ?? null,
          ...(status === "running" ? { startedAt: now, finishedAt: null } : {}),
          ...(status === "ok" || status === "failed" ? { finishedAt: now } : {}),
        })
        .where(and(eq(deploymentSteps.deploymentId, id), eq(deploymentSteps.step, step)));
    },

    async appendLogs(id, lines) {
      if (!lines.length) return;
      await db.insert(deploymentLogs).values(lines.map((l) => ({ deploymentId: id, ...l })));
    },

    async finish(id, result) {
      await db
        .update(deployments)
        .set({
          status: result.status,
          error: result.error ?? null,
          commitSha: result.commitSha ?? null,
          releasePath: result.releasePath ?? null,
          finishedAt: new Date(),
        })
        .where(eq(deployments.id, id));
    },

    async activateProject(projectId) {
      await db
        .update(projects)
        .set({ status: "active" })
        .where(and(eq(projects.id, projectId), eq(projects.status, "draft")));
    },
  };
}

/**
 * Ishchi jarayon ishga tushganda: yarim yo'lda qolgan deploylar (jarayon o'chib qolgan) yiqilgan deb belgilanadi.
 * Navbatdagi (`queued`) deploylarga tegilmaydi — ularning vazifasi navbatda turibdi.
 */
export async function failInterrupted(db: PanelDb, error: string) {
  const stale = await db
    .update(deployments)
    .set({ status: "failed", error, finishedAt: new Date() })
    .where(inArray(deployments.status, ["building", "deploying"]))
    .returning({ id: deployments.id, projectId: deployments.projectId, number: deployments.number });
  if (stale.length) {
    await db
      .update(deploymentSteps)
      .set({
        status: sql`case when ${deploymentSteps.status} = 'running' then 'failed' else 'skipped' end`,
      })
      .where(
        and(
          inArray(
            deploymentSteps.deploymentId,
            stale.map((s) => s.id),
          ),
          inArray(deploymentSteps.status, ["running", "pending"]),
        ),
      );
  }
  return stale;
}

export { ACTIVE_DEPLOY_STATUSES };
