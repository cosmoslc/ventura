"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { projects, servers } from "@ventura/db/schema/panel";
import {
  DB_NAME_RE,
  SYSTEM_DATABASES,
  activeProjectsOn,
  dbNameFor,
  dbPasswordOwner,
  enqueueServerJob,
} from "@ventura/deploy";
import { audit, readSecret } from "@ventura/security";
import { deps, queue } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

/*
 * Bazalar (ADR 0057): yangi bo'sh baza yaratish (ishchi jarayon SSH orqali) va baza manzilini olish. Manzil (parol
 * bilan) faqat super adminga, har ko'rish audit jurnaliga. Baza faqat serverning o'zida (127.0.0.1) ochiq —
 * tashqaridan SSH tunnel orqali.
 */

const t = uz.databases;
const TUNNEL_PORT = 15432;

const target = z.object({ serverId: z.uuid(), name: z.string().regex(DB_NAME_RE, t.nameInvalid) });

export type CreateResult = { ok: true } | { ok: false; error: string };

export async function createDatabaseAction(input: unknown): Promise<CreateResult> {
  const viewer = await requireViewer("servers.manage");
  const parsed = target.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? t.nameInvalid };
  const { serverId, name } = parsed.data;
  if (SYSTEM_DATABASES.has(name)) return { ok: false, error: t.nameInvalid };
  const { db } = deps();
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId));
  if (!server) return { ok: false, error: uz.common.loadError };
  // Oxirgi ro'yxat bo'yicha oldindan tekshiruv (ishchi jarayon serverda yana tekshiradi)
  if (server.metrics?.databases?.some((d) => d.name === name)) return { ok: false, error: t.exists };
  const used = await db
    .select({ slug: projects.slug, templateKey: projects.templateKey, dbStrategy: projects.dbStrategy })
    .from(projects)
    .where(eq(projects.serverId, serverId));
  if (used.some((p) => dbNameFor(p.templateKey, p.slug, p.dbStrategy) === name))
    return { ok: false, error: t.usedByProject };
  try {
    await enqueueServerJob(db, await queue(), {
      serverId,
      kind: "db_create",
      database: name,
      actor: { type: "user", id: viewer.id, name: viewer.name },
    });
  } catch {
    return { ok: false, error: t.queueError };
  }
  revalidatePath("/databases");
  return { ok: true };
}

export type RevealResult =
  { ok: true; url: string; tunnelUrl: string; tunnelCommand: string } | { ok: false; error: string };

export async function revealDatabaseUrlAction(input: unknown): Promise<RevealResult> {
  const viewer = await requireViewer();
  if (viewer.role !== "super_admin") return { ok: false, error: uz.common.noPermission };
  const parsed = target.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.nameInvalid };
  const { serverId, name } = parsed.data;
  const { db } = deps();
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId));
  if (!server) return { ok: false, error: uz.common.loadError };

  // Parol qayerda: loyiha bazasi — loyiha sirlarida, umumiy va qo'lda yaratilgan — server sirlarida
  const list = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      templateKey: projects.templateKey,
      dbStrategy: projects.dbStrategy,
    })
    .from(projects)
    .where(and(eq(projects.serverId, serverId), isNull(projects.deletedAt)));
  const owner = list.find((p) => dbNameFor(p.templateKey, p.slug, p.dbStrategy) === name);
  const kind = owner && owner.dbStrategy !== "shared_db" ? "project" : name.endsWith("_shared") ? "shared" : "manual";
  const pw = dbPasswordOwner(kind, { serverId, projectId: owner?.id }, name);
  const password = await readSecret(db, pw.owner, pw.name);
  if (!password) return { ok: false, error: t.noPassword };

  await audit.record(db, {
    actor: { type: "user", id: viewer.id, name: viewer.name },
    action: "database.reveal",
    target: { type: "server", id: serverId },
    ...(await requestMeta()),
    metadata: { database: name },
  });
  const auth = `${encodeURIComponent(name)}:${encodeURIComponent(password)}`;
  return {
    ok: true,
    url: `postgres://${auth}@127.0.0.1:5432/${name}`,
    tunnelUrl: `postgres://${auth}@localhost:${TUNNEL_PORT}/${name}`,
    tunnelCommand: `ssh -N -L ${TUNNEL_PORT}:127.0.0.1:5432 -p ${server.sshPort} ${server.sshUser}@${server.host}`,
  };
}

