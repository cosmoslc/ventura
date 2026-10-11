"use server";

import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeUzPhone, notifySuperAdmins } from "@ventura/auth";
import {
  DB_STRATEGIES,
  DEPLOY_MODES,
  PROJECT_STATUSES,
  TARGET_KINDS,
  clients,
  domains,
  projectFeatures,
  projects,
  templates,
} from "@ventura/db/schema/panel";
import { escapeHtml } from "@ventura/integrations";
import { audit, putSecret } from "@ventura/security";
import { type Feature, withRequirements } from "@ventura/tenants";
import { BASE_DOMAIN, projectInputSchema, slugProblem } from "@/lib/project-rules";
import { deps } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function ctx() {
  const viewer = await requireViewer("projects.write");
  return {
    viewer,
    actor: { type: "user" as const, id: viewer.id, name: viewer.name },
    meta: await requestMeta(),
    ...deps(),
  };
}

/** Shablon manifestiga ko'ra yoqilgan bo'limlar: bog'liqliklar va doimiylar qo'shiladi, rejimlar chiqariladi. */
async function resolveFeatures(templateKey: string, selected: string[]) {
  const { db } = deps();
  const [tpl] = await db.select().from(templates).where(eq(templates.key, templateKey)).limit(1);
  if (!tpl) return null;
  const manifest = tpl.manifest as Feature[];
  const known = new Set(manifest.map((f) => f.key));
  const enabled = withRequirements(
    manifest,
    selected.filter((k) => known.has(k)),
  );
  return manifest.filter((f) => f.type !== "mode").map((f) => ({ featureKey: f.key, enabled: enabled.has(f.key) }));
}

export async function checkSlugAction(
  slug: string,
  exceptId?: string,
): Promise<{ available: boolean; error?: string }> {
  await requireViewer("projects.write");
  const problem = slugProblem(slug);
  if (problem) return { available: false, error: problem };
  const { db } = deps();
  const where = exceptId ? and(eq(projects.slug, slug), ne(projects.id, exceptId)) : eq(projects.slug, slug);
  const [taken] = await db.select({ id: projects.id }).from(projects).where(where).limit(1);
  return taken ? { available: false, error: uz.projects.slugTaken } : { available: true };
}

/* ---------- Yaratish (Yangi loyiha formasi) ---------- */

export async function createProjectAction(input: unknown): Promise<Result<{ id: string }>> {
  const { viewer, actor, meta, db, telegram } = await ctx();
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  const v = parsed.data;

  if (!(await checkSlugAction(v.slug)).available) return { ok: false, error: uz.projects.slugTaken };
  const hosts = [`${v.slug}.${BASE_DOMAIN}`, ...(v.domainKind === "custom" ? [v.customDomain] : [])];
  for (const h of hosts) {
    const [taken] = await db.select({ id: domains.id }).from(domains).where(eq(domains.hostname, h)).limit(1);
    if (taken) return { ok: false, error: uz.projects.hostTaken };
  }
  const features = await resolveFeatures(v.templateKey, v.features);
  if (!features) return { ok: false, error: uz.common.loadError };

  const id = await db.transaction(async (tx) => {
    let clientId = v.clientId;
    if (!clientId && v.newClient) {
      const phone = v.newClient.phone ? normalizeUzPhone(v.newClient.phone) : null;
      const [c] = await tx.insert(clients).values({ name: v.newClient.name, phone }).returning({ id: clients.id });
      clientId = c!.id;
    }
    const [p] = await tx
      .insert(projects)
      .values({
        clientId: clientId!,
        templateKey: v.templateKey,
        slug: v.slug,
        name: v.name,
        mode: v.mode,
        target: v.target,
        dbStrategy: v.dbStrategy,
        status: "draft",
        brand: v.brand,
        settings: v.githubRepo && v.mode === "fork" ? { githubRepo: v.githubRepo } : {},
        ownerName: v.ownerName,
        ownerPhone: `+998${v.ownerPhone}`,
        createdBy: viewer.id,
      })
      .returning({ id: projects.id });
    const projectId = p!.id;
    if (features.length) {
      await tx.insert(projectFeatures).values(features.map((f) => ({ ...f, projectId, updatedBy: viewer.id })));
    }
    await tx
      .insert(domains)
      .values([
        { projectId, hostname: hosts[0]!, kind: "subdomain", isPrimary: v.domainKind === "subdomain" },
        ...(v.domainKind === "custom"
          ? [{ projectId, hostname: v.customDomain, kind: "custom" as const, isPrimary: true }]
          : []),
      ]);
    return projectId;
  });

  // Sirlar shifrlangan holda (tranzaksiyadan keyin: kalit fayli o'qiladi)
  await putSecret(db, { type: "project", id }, "owner_password", v.ownerPassword);
  if (v.telegramToken) await putSecret(db, { type: "project", id }, "telegram_bot_token", v.telegramToken);

  await audit.record(db, {
    actor,
    action: "project.create",
    target: { type: "project", id },
    ...meta,
    metadata: {
      name: v.name,
      slug: v.slug,
      template: v.templateKey,
      mode: v.mode,
      target: v.target,
      dbStrategy: v.dbStrategy,
      domains: hosts,
      features: features.filter((f) => f.enabled).map((f) => f.featureKey),
      secrets: ["owner_password", ...(v.telegramToken ? ["telegram_bot_token"] : [])],
    },
  });
  await notifySuperAdmins(
    { db, telegram },
    `🆕 <b>Loyiha yaratildi</b>: ${escapeHtml(v.name)} (<code>${escapeHtml(hosts[0]!)}</code>)\nKim: ${escapeHtml(viewer.name)}`,
  );
  revalidatePath("/projects");
  return { ok: true, id };
}

