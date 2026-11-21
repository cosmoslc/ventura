import crypto from "crypto";
import postgres from "postgres";

/*
 * Supabase Management API mijozi va yordamchilari (ADR 0060).
 * Foydalanuvchi taqdim etgan shaxsiy boshqaruv tokeni (Personal Access Token, sbp_...)
 * orqali tashkilotlar, loyihalar ro'yxatini olish, API kalitlarini o'qish, baza
 * parametrlarini aniqlash va so'rovlarni avtomatik yurgizish.
 */

export const SUPABASE_API_BASE = "https://api.supabase.com/v1";

export interface SupabaseOrg {
  id: string;
  name: string;
}

export interface SupabaseProject {
  id: string; // project ref (masalan 'kndfskfjsdkfhjs')
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  status: string; // 'ACTIVE_HEALTHY' | 'COMING_UP' | 'RESTORING' | 'INACTIVE'
  sizeBytes?: number | null;
  tableCount?: number | null;
}

export interface SupabaseApiKey {
  name: "anon" | "service_role" | string;
  api_key: string;
}

export interface SupabasePoolerConfig {
  db_port: number;
  db_user: string;
  db_host: string;
  db_name: string;
  pool_mode: "transaction" | "session";
}

async function supabaseFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const cleanToken = token.trim();
  const res = await fetch(`${SUPABASE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errMessage = `Supabase API xatosi (${res.status})`;
    try {
      const errJson = (await res.json()) as { message?: string; error?: string };
      errMessage = errJson.message || errJson.error || errMessage;
    } catch {
      // non-json response
    }
    throw new Error(errMessage);
  }

  return (await res.json()) as T;
}

/** Supabase hisobidagi barcha tashkilotlar */
export async function listSupabaseOrganizations(token: string): Promise<SupabaseOrg[]> {
  return supabaseFetch<SupabaseOrg[]>(token, "/organizations");
}

/** Supabase hisobidagi barcha loyihalar */
export async function listSupabaseProjects(token: string): Promise<SupabaseProject[]> {
  return supabaseFetch<SupabaseProject[]>(token, "/projects");
}

/** Bitta loyiha ma'lumoti */
export async function getSupabaseProject(token: string, ref: string): Promise<SupabaseProject> {
  return supabaseFetch<SupabaseProject>(token, `/projects/${ref}`);
}

/**
 * Supabase loyihasi nomini o'zgartirish (Rename project).
 * Supabase Management API: PATCH /projects/{ref}
 */
export async function updateSupabaseProjectName(
  token: string,
  ref: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return supabaseFetch<{ id: string; name: string }>(token, `/projects/${ref}`, {
    method: "PATCH",
    body: JSON.stringify({ name: name.trim() }),
  });
}

/**
 * Xavfsiz, URL-encoding muammolari chiqarmaydigan 24 belgili alfanumerik parol generatsiya qilish.
 */
export function generateSecureDbPassword(length = 24): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let res = "";
  for (let i = 0; i < length; i++) {
    res += chars[bytes[i]! % chars.length];
  }
  return res;
}

/**
 * Supabase bazasining PostgreSQL parolini o'zgartirish/yangilash (Reset password).
 * Supabase Management API: PATCH /projects/{ref}/database/password
 * Agar yangi parol berilmagan bo'lsa, avtomatik 24 belgili kuchli parol generatsiya qilinadi.
 */
export async function resetSupabaseDatabasePassword(token: string, ref: string, newPassword?: string): Promise<string> {
  const password = newPassword?.trim() || generateSecureDbPassword(24);
  await supabaseFetch(token, `/projects/${ref}/database/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
  return password;
}

/** Loyihaning anon va service_role API kalitlari */
export async function getSupabaseApiKeys(token: string, ref: string): Promise<SupabaseApiKey[]> {
  return supabaseFetch<SupabaseApiKey[]>(token, `/projects/${ref}/api-keys`);
}

