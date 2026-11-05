import "server-only";
import { createPcCrmDb, type PcCrmDb } from "@ventura/db";

const DB_URL = process.env.DATABASE_URL ?? process.env.PC_CRM_DATABASE_URL;

declare global {
  // eslint-disable-next-line no-var
  var __pcCrmDb: PcCrmDb | undefined;
}

export function getDb(): PcCrmDb {
  if (!global.__pcCrmDb) {
    if (!DB_URL) throw new Error("DATABASE_URL yoki PC_CRM_DATABASE_URL majburiy");
    global.__pcCrmDb = createPcCrmDb(DB_URL, { max: 10, idleTimeoutSec: 30, maxLifetimeSec: 300 });
  }
  return global.__pcCrmDb;
}
