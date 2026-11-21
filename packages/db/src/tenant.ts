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

const sharedClients = new Map<string, postgres.Sql>();

function getSharedClient(url: string, o: TenantDbOptions) {
  let client = sharedClients.get(url);
  if (!client) {
    client = postgres(url, {
      max: o.max ?? TENANT_POOL.max,
      idle_timeout: o.idleTimeoutSec ?? TENANT_POOL.idleTimeoutSec,
      max_lifetime: o.maxLifetimeSec ?? TENANT_POOL.maxLifetimeSec,
      prepare: false, // transaction mode (6543) da prepared statement ishlamaydi
    });
    sharedClients.set(url, client);
  }
  return client;
}

export function createTenantDb(url: string, tenantId: string, options: TenantDbOptions = {}) {
  if (!url) throw new Error("Mijoz bazasi manzili berilmagan");
  if (!tenantId) throw new Error("tenant_id berilmagan");
  const client = getSharedClient(url, options);
  const db = drizzle(client, { schema: tenantSchema });

  // Standalone so'rovlar (tranzaksiyadan tashqari chaqirilgan select/insert/update/delete):
  // Supabase pooler (6543, transaction mode) sessiya holatini saqlamaydi.
  // Har qanday mustaqil so'rov avtomatik o'z tranzaksiyasida set_config bilan bajariladi.
  type SqlClient = {
    begin?: (tx: (txSql: postgres.Sql) => Promise<unknown>) => Promise<unknown>;
  };

  type PreparedQueryWithSession = {
    execute: (placeholderValues?: unknown) => Promise<unknown>;
    all: (placeholderValues?: unknown) => Promise<unknown>;
    client?: SqlClient;
  };

  type DrizzleSession = {
    prepareQuery: (...args: unknown[]) => PreparedQueryWithSession;
  };

  const session = (db as unknown as { session: DrizzleSession }).session;
  const origPrepare = session.prepareQuery.bind(session);
  session.prepareQuery = function (...args: unknown[]) {
    const pq = origPrepare(...args);
    const origExec = pq.execute.bind(pq);
    const origAll = pq.all.bind(pq);

    pq.execute = async function (placeholderValues?: unknown) {
      if (typeof this.client?.begin === "function") {
        return this.client.begin(async (txSql: postgres.Sql) => {
          await txSql`select set_config(${TENANT_SETTING}, ${tenantId}, true)`;
          this.client = txSql as unknown as SqlClient;
          return origExec(placeholderValues);
        });
      }
      return origExec(placeholderValues);
    };

    pq.all = async function (placeholderValues?: unknown) {
      if (typeof this.client?.begin === "function") {
        return this.client.begin(async (txSql: postgres.Sql) => {
          await txSql`select set_config(${TENANT_SETTING}, ${tenantId}, true)`;
          this.client = txSql as unknown as SqlClient;
          return origAll(placeholderValues);
        });
      }
      return origAll(placeholderValues);
    };

    return pq;
  };

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
  await Promise.all([...sharedClients.values()].map((c) => c.end({ timeout: 5 })));
  sharedClients.clear();
}

export type TenantDb = ReturnType<typeof createTenantDb>;