/**
 * Bazani o'chirish (ADR 0058) — faqat super admin, nomini yozib tasdiqlash bilan. Ishlab turgan loyiha ishlatadigan
 * baza va umumiy baza rad etiladi (panelda va ishchi jarayonda serverning jonli ro'yxati bilan yana tekshiriladi).
 */
export async function dropDatabaseAction(input: unknown, confirm: string): Promise<CreateResult> {
  const viewer = await requireViewer();
  if (viewer.role !== "super_admin") return { ok: false, error: uz.common.noPermission };
  const parsed = target.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.nameInvalid };
  const { serverId, name } = parsed.data;
  if (confirm.trim() !== name) return { ok: false, error: t.dropMismatch };
  if (SYSTEM_DATABASES.has(name) || name.endsWith("_shared")) return { ok: false, error: t.dropShared };
  const { db } = deps();
  const active = await activeProjectsOn(db, serverId);
  if (active.some((p) => dbNameFor(p.templateKey, p.slug, p.dbStrategy) === name)) {
    return { ok: false, error: t.dropInUse };
  }
  try {
    await enqueueServerJob(db, await queue(), {
      serverId,
      kind: "db_drop",
      database: name,
      actor: { type: "user", id: viewer.id, name: viewer.name },
    });
  } catch {
    return { ok: false, error: t.queueError };
  }
  revalidatePath("/databases");
  return { ok: true };
}

const quotaInput = z.object({ projectId: z.uuid(), gb: z.number().min(0.1).max(10_000).nullable() });

/** Loyiha joy limiti (ADR 0059): `settings.dbQuotaGb`; null — limitsiz. Oshsa faqat ogohlantiriladi. */
export async function setProjectQuotaAction(input: unknown): Promise<CreateResult> {
  const viewer = await requireViewer("projects.write");
  const parsed = quotaInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.quotaInvalid };
  const { db } = deps();
  const [p] = await db
    .select({ id: projects.id, settings: projects.settings })
    .from(projects)
    .where(and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)));
  if (!p) return { ok: false, error: uz.common.loadError };
  const before = (p.settings as Record<string, unknown>).dbQuotaGb ?? null;
  const settings = { ...(p.settings as Record<string, unknown>) };
  if (parsed.data.gb == null) delete settings.dbQuotaGb;
  else settings.dbQuotaGb = Math.round(parsed.data.gb * 10) / 10;
  await db.update(projects).set({ settings }).where(eq(projects.id, p.id));
  await audit.record(db, {
    actor: { type: "user", id: viewer.id, name: viewer.name },
    action: "project.quota",
    target: { type: "project", id: p.id },
    ...(await requestMeta()),
    metadata: { before, after: settings.dbQuotaGb ?? null },
  });
  revalidatePath("/databases", "layout");
  return { ok: true };
}

const moveInput = z.object({ projectId: z.uuid(), target: z.enum(["own", "shared"]) });

/**
 * Markazni boshqa bazaga ko'chirish (ADR 0059) — faqat super admin, loyiha slug'ini yozib tasdiqlash bilan. Ishchi
 * jarayon bajaradi; ko'chirish paytida sayt bir necha daqiqa yopiq turadi.
 */
export async function moveProjectDbAction(input: unknown, confirm: string): Promise<CreateResult> {
  const viewer = await requireViewer();
  if (viewer.role !== "super_admin") return { ok: false, error: uz.common.noPermission };
  const parsed = moveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: uz.common.loadError };
  const { db } = deps();
  const [p] = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      serverId: projects.serverId,
      dbStrategy: projects.dbStrategy,
    })
    .from(projects)
    .where(and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)));
  if (!p?.serverId) return { ok: false, error: t.moveNoServer };
  if (confirm.trim() !== p.slug) return { ok: false, error: t.moveMismatch };
  if ((parsed.data.target === "shared") === (p.dbStrategy === "shared_db")) return { ok: false, error: t.moveSame };
  try {
    await enqueueServerJob(db, await queue(), {
      serverId: p.serverId,
      kind: "db_move",
      projectId: p.id,
      project: p.name,
      target: parsed.data.target,
      actor: { type: "user", id: viewer.id, name: viewer.name },
    });
  } catch {
    return { ok: false, error: t.queueError };
  }
  revalidatePath("/databases", "layout");
  return { ok: true };
}
