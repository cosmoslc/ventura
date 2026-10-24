import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import type { SawmillLocale, SawmillRole } from "@ventura/db/schema/sawmill";
import { users } from "@ventura/db/schema/sawmill";
import type { Tenant } from "@ventura/tenants";
import { type SawmillTenantDeps, sawmillDeps } from "./deps";
import { currentTenant } from "./tenant";

export interface SawmillUser {
  id: string;
  name: string;
  phone: string;
  role: SawmillRole;
  locale: SawmillLocale;
}

export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3003";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function requireTenant(): Promise<Tenant> {
  const tenant = await currentTenant();
  if (!tenant) notFound();
  return tenant;
}

export const currentDeps = cache(async (): Promise<{ tenant: Tenant; deps: SawmillTenantDeps | null }> => {
  const tenant = await requireTenant();
  return { tenant, deps: sawmillDeps(tenant) };
});

export const currentSession = cache(async () => {
  const { tenant, deps } = await currentDeps();
  if (!deps) return null;
  const h = await headers();
  const origin = await requestOrigin();
  const auth = deps.auth(origin);
  try {
    const session = await auth.api.getSession({ headers: h });
    if (!session?.user) return null;

    const [u] = await deps.db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phoneNumber,
        role: users.role,
        locale: users.locale,
        archivedAt: users.archivedAt,
        lockedAt: users.lockedAt,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!u || u.archivedAt || u.lockedAt) return null;

    return {
      session: session.session,
      user: {
        id: u.id,
        name: u.name,
        phone: u.phone ?? "",
        role: u.role as SawmillRole,
        locale: (u.locale ?? "uz") as SawmillLocale,
      } satisfies SawmillUser,
      tenant,
      deps,
    };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<{
  user: SawmillUser;
  tenant: Tenant;
  deps: SawmillTenantDeps;
}> {
  const s = await currentSession();
  if (!s) redirect("/login");
  return { user: s.user, tenant: s.tenant, deps: s.deps };
}
