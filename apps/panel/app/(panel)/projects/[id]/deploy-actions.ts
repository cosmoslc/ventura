"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requestDeployment } from "@ventura/deploy";
import { type DeploymentState, deploymentState } from "@/lib/server/deployments-query";
import { deps, queue } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

const uuid = z.string().uuid();

export type StartDeployResult = { ok: true; id: string; number: number } | { ok: false; error: string };

/** Deploy'ni navbatga qo'yadi. Ishning o'zi ishchi jarayonda bajariladi (so'rov ichida emas). */
export async function startDeployAction(projectId: string): Promise<StartDeployResult> {
  const viewer = await requireViewer("projects.deploy");
  if (!uuid.safeParse(projectId).success) return { ok: false, error: uz.deploys.errors.not_found };
  const { db } = deps();

  let boss;
  try {
    boss = await queue();
  } catch (e) {
    console.error("[deploy] navbatga ulanib bo'lmadi:", (e as Error).message);
    return { ok: false, error: uz.deploys.errors.queue };
  }

  const result = await requestDeployment(db, boss, {
    projectId,
    actor: { type: "user", id: viewer.id, name: viewer.name },
    ...(await requestMeta()),
  });
  if (!result.ok) return { ok: false, error: uz.deploys.errors[result.reason] };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: result.id, number: result.number };
}

/** Jonli ko'rsatish uchun: deploy holati, qadamlar va `afterLogId` dan keyingi log qatorlari. */
export async function deploymentStateAction(id: string, afterLogId: number): Promise<DeploymentState | null> {
  await requireViewer();
  if (!uuid.safeParse(id).success || !Number.isSafeInteger(afterLogId) || afterLogId < 0) return null;
  return deploymentState(id, afterLogId);
}