/* ---------- Tahrirlash ---------- */

const generalSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clientId: z.string().uuid(),
  status: z.enum(PROJECT_STATUSES),
  mode: z.enum(DEPLOY_MODES),
  target: z.enum(TARGET_KINDS),
  dbStrategy: z.enum(DB_STRATEGIES),
});

export async function updateProjectAction(id: string, input: unknown): Promise<Result> {
  const { actor, meta, db } = await ctx();
  const parsed = generalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  const [before] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!before) return { ok: false, error: uz.common.loadError };
  await db.update(projects).set(parsed.data).where(eq(projects.id, id));
  const changed = Object.fromEntries(
    Object.entries(parsed.data).filter(([k, val]) => before[k as keyof typeof before] !== val),
  );
  if (Object.keys(changed).length) {
    await audit.record(db, {
      actor,
      action: "project.update",
      target: { type: "project", id },
      ...meta,
      metadata: {
        before: Object.fromEntries(Object.keys(changed).map((k) => [k, before[k as keyof typeof before]])),
        after: changed,
      },
    });
  }
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { ok: true };
}

const brandSchema = z.object({
  primary: z.string().regex(/^#[0-9a-f]{6}$/i),
  appearance: z.enum(["light", "dark", "system"]),
});

export async function updateBrandAction(id: string, input: unknown): Promise<Result> {
  const { actor, meta, db } = await ctx();
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: uz.common.loadError };
  const [before] = await db.select({ brand: projects.brand }).from(projects).where(eq(projects.id, id)).limit(1);
  if (!before) return { ok: false, error: uz.common.loadError };
  await db.update(projects).set({ brand: parsed.data }).where(eq(projects.id, id));
  await audit.record(db, {
    actor,
    action: "project.brand",
    target: { type: "project", id },
    ...meta,
    metadata: { before: before.brand, after: parsed.data },
  });
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function updateFeaturesAction(id: string, selected: string[]): Promise<Result> {
  const { viewer, actor, meta, db } = await ctx();
  const [p] = await db.select({ templateKey: projects.templateKey }).from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) return { ok: false, error: uz.common.loadError };
  const next = await resolveFeatures(p.templateKey, selected);
  if (!next) return { ok: false, error: uz.common.loadError };
  const current = await db.select().from(projectFeatures).where(eq(projectFeatures.projectId, id));
  const was = new Map(current.map((f) => [f.featureKey, f.enabled]));
  const turnedOn = next.filter((f) => f.enabled && !was.get(f.featureKey)).map((f) => f.featureKey);
  const turnedOff = next.filter((f) => !f.enabled && was.get(f.featureKey)).map((f) => f.featureKey);
  if (!turnedOn.length && !turnedOff.length) return { ok: true };

  await db.transaction(async (tx) => {
    for (const f of next) {
      await tx
        .insert(projectFeatures)
        .values({ projectId: id, ...f, updatedBy: viewer.id })
        .onConflictDoUpdate({
          target: [projectFeatures.projectId, projectFeatures.featureKey],
          set: { enabled: f.enabled, updatedBy: viewer.id, updatedAt: new Date() },
        });
    }
  });
  await audit.record(db, {
    actor,
    action: "project.features",
    target: { type: "project", id },
    ...meta,
    metadata: { enabled: turnedOn, disabled: turnedOff },
  });
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

/* ---------- Savat ---------- */

export async function trashProjectAction(id: string): Promise<Result> {
  const { viewer, actor, meta, db, telegram } = await ctx();
  const [p] = await db
    .update(projects)
    .set({ deletedAt: new Date() })
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .returning({ name: projects.name, slug: projects.slug });
  if (!p) return { ok: false, error: uz.common.loadError };
  await audit.record(db, { actor, action: "project.trash", target: { type: "project", id }, ...meta, metadata: p });
  await notifySuperAdmins(
    { db, telegram },
    `🗑 <b>Loyiha savatga o'tkazildi</b>: ${escapeHtml(p.name)} (<code>${escapeHtml(p.slug)}</code>)\nKim: ${escapeHtml(viewer.name)}`,
  );
  revalidatePath("/projects");
  revalidatePath("/projects/trash");
  return { ok: true };
}

export async function restoreProjectAction(id: string): Promise<Result> {
  const { actor, meta, db } = await ctx();
  const [p] = await db
    .update(projects)
    .set({ deletedAt: null })
    .where(and(eq(projects.id, id), isNotNull(projects.deletedAt)))
    .returning({ name: projects.name, slug: projects.slug });
  if (!p) return { ok: false, error: uz.common.loadError };
  await audit.record(db, { actor, action: "project.restore", target: { type: "project", id }, ...meta, metadata: p });
  revalidatePath("/projects");
  revalidatePath("/projects/trash");
  return { ok: true };
}
