import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/*
 * Sawmill mijoz bazasi migratsiyalari.
 */

export const SAWMILL_MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/sawmill", import.meta.url));

export async function migrateSawmillDb(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: SAWMILL_MIGRATIONS_DIR });
  } finally {
    await client.end({ timeout: 5 });
  }
}
