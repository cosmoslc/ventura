import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as pcCrmSchema from "./schema/pc-crm";
import { TENANT_POOL, type TenantDbOptions } from "./tenant";

/*
 * PC-CRM mijoz bazasiga ulanish. Faqat server kodida.
 * Dedicated (Silo) model bo'lgani sababli `tenant_id` va RLS sessiya sozlamalari shart emas.
 */

export function createPcCrmDb(url: string, options: TenantDbOptions = {}) {
  if (!url) throw new Error("Mijoz bazasi manzili (DATABASE_URL) berilmagan");
  const client = postgres(url, {
    max: options.max ?? TENANT_POOL.max,
    idle_timeout: options.idleTimeoutSec ?? TENANT_POOL.idleTimeoutSec,
    max_lifetime: options.maxLifetimeSec ?? TENANT_POOL.maxLifetimeSec,
  });
  const db = drizzle(client, { schema: pcCrmSchema });
  return Object.assign(db, { close: () => client.end({ timeout: 5 }) });
}

export type PcCrmDb = ReturnType<typeof createPcCrmDb>;
