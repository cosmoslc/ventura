import "server-only";
import { readFileSync, statSync } from "node:fs";
import { headers } from "next/headers";
import { cache } from "react";
import {
  type Tenant,
  type TenantRegistry,
  type TenantSecret,
  type TenantSecrets,
  emptyRegistry,
  emptySecrets,
  findTenant,
  parseRegistry,
  parseSecrets,
} from "@ventura/tenants";

function fileCache<T>(envName: string, parse: (text: string) => T, empty: () => T, label: string) {
  let cached: { mtimeMs: number; value: T } | null = null;
  return (): T => {
    const file = process.env[envName];
    if (!file) return empty();
    try {
      const { mtimeMs } = statSync(file);
      if (cached?.mtimeMs === mtimeMs) return cached.value;
      const value = parse(readFileSync(file, "utf8"));
      cached = { mtimeMs, value };
      return value;
    } catch (e) {
      console.error(`[${label}] faylni o'qib bo'lmadi:`, (e as Error).message);
      return cached?.value ?? empty();
    }
  };
}

const loadRegistry = fileCache<TenantRegistry>("VENTURA_TENANTS_FILE", parseRegistry, emptyRegistry, "tenants");
const loadSecrets = fileCache<TenantSecrets>(
  "VENTURA_TENANT_SECRETS_FILE",
  parseSecrets,
  emptySecrets,
  "tenant-secrets",
);

export function tenantForHost(host: string | null): Tenant | null {
  return findTenant(loadRegistry(), host);
}

export function allTenants(): Tenant[] {
  return loadRegistry().tenants;
}

export const currentTenant = cache(async (): Promise<Tenant | null> => tenantForHost((await headers()).get("host")));

export function tenantSecret(tenant: Pick<Tenant, "slug">): TenantSecret | null {
  return loadSecrets().tenants[tenant.slug] ?? null;
}

let commitCache: string | null | undefined;

export function commit(): string | null {
  if (commitCache !== undefined) return commitCache;
  const file = process.env.VENTURA_COMMIT_FILE;
  try {
    commitCache = file ? readFileSync(file, "utf8").trim() || null : (process.env.VENTURA_COMMIT ?? null);
  } catch {
    commitCache = null;
  }
  return commitCache;
}
