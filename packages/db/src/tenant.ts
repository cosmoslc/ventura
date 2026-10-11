import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as tenantSchema from "./schema/tenant";

/*
 * Mijoz (shablon) bazasiga ulanish. Faqat server kodida.
 *
 * Har ulanish ochilishida `app.tenant_id` parametri beriladi: tenant_id ustuni standart qiymatni shundan
 * oladi va RLS faqat shu mijoz qatorlarini ko'rsatadi. Shuning uchun ilova kodi tenant_id ni qo'lda
 * yozmaydi va filtrlashni unutib qo'ya olmaydi. Strategiya (umumiy baza yoki alohida baza) faqat URL'da farq qiladi.
 */

export function createTenantDb(url: string, tenantId: string, options: { max?: number } = {}) {
  if (!url) throw new Error("Mijoz bazasi manzili berilmagan");
  if (!tenantId) throw new Error("tenant_id berilmagan");
  const client = postgres(url, {
    max: options.max ?? 5,
    // Ulanish parametri sifatida — pul'dagi har ulanishda bir xil, so'rov oralig'ida yo'qolmaydi
    connection: { "app.tenant_id": tenantId },
  });
  const db = drizzle(client, { schema: tenantSchema });
  return Object.assign(db, { close: () => client.end({ timeout: 5 }) });
}

export type TenantDb = ReturnType<typeof createTenantDb>;
