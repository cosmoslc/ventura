import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { createStaffAuth, setStaffPassword } from "@ventura/auth/staff";
import { type PanelDb, type TenantDb, createTenantDb } from "@ventura/db";
import { projects } from "@ventura/db/schema/panel";
import { accounts, users } from "@ventura/db/schema/tenant";
import { accounts as pcAccounts, users as pcUsers } from "@ventura/db/schema/pc-crm";
import { buildSupabaseDatabaseUrl, dbNameFor, dbPasswordOwner } from "@ventura/deploy";
import { type AuditActor, audit, putSecret, readSecret } from "@ventura/security";

/*
 * Loyihaning mijoz bazasi bilan ishlash (direktor holati, blokdan chiqarish, parolni tiklash).
 * Muallif / Agent: Google Gemini
 */

export interface ProjectDirectorInfo {
  id: string;
  name: string;
  phone: string;
  locked: boolean;
  lockedAt: string | null;
  failedAttempts: number;
  mustChangePassword: boolean;
}

export async function getProjectTenantDb(
  panelDb: PanelDb,
  project: { id: string; templateKey: string; slug: string; dbStrategy: string; serverId: string | null; settings?: any },
): Promise<TenantDb | null> {
  try {
    // 1. Agar loyiha Supabase'ga ko'chirilgan bo'lsa (settings.supabase)
    if (project.settings?.supabase?.projectRef) {
      const supa = project.settings.supabase;
      const dbPassword = await readSecret(panelDb, { type: "project", id: project.id }, "db_password");
      if (!dbPassword) return null;
      const databaseUrl = buildSupabaseDatabaseUrl({
        projectRef: supa.projectRef,
        region: supa.region,
        dbPassword,
        poolerHost: supa.poolerHost,
        poolerPort: supa.poolerPort,
      });
      return createTenantDb(databaseUrl, project.slug, { max: 1 });
    }

    // 2. Mahalliy VPS serveridagi PostgreSQL bazasi
    const dbName = dbNameFor(project.templateKey, project.slug, project.dbStrategy);
    const pwOwner = dbPasswordOwner(
      project.dbStrategy === "shared_db" ? "shared" : "project",
      { serverId: project.serverId ?? "", projectId: project.id },
      dbName,
    );
    const dbPassword = await readSecret(panelDb, pwOwner.owner, pwOwner.name);
    if (!dbPassword) return null;
    const databaseUrl = `postgres://${dbName}:${encodeURIComponent(dbPassword)}@127.0.0.1:5432/${dbName}`;
    return createTenantDb(databaseUrl, project.slug, { max: 1 });
  } catch {
    return null;
  }
}

export async function getProjectDirectorInfo(
  panelDb: PanelDb,
  project: { id: string; templateKey: string; slug: string; dbStrategy: string; serverId: string | null; ownerPhone?: string | null; settings?: any },
): Promise<ProjectDirectorInfo | null> {
  const tenantDb = await getProjectTenantDb(panelDb, project);
  if (!tenantDb) return null;
  try {
    if (project.templateKey === "pc-crm") {
      const [admin] = await tenantDb.run(async (tx) =>
        tx
          .select({
            id: pcUsers.id,
            name: pcUsers.name,
            phone: pcUsers.phone,
            lockedAt: pcUsers.lockedAt,
            failedAttempts: pcUsers.failedAttempts,
          })
          .from(pcUsers)
          .where(eq(pcUsers.role, "admin"))
          .limit(1),
      );

      if (!admin) return null;

      return {
        id: admin.id,
        name: admin.name,
        phone: admin.phone ?? "",
        locked: Boolean(admin.lockedAt || admin.failedAttempts >= 5),
        lockedAt: admin.lockedAt ? admin.lockedAt.toISOString() : null,
        failedAttempts: admin.failedAttempts,
        mustChangePassword: false,
      };
    }

    const [director] = await tenantDb.run(async (tx) =>
      tx
        .select({
          id: users.id,
          name: users.name,
          phone: users.phoneNumber,
          lockedAt: users.lockedAt,
          failedAttempts: users.failedAttempts,
          mustChangePassword: users.mustChangePassword,
        })
        .from(users)
        .where(eq(users.role, "director"))
        .limit(1),
    );

    if (!director) return null;

    return {
      id: director.id,
      name: director.name,
      phone: director.phone ?? "",
      locked: Boolean(director.lockedAt || director.failedAttempts >= 5),
      lockedAt: director.lockedAt ? director.lockedAt.toISOString() : null,
      failedAttempts: director.failedAttempts,
      mustChangePassword: director.mustChangePassword,
    };
  } catch {
    return null;
  } finally {
    void tenantDb.close().catch(() => {});
  }
}

