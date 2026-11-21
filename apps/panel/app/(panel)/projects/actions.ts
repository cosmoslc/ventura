"use server";

import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
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
import { enqueueServerJob, purgeProject, trashedProject } from "@ventura/deploy";
import { escapeHtml } from "@ventura/integrations";
import { audit, putSecret } from "@ventura/security";
import { type Feature, withRequirements } from "@ventura/tenants";
import { BASE_DOMAIN, UUID_RE, deployProblem, projectInputSchema, slugProblem } from "@/lib/project-rules";
import { deps, queue } from "@/lib/server/deps";
import { getProjectTenantDb, resetProjectDirectorPassword, unlockProjectDirector } from "@/lib/server/project-tenant";
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

  try {
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
          settings: { storeMode: v.storeMode ?? "financial" },
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
  } catch (e) {
    // Xato matni (SQL, cheklov nomlari) brauzerga chiqmaydi — faqat server logida
    console.error("[createProjectAction]", e);
    return { ok: false, error: uz.common.saveError };
  }
}

/* ---------- Tahrirlash ---------- */

const generalSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clientId: z.string().regex(UUID_RE, uz.wizard.pickClient),
  status: z.enum(PROJECT_STATUSES),
  mode: z.enum(DEPLOY_MODES),
  target: z.enum(TARGET_KINDS),
  dbStrategy: z.enum(DB_STRATEGIES),
  storeMode: z.enum(["financial", "inventory"]).optional(),
  storageLimitGb: z.number().positive().max(1000).optional(),
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
  const dp = deployProblem(parsed.data.mode, parsed.data.dbStrategy);
  if (dp) return { ok: false, error: dp };
  // Umumiy baza ↔ alohida baza: ma'lumot boshqa bazada qoladi — deploy qilingan loyihada ko'chirishsiz o'zgartirilmaydi
  const sharedDbChanged =
    before.dbStrategy !== parsed.data.dbStrategy && [before.dbStrategy, parsed.data.dbStrategy].includes("shared_db");
  if (sharedDbChanged && before.status !== "draft") return { ok: false, error: uz.projects.dbChangeLocked };
  const { storageLimitGb, storeMode, ...restFields } = parsed.data;
  const currentSettings = (before.settings ?? {}) as Record<string, unknown>;
  const nextSettings = { ...currentSettings };
  if (storageLimitGb !== undefined) {
    nextSettings.storageLimitMb = Math.round(storageLimitGb * 1024);
  }
  if (storeMode !== undefined) {
    nextSettings.storeMode = storeMode;
  }
  await db
    .update(projects)
    .set({ ...restFields, settings: nextSettings })
    .where(eq(projects.id, id));

  if (storeMode !== undefined && before.templateKey === "pc-crm") {
    try {
      const tenantDb = await getProjectTenantDb(db, {
        id: before.id,
        templateKey: before.templateKey,
        slug: before.slug,
        dbStrategy: before.dbStrategy,
        serverId: before.serverId,
        settings: nextSettings,
      });
      if (tenantDb) {
        await tenantDb.run(async (tx) => {
          await tx.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('store_mode', ${JSON.stringify(storeMode)}::jsonb)
            ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(storeMode)}::jsonb
          `);
          await tx.execute(sql`
            UPDATE settings
            SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{storeMode}', ${JSON.stringify(storeMode)}::jsonb)
            WHERE key = 'store_branding'
          `);
        });
      }
    } catch (e) {
      console.warn("Failed to sync store_mode to tenant db:", e);
    }
  }
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
  logoUrl: z.string().nullable().optional(),
});

export async function updateBrandAction(id: string, input: unknown): Promise<Result> {
  const { actor, meta, db } = await ctx();
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: uz.common.loadError };
  const [before] = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      templateKey: projects.templateKey,
      dbStrategy: projects.dbStrategy,
      serverId: projects.serverId,
      settings: projects.settings,
      brand: projects.brand,
    })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!before) return { ok: false, error: uz.common.loadError };
  await db.update(projects).set({ brand: parsed.data }).where(eq(projects.id, id));

  if (before.templateKey === "pc-crm") {
    try {
      const tenantDb = await getProjectTenantDb(db, {
        id: before.id,
        templateKey: before.templateKey,
        slug: before.slug,
        dbStrategy: before.dbStrategy,
        serverId: before.serverId,
        settings: before.settings,
      });
      if (tenantDb) {
        await tenantDb.run(async (tx) => {
          await tx.execute(sql`
            INSERT INTO settings (key, value)
            VALUES (
              'store_branding',
              jsonb_build_object(
                'primary', ${parsed.data.primary}::text,
                'appearance', ${parsed.data.appearance}::text,
                'logoUrl', ${parsed.data.logoUrl ?? null}::text
              )
            )
            ON CONFLICT (key) DO UPDATE
            SET value = jsonb_set(
              jsonb_set(
                jsonb_set(
                  COALESCE(settings.value, '{}'::jsonb),
                  '{primary}',
                  to_jsonb(${parsed.data.primary}::text)
                ),
                '{appearance}',
                to_jsonb(${parsed.data.appearance}::text)
              ),
              '{logoUrl}',
              to_jsonb(${parsed.data.logoUrl ?? null}::text)
            )
          `);
        });
      }
    } catch (e) {
      console.warn("Failed to sync brand to tenant db:", e);
    }
  }

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

/**
 * Savatdagi loyihani butunlay o'chirish (ADR 0058) — faqat super admin, loyiha nomini (slug) yozib tasdiqlash bilan.
 * Serverga deploy qilingan bo'lsa ishchi jarayon serverni tozalaydi (sayt, ilova, ma'lumotlar), keyin paneldan
 * o'chiradi; hech qachon deploy qilinmagan bo'lsa — darhol paneldan.
 */
export async function purgeProjectAction(id: string, confirm: string): Promise<Result & { queued?: boolean }> {
  const { viewer, actor, meta, db, telegram } = await ctx();
  if (viewer.role !== "super_admin") return { ok: false, error: uz.common.noPermission };
  const p = await trashedProject(db, id);
  if (!p) return { ok: false, error: uz.common.loadError };
  if (confirm.trim() !== p.slug) return { ok: false, error: uz.projects.purgeMismatch };

  if (p.serverId) {
    try {
      await enqueueServerJob(db, await queue(), {
        serverId: p.serverId,
        kind: "project_purge",
        projectId: p.id,
        project: p.name,
        actor,
      });
    } catch {
      return { ok: false, error: uz.projects.purgeQueueError };
    }
    revalidatePath("/projects/trash");
    return { ok: true, queued: true };
  }

  const res = await purgeProject(db, null, p.id);
  if (!res.ok) return { ok: false, error: res.error };
  await audit.record(db, {
    actor,
    action: "project.purge",
    target: { type: "project", id: p.id },
    ...meta,
    metadata: { project: p.name, slug: p.slug, ok: true, detail: res.detail },
  });
  await notifySuperAdmins(
    { db, telegram },
    `❌ <b>Loyiha butunlay o'chirildi</b>: ${escapeHtml(p.name)} (<code>${escapeHtml(p.slug)}</code>)\nKim: ${escapeHtml(viewer.name)}`,
  );
  revalidatePath("/projects/trash");
  return { ok: true };
}

/* ---------- Sinov va Ega boshqaruvi (Muallif / Agent: Google Gemini) ---------- */

/** 7 kunlik sinovni yakunlab, loyihani to'liq faollashtirish */
export async function activateTrialProjectAction(id: string): Promise<Result> {
  const { actor, meta, db } = await ctx();
  const [before] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!before) return { ok: false, error: uz.common.loadError };

  const currentSettings = (before.settings ?? {}) as Record<string, unknown>;
  const trial = (currentSettings.trial ?? {}) as Record<string, unknown>;
  const nextSettings = {
    ...currentSettings,
    trial: {
      ...trial,
      active: false,
      activatedAt: new Date().toISOString(),
    },
  };

  await db
    .update(projects)
    .set({
      status: "active",
      settings: nextSettings,
    })
    .where(eq(projects.id, id));

  await audit.record(db, {
    actor,
    action: "project.trial_activated",
    target: { type: "project", id },
    ...meta,
    metadata: {
      slug: before.slug,
      name: before.name,
      previousStatus: before.status,
    },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { ok: true };
}

/** Markaz direktori hisobini blokdan chiqarish */
export async function unlockDirectorAction(id: string): Promise<Result> {
  const { actor, meta, db } = await ctx();
  const res = await unlockProjectDirector(db, id, actor, meta);
  if (!res.ok) return res;
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

/** Markaz direktori parolini yangilash */
export async function resetDirectorPasswordAction(id: string, newPassword: string): Promise<Result> {
  const { actor, meta, db } = await ctx();
  const res = await resetProjectDirectorPassword(db, id, newPassword, actor, meta);
  if (!res.ok) return res;
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

/** Oylik abonent to'lovini qabul qilib, obuna muddatini uzaytirish */
export async function extendSubscriptionAction(
  id: string,
  months: number = 1,
  amount?: number,
): Promise<Result<{ paidUntil: string }>> {
  const { actor, meta, db } = await ctx();
  const [before] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!before) return { ok: false, error: uz.common.loadError };

  const currentSettings = (before.settings ?? {}) as Record<string, unknown>;
  const currentSub = (currentSettings.subscription ?? {}) as Record<string, unknown>;
  const monthlyPrice = typeof currentSub.monthlyPrice === "number" ? currentSub.monthlyPrice : 300_000;
  const paymentAmount = amount ?? monthlyPrice * months;

  const now = new Date();
  const baseDate =
    currentSub.paidUntil && new Date(currentSub.paidUntil as string) > now
      ? new Date(currentSub.paidUntil as string)
      : now;

  const nextPaidUntil = new Date(baseDate);
  nextPaidUntil.setMonth(nextPaidUntil.getMonth() + months);

  const nextSettings = {
    ...currentSettings,
    subscription: {
      ...currentSub,
      active: true,
      plan: currentSub.plan ?? "Standart",
      monthlyPrice,
      paidUntil: nextPaidUntil.toISOString(),
      lastPaidAt: now.toISOString(),
      lastPaymentAmount: paymentAmount,
      reminderSentFor: null,
      autoFreeze: true,
    },
    trial: {
      ...((currentSettings.trial as Record<string, unknown> | undefined) ?? {}),
      active: false,
      activatedAt: currentSettings.trial
        ? ((currentSettings.trial as Record<string, unknown>).activatedAt ?? now.toISOString())
        : now.toISOString(),
    },
  };

  await db
    .update(projects)
    .set({
      status: "active",
      settings: nextSettings,
    })
    .where(eq(projects.id, id));

  await audit.record(db, {
    actor,
    action: "project.subscription_extended",
    target: { type: "project", id },
    ...meta,
    metadata: {
      slug: before.slug,
      name: before.name,
      months,
      amount: paymentAmount,
      newPaidUntil: nextPaidUntil.toISOString(),
    },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { ok: true, paidUntil: nextPaidUntil.toISOString() };
}

/** Loyihani tezkor muzlatish / eritish (freeze / unfreeze) */
export async function toggleProjectFreezeAction(id: string): Promise<Result<{ status: "active" | "paused" }>> {
  const { actor, meta, db } = await ctx();
  const [before] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!before) return { ok: false, error: uz.common.loadError };

  const nextStatus: "active" | "paused" = before.status === "active" ? "paused" : "active";

  await db.update(projects).set({ status: nextStatus }).where(eq(projects.id, id));

  await audit.record(db, {
    actor,
    action: nextStatus === "paused" ? "project.frozen" : "project.unfrozen",
    target: { type: "project", id },
    ...meta,
    metadata: {
      slug: before.slug,
      name: before.name,
      previousStatus: before.status,
      nextStatus,
    },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { ok: true, status: nextStatus };
}
