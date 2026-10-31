import "server-only";
import { createPcCrmDb, type PcCrmDb } from "@ventura/db";

const DB_URL =
  process.env.DATABASE_URL ??
  process.env.PC_CRM_DATABASE_URL ??
  "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/pc_crm_dev";

declare global {
  // eslint-disable-next-line no-var
  var __pcCrmDb: PcCrmDb | undefined;
}

export function getDb(): PcCrmDb {
  if (process.env.NODE_ENV === "production") {
    return createPcCrmDb(DB_URL);
  }
  if (!global.__pcCrmDb) {
    global.__pcCrmDb = createPcCrmDb(DB_URL);
  }
  return global.__pcCrmDb;
}