export async function unlockProjectDirector(
  panelDb: PanelDb,
  projectId: string,
  actor: AuditActor,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [project] = await panelDb
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);
  if (!project) return { ok: false, error: "Loyiha topilmadi" };

  const tenantDb = await getProjectTenantDb(panelDb, project);
  if (!tenantDb) return { ok: false, error: "Mijoz bazasiga ulanib bo'lmadi" };

  try {
    if (project.templateKey === "pc-crm") {
      const [admin] = await tenantDb.run(async (tx) =>
        tx
          .select({ id: pcUsers.id, name: pcUsers.name, phone: pcUsers.phone })
          .from(pcUsers)
          .where(eq(pcUsers.role, "admin"))
          .limit(1),
      );

      if (!admin) return { ok: false, error: "Admin foydalanuvchi topilmadi" };

      await tenantDb.run(async (tx) =>
        tx
          .update(pcUsers)
          .set({
            failedAttempts: 0,
            lockedAt: null,
          })
          .where(eq(pcUsers.id, admin.id)),
      );

      await audit.record(panelDb, {
        actor,
        action: "project.director_unlocked",
        target: { type: "project", id: projectId },
        ...meta,
        metadata: {
          directorId: admin.id,
          directorName: admin.name,
          directorPhone: admin.phone,
        },
      });

      return { ok: true };
    }

    const [director] = await tenantDb.run(async (tx) =>
      tx
        .select({ id: users.id, name: users.name, phone: users.phoneNumber })
        .from(users)
        .where(eq(users.role, "director"))
        .limit(1),
    );

    if (!director) return { ok: false, error: "Direktor topilmadi" };

    await tenantDb.run(async (tx) =>
      tx
        .update(users)
        .set({
          failedAttempts: 0,
          lockedAt: null,
        })
        .where(eq(users.id, director.id)),
    );

    await audit.record(panelDb, {
      actor,
      action: "project.director_unlocked",
      target: { type: "project", id: projectId },
      ...meta,
      metadata: {
        directorId: director.id,
        directorName: director.name,
        directorPhone: director.phone,
      },
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? "Blokdan chiqarishda xatolik yuz berdi" };
  } finally {
    void tenantDb.close().catch(() => {});
  }
}

export async function resetProjectDirectorPassword(
  panelDb: PanelDb,
  projectId: string,
  newPassword: string,
  actor: AuditActor,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" };
  }

  const [project] = await panelDb
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);
  if (!project) return { ok: false, error: "Loyiha topilmadi" };

  const tenantDb = await getProjectTenantDb(panelDb, project);
  if (!tenantDb) return { ok: false, error: "Mijoz bazasiga ulanib bo'lmadi" };

  try {
    if (project.templateKey === "pc-crm") {
      const [admin] = await tenantDb.run(async (tx) =>
        tx
          .select({ id: pcUsers.id, name: pcUsers.name, phone: pcUsers.phone })
          .from(pcUsers)
          .where(eq(pcUsers.role, "admin"))
          .limit(1),
      );

      if (!admin) return { ok: false, error: "Admin foydalanuvchi topilmadi" };

      const authSecret = await readSecret(panelDb, { type: "project", id: projectId }, "auth_secret");
      if (!authSecret) return { ok: false, error: "Loyiha auth_secret kaliti topilmadi" };

      const auth = createStaffAuth({
        db: tenantDb,
        telegram: null,
        appName: project.name,
        secret: authSecret,
        baseURL: "http://localhost",
      });

      const ctx = await auth.$context;
      const hash = await ctx.password.hash(newPassword);

      await tenantDb.run(async (tx) => {
        await tx.update(pcAccounts).set({ password: hash }).where(eq(pcAccounts.userId, admin.id));
        await tx
          .update(pcUsers)
          .set({
            failedAttempts: 0,
            lockedAt: null,
          })
          .where(eq(pcUsers.id, admin.id));
      });

      // Panel sirlar jadvalida ham owner_password ni yangilaymiz (sinxronlik uchun)
      await putSecret(panelDb, { type: "project", id: projectId }, "owner_password", newPassword);

      await audit.record(panelDb, {
        actor,
        action: "project.director_password_reset",
        target: { type: "project", id: projectId },
        ...meta,
        metadata: {
          directorId: admin.id,
          directorName: admin.name,
          directorPhone: admin.phone,
        },
      });

      return { ok: true };
    }

    const [director] = await tenantDb.run(async (tx) =>
      tx
        .select({ id: users.id, name: users.name, phone: users.phoneNumber })
        .from(users)
        .where(eq(users.role, "director"))
        .limit(1),
    );

    if (!director) return { ok: false, error: "Direktor topilmadi" };

    const authSecret = await readSecret(panelDb, { type: "project", id: projectId }, "auth_secret");
    if (!authSecret) return { ok: false, error: "Loyiha auth_secret kaliti topilmadi" };

    const auth = createStaffAuth({
      db: tenantDb,
      telegram: null,
      appName: project.name,
      secret: authSecret,
      baseURL: "http://localhost",
    });

    const ctx = await auth.$context;
    const hash = await ctx.password.hash(newPassword);

    await tenantDb.run(async (tx) => {
      await tx.update(accounts).set({ password: hash }).where(eq(accounts.userId, director.id));
      await tx
        .update(users)
        .set({
          failedAttempts: 0,
          lockedAt: null,
          mustChangePassword: false,
        })
        .where(eq(users.id, director.id));
    });

    // Panel sirlar jadvalida ham owner_password ni yangilaymiz (sinxronlik uchun)
    await putSecret(panelDb, { type: "project", id: projectId }, "owner_password", newPassword);

    await audit.record(panelDb, {
      actor,
      action: "project.director_password_reset",
      target: { type: "project", id: projectId },
      ...meta,
      metadata: {
        directorId: director.id,
        directorName: director.name,
        directorPhone: director.phone,
      },
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? "Parolni yangilashda xatolik yuz berdi" };
  } finally {
    void tenantDb.close().catch(() => {});
  }
}
