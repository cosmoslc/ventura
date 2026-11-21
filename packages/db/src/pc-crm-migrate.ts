import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/*
 * PC-CRM mijoz bazasi migratsiyalari (Dedicated Silo model).
 */

export const PC_CRM_MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/pc-crm", import.meta.url));

export async function migratePcCrmDb(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: PC_CRM_MIGRATIONS_DIR });
  } finally {
    await client.end({ timeout: 5 });
  }
}
