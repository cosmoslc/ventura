"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { projects } from "@ventura/db/schema/panel";
import { audit, putSecret, readSecret } from "@ventura/security";
import { secretKind } from "@/lib/project-secrets";
import { deps } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

/*
 * Loyiha sirlarini ko'rish va o'zgartirish (ADR 0059) — faqat super admin. Har ko'rish va o'zgarish audit jurnaliga
 * (qiymat yozilmaydi, faqat nomi). Qiymat serverga keyingi deploy'da yetadi.
 */

const t = uz.projectSecrets;

async function guard(projectId: string, name: string) {
  const viewer = await requireViewer();
  if (viewer.role !== "super_admin") return { error: uz.common.noPermission } as const;
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return { error: uz.common.loadError } as const;
  const kind = secretKind(name);
  if (!kind) return { error: t.unknown } as const;
  const { db } = deps();
  const [p] = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
  if (!p) return { error: uz.common.loadError } as const;
  return { viewer, kind, db, project: p };
}

export async function revealProjectSecretAction(
  projectId: string,
  name: string,
): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  const g = await guard(projectId, name);
  if ("error" in g) return { ok: false, error: g.error ?? uz.common.loadError };
  const value = await readSecret(g.db, { type: "project", id: projectId }, name);
  await audit.record(g.db, {
    actor: { type: "user", id: g.viewer.id, name: g.viewer.name },
    action: "secret.reveal",
    target: { type: "project", id: projectId },
    ...(await requestMeta()),
    metadata: { name },
  });
  return { ok: true, value };
}

export async function saveProjectSecretAction(
  projectId: string,
  name: string,
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await guard(projectId, name);
  if ("error" in g) return { ok: false, error: g.error ?? uz.common.loadError };
  const v = value.trim();
  if (!g.kind.pattern.test(v)) return { ok: false, error: t.invalid[name] ?? t.invalidDefault };
  await putSecret(g.db, { type: "project", id: projectId }, name, v);
  await audit.record(g.db, {
    actor: { type: "user", id: g.viewer.id, name: g.viewer.name },
    action: "secret.update",
    target: { type: "project", id: projectId },
    ...(await requestMeta()),
    metadata: { name, slug: g.project.slug },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