/** Loyihaning connection pooling (Supavisor) konfiguratsiyasi */
export async function getSupabasePoolerConfig(token: string, ref: string): Promise<SupabasePoolerConfig | null> {
  try {
    const raw = await supabaseFetch<SupabasePoolerConfig | SupabasePoolerConfig[]>(
      token,
      `/projects/${ref}/config/database/pooler`,
    );
    if (Array.isArray(raw)) {
      return raw.find((p) => p && p.db_host) ?? raw[0] ?? null;
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * Supabase loyihasida SQL so'rovini HTTP orqali yurgizish (Management API).
 * DDL yaratish yoki tekshiruvlar uchun juda qulay.
 */
export async function executeSupabaseSql<T = unknown>(token: string, ref: string, sqlQuery: string): Promise<T> {
  return supabaseFetch<T>(token, `/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sqlQuery }),
  });
}

export interface SupabaseDatabaseUsage {
  sizeBytes: number;
  tableCount: number;
}

/**
 * Supabase bazasining xotira hajmi (disk/database size) va jadvallar sonini olish.
 * Management API (/database/query) orqali SQL bajariladi — to'g'ridan-to'g'ri port ochish shart emas.
 */
export async function getSupabaseDatabaseUsage(token: string, ref: string): Promise<SupabaseDatabaseUsage | null> {
  try {
    const res = await executeSupabaseSql<[{ size_bytes: string | number; table_count: string | number }]>(
      token,
      ref,
      "SELECT pg_database_size(current_database())::bigint as size_bytes, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') as table_count;",
    );
    if (Array.isArray(res) && res[0]) {
      return {
        sizeBytes: Number(res[0].size_bytes) || 0,
        tableCount: Number(res[0].table_count) || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Yangi Supabase loyihasi ochish (Management API orqali 1-click)
 */
export async function createSupabaseProject(
  token: string,
  input: {
    name: string;
    organizationId: string;
    dbPass: string;
    region?: string;
    plan?: "free" | "pro";
  },
): Promise<SupabaseProject> {
  return supabaseFetch<SupabaseProject>(token, "/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      organization_id: input.organizationId,
      db_pass: input.dbPass,
      region: input.region || "eu-central-1",
      plan: input.plan || "free",
    }),
  });
}

/**
 * Supabase loyihasi uchun standart Postgres ulanish satrini qurish.
 * Eslatma: RLS va sessiya sozlamalari (`app.tenant_id`) ishonchli ishlashi uchun
 * port 5432 (Session mode yoki Direct) ishlatiladi.
 */
export function buildSupabaseDatabaseUrl(input: {
  projectRef: string;
  region?: string;
  dbPassword: string;
  poolerHost?: string;
  poolerPort?: number;
}): string {
  const { projectRef, region = "eu-central-1", dbPassword, poolerHost, poolerPort } = input;
  const host = poolerHost || `aws-0-${region}.pooler.supabase.com`;
  const port = poolerPort || 5432;
  const user = `postgres.${projectRef}`;
  const encodedPass = encodeURIComponent(dbPassword);
  return `postgres://${user}:${encodedPass}@${host}:${port}/postgres?sslmode=require`;
}

/**
 * Supabase PostgreSQL ulanishini tekshirish.
 * Parol yangilangan bo'lsa Supavisor'ga yetib borishi 1-2 soniya olishi mumkin, shuning uchun qayta urinish bor.
 */
export async function testSupabaseConnection(
  databaseUrl: string,
  retries = 3,
): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  let lastError = "";
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1200));
    }
    try {
      const sql = postgres(databaseUrl, {
        max: 1,
        connect_timeout: 5,
        idle_timeout: 3,
      });
      try {
        const rows = await sql<{ version: string }[]>`SELECT version()`;
        return { ok: true, version: rows[0]?.version ?? "unknown" };
      } finally {
        await sql.end({ timeout: 3 }).catch(() => {});
      }
    } catch (e) {
      lastError = (e as Error).message;
      if (attempt < retries - 1) continue;
    }
  }
  return { ok: false, error: lastError };
}
