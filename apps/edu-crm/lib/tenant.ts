import "server-only";
import { readFileSync, statSync } from "node:fs";
import { type Tenant, type TenantRegistry, emptyRegistry, findTenant, parseRegistry } from "@ventura/tenants";

/*
 * Mijozni so'rov domeni bo'yicha aniqlash (SPEC 8: `shared` rejim). Ro'yxat fayli deploy paytida yoziladi;
 * fayl o'zgarsa (yangi mijoz, rang, bo'lim) ilova qayta ishga tushirilmasdan yangisini o'qiydi.
 */

let cache: { mtimeMs: number; registry: TenantRegistry } | null = null;

function loadRegistry(): TenantRegistry {
  const file = process.env.VENTURA_TENANTS_FILE;
  if (!file) return emptyRegistry();
  try {
    const { mtimeMs } = statSync(file);
    if (cache?.mtimeMs === mtimeMs) return cache.registry;
    const registry = parseRegistry(readFileSync(file, "utf8"));
    cache = { mtimeMs, registry };
    return registry;
  } catch (e) {
    // Fayl yozilayotgan paytda o'qilsa yoki buzilgan bo'lsa: oxirgi yaxshi holat bilan ishlashda davom etadi
    console.error("[tenants] ro'yxatni o'qib bo'lmadi:", (e as Error).message);
    return cache?.registry ?? emptyRegistry();
  }
}

export function tenantForHost(host: string | null): Tenant | null {
  return findTenant(loadRegistry(), host);
}

let commitCache: string | null | undefined;

/** Ishlab turgan versiya (commit). Deploy har relizga `.ventura-commit` faylini yozadi; jarayon uni bir marta o'qiydi. */
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
