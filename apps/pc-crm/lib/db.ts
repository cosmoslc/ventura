import "server-only";
import { createPcCrmDb, type PcCrmDb } from "@ventura/db";

const DEFAULT_DB_URL = "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/pc_crm_dev";

declare global {
  // eslint-disable-next-line no-var
  var __pcCrmDb: PcCrmDb | undefined;
}

export function getDb(): PcCrmDb {
  if (!global.__pcCrmDb) {
    const url = process.env.DATABASE_URL ?? process.env.PC_CRM_DATABASE_URL ?? DEFAULT_DB_URL;
    global.__pcCrmDb = createPcCrmDb(url, { max: 10, idleTimeoutSec: 30, maxLifetimeSec: 300 });
  }
  return global.__pcCrmDb;
}
