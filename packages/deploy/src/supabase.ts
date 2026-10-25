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

/** Loyihaning anon va service_role API kalitlari */
export async function getSupabaseApiKeys(token: string, ref: string): Promise<SupabaseApiKey[]> {
  return supabaseFetch<SupabaseApiKey[]>(token, `/projects/${ref}/api-keys`);
}

/** Loyihaning connection pooling (Supavisor) konfiguratsiyasi */
export async function getSupabasePoolerConfig(token: string, ref: string): Promise<SupabasePoolerConfig | null> {
  try {
    return await supabaseFetch<SupabasePoolerConfig>(token, `/projects/${ref}/config/database/pooler`);
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
  return `postgres://${user}:${encodedPass}@${host}:${port}/postgres`;
}

/**
 * Supabase PostgreSQL ulanishini tekshirish (1 soniya ichida ping)
 */
export async function testSupabaseConnection(databaseUrl: string): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
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
      await sql.end({ timeout: 3 });
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
