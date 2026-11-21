import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as sawmillSchema from "./schema/sawmill";
import { TENANT_POOL, type TenantDbOptions } from "./tenant";

/*
 * Sawmill mijoz bazasiga ulanish. Faqat server kodida.
 * Har ulanishda `app.tenant_id` o'rnatiladi, RLS faqat shu mijoz qatorlarini ko'rsatadi.
 */

export function createSawmillDb(url: string, tenantId: string, options: TenantDbOptions = {}) {
  if (!url) throw new Error("Mijoz bazasi manzili berilmagan");
  if (!tenantId) throw new Error("tenant_id berilmagan");
  const client = postgres(url, {
    max: options.max ?? TENANT_POOL.max,
    idle_timeout: options.idleTimeoutSec ?? TENANT_POOL.idleTimeoutSec,
    max_lifetime: options.maxLifetimeSec ?? TENANT_POOL.maxLifetimeSec,
    connection: { "app.tenant_id": tenantId },
  });
  const db = drizzle(client, { schema: sawmillSchema });
  return Object.assign(db, { close: () => client.end({ timeout: 5 }) });
}

export type SawmillDb = ReturnType<typeof createSawmillDb>;
