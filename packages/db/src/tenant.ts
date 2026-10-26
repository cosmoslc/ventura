import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as tenantSchema from "./schema/tenant";
import { TENANT_SETTING } from "./schema/tenant/columns";

/*
 * Mijoz bazasiga ulanish. Faqat server kodida.
 *
 * `app.tenant_id` ulanishga EMAS, har tranzaksiyaga beriladi (set_config, is_local = true).
 * Supabase pooler (6543, transaction mode) startup parametrlarni tashlab yuboradi, va
 * ulanish darajasidagi SET tenantlar aralashib ketishiga olib kelishi mumkin.
 * Tranzaksiya tugagach sozlama o'zi tozalanadi, hech narsa qolib ketmaydi.
 *
 * Tenant ulanishga bog'lanmagani uchun bitta URL uchun bitta umumiy client yetadi.
 */
export const TENANT_POOL = { max: 10, idleTimeoutSec: 30, maxLifetimeSec: 30 * 60 } as const;

export interface TenantDbOptions {
  max?: number;
  idleTimeoutSec?: number;
  maxLifetimeSec?: number;
}

type Db = PostgresJsDatabase<typeof tenantSchema>;
export type TenantTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const shared = new Map<string, { client: postgres.Sql; db: Db }>();

function getShared(url: string, o: TenantDbOptions) {
  let entry = shared.get(url);
  if (!entry) {
    const client = postgres(url, {
      max: o.max ?? TENANT_POOL.max,
      idle_timeout: o.idleTimeoutSec ?? TENANT_POOL.idleTimeoutSec,
      max_lifetime: o.maxLifetimeSec ?? TENANT_POOL.maxLifetimeSec,
      prepare: false, // transaction mode (6543) da prepared statement ishlamaydi
    });
    entry = { client, db: drizzle(client, { schema: tenantSchema }) };
    shared.set(url, entry);
  }
  return entry;
}

export function createTenantDb(url: string, tenantId: string, options: TenantDbOptions = {}) {
  if (!url) throw new Error("Mijoz bazasi manzili berilmagan");
  if (!tenantId) throw new Error("tenant_id berilmagan");
  const { client, db } = getShared(url, options);

  const runner = {
    $client: client,
    /** Barcha tenant so'rovlari shu orqali o'tadi: set_config + so'rovlar bitta tranzaksiyada */
    run<T>(fn: (tx: TenantTx) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select set_config(${TENANT_SETTING}, ${tenantId}, true)`);
        return fn(tx);
      });
    },
    transaction<T>(fn: (tx: TenantTx) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select set_config(${TENANT_SETTING}, ${tenantId}, true)`);
        return fn(tx);
      });
    },
    /** Umumiy client yopilmaydi (boshqa tenantlar ishlatyapti). Jarayon tugaganda closeTenantClients() */
    close: async () => {},
  };

  return Object.assign(Object.create(db), runner) as Db & typeof runner;
}

export async function closeTenantClients() {
  await Promise.all([...shared.values()].map((e) => e.client.end({ timeout: 5 })));
  shared.clear();
}

export type TenantDb = ReturnType<typeof createTenantDb>;
