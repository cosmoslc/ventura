import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/*
 * Mijoz bazasi migratsiyalari (baza egasi nomidan). Panel fon vazifasi, CLI va testlar ishlatadi;
 * ilova (edu-crm) bu modulni import qilmaydi — u faqat tayyor bazaga ulanadi.
 */

export const TENANT_MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/tenant", import.meta.url));

export async function migrateTenantDb(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: TENANT_MIGRATIONS_DIR });
  } finally {
    await client.end({ timeout: 5 });
  }
}

/**
 * Umumiy bazada (shared_db) jadvallar egasi migratsiya foydalanuvchisi, ilova esa boshqa foydalanuvchi:
 * unga faqat ma'lumot bilan ishlash huquqi beriladi (sxema o'zgartirolmaydi, RLS undan o'tkazmaydi).
 * Faoliyat jurnalida UPDATE/DELETE yo'q — trigger ham baribir to'xtatadi.
 */
export async function grantTenantApp(ownerUrl: string, appRole: string) {
  const client = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    await client`grant usage on schema public to ${client(appRole)}`;
    await client`grant select, insert, update, delete on all tables in schema public to ${client(appRole)}`;
    await client`grant usage, select on all sequences in schema public to ${client(appRole)}`;
    await client`revoke update, delete, truncate on audit_events from ${client(appRole)}`;
  } finally {
    await client.end({ timeout: 5 });
  }
}
