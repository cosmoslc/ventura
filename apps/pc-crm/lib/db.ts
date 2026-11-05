import "server-only";
import { createPcCrmDb, type PcCrmDb } from "@ventura/db";
import { defaultTenantSecret } from "./server/tenant";

const DEFAULT_DB_URL = "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/pc_crm_dev";

declare global {
  // eslint-disable-next-line no-var
  var __pcCrmDb: PcCrmDb | undefined;
}

let activeUrl: string | undefined;

export function getDb(): PcCrmDb {
  const secret = defaultTenantSecret();
  const url =
    process.env.DATABASE_URL ??
    process.env.PC_CRM_DATABASE_URL ??
    secret?.databaseUrl ??
    DEFAULT_DB_URL;

  if (!global.__pcCrmDb || activeUrl !== url) {
    if (global.__pcCrmDb) void global.__pcCrmDb.close().catch(() => {});
    activeUrl = url;
    global.__pcCrmDb = createPcCrmDb(url, { max: 10, idleTimeoutSec: 30, maxLifetimeSec: 300 });
  }
  return global.__pcCrmDb;
}
