import { desc, eq, max } from "drizzle-orm";
import { notifySuperAdmins } from "@ventura/auth";
import type { PanelDb } from "@ventura/db";
import { deploymentSteps, deployments, projects } from "@ventura/db/schema/panel";
import { type Telegram, escapeHtml } from "@ventura/integrations";
import { type AuditActor, audit } from "@ventura/security";
import { type Queue, enqueueDeploy } from "./queue";
import type { DeployEvent } from "./runner";
import { STEPS } from "./types";

/* Deploy so'rash (panel) va holat o'zgarishlarini qayd etish (ishchi jarayon). */

export const WORKER_ACTOR: AuditActor = { type: "system", name: "deploy-worker" };

/** Hozircha bitta drayver; SSH va Vercel qo'shilgach loyihaning manziliga qarab tanlanadi. */
export function providerFor(): string {
  return process.env.DEPLOY_DRIVER || "sim";
}

export type RequestResult =
  { ok: true; id: string; number: number } | { ok: false; reason: "not_found" | "trashed" | "active" | "queue" };

export interface DeployRequest {
  projectId: string;
  actor: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

export async function requestDeployment(db: PanelDb, queue: Queue, input: DeployRequest): Promise<RequestResult> {
  const provider = providerFor();
  let created: { id: string; number: number } | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      // Loyiha qatori qulflanadi: ikki so'rov bir vaqtda kelsa, raqamlar takrorlanmaydi
      const [project] = await tx
        .select({ id: projects.id, deletedAt: projects.deletedAt })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .for("update")
        .limit(1);
      if (!project) return "not_found" as const;
      if (project.deletedAt) return "trashed" as const;
      const [last] = await tx
        .select({ n: max(deployments.number) })
        .from(deployments)
        .where(eq(deployments.projectId, project.id));
      const [row] = await tx
        .insert(deployments)
        .values({
          projectId: project.id,
          number: (last?.n ?? 0) + 1,
          provider,
          triggeredBy: input.actor.type === "user" ? (input.actor.id ?? null) : null,
        })
        .returning({ id: deployments.id, number: deployments.number });
      await tx
        .insert(deploymentSteps)
        .values(STEPS.map((step, position) => ({ deploymentId: row!.id, step, position })));
      return row!;
    });
    if (typeof result === "string") return { ok: false, reason: result };
    created = result;
  } catch (e) {
    // deployments_one_active_uq: shu loyihada tugallanmagan deploy bor
    if (isUniqueViolation(e)) return { ok: false, reason: "active" };
    throw e;
  }

  try {
    await enqueueDeploy(queue, created.id);
  } catch (e) {
    await db
      .update(deployments)
      .set({ status: "failed", error: "Navbatga qo'shib bo'lmadi", finishedAt: new Date() })
      .where(eq(deployments.id, created.id));
    console.error("[deploy] navbat:", (e as Error).message);
    return { ok: false, reason: "queue" };
  }

  await audit.record(db, {
    actor: input.actor,
    action: "deploy.queued",
    target: { type: "project", id: input.projectId },
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { deploymentId: created.id, number: created.number, provider },
  });
  return { ok: true, ...created };
}

function isUniqueViolation(e: unknown): boolean {
  const code =
    (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

/** Runner hodisalari: har holat o'zgarishi audit jurnaliga, yiqilgan deploy Telegram'ga (SPEC 6 va 10). */
export function createEventHandler(deps: { db: PanelDb; telegram: Telegram }) {
  return async (event: DeployEvent) => {
    const { job } = event;
    await audit.record(deps.db, {
      actor: WORKER_ACTOR,
      action: `deploy.${event.type}`,
      target: { type: "project", id: job.project.id },
      metadata: {
        deploymentId: job.id,
        number: job.number,
        provider: job.provider,
        ...(event.failedStep ? { step: event.failedStep } : {}),
        ...(event.error ? { error: event.error } : {}),
        ...(event.rolledBack !== undefined ? { rolledBack: event.rolledBack } : {}),
      },
    });
    if (event.type === "failed") {
      await notifySuperAdmins(
        deps,
        `❌ <b>Deploy yiqildi</b>: ${escapeHtml(job.project.name)} (#${job.number})\n` +
          (event.failedStep ? `Qadam: <code>${escapeHtml(event.failedStep)}</code>\n` : "") +
          `Sabab: ${escapeHtml(event.error ?? "noma'lum")}\n` +
          (event.rolledBack
            ? "Oldingi versiya tiklandi."
            : "Sayt almashtirilmagan — oldingi versiya ishlashda davom etmoqda."),
      );
    }
  };
}

/** Loyihaning oxirgi deploylari (panel ro'yxati uchun). */
export async function recentDeployments(db: PanelDb, projectId: string, limit = 20) {
  return db
    .select()
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .orderBy(desc(deployments.number))
    .limit(limit);
}
