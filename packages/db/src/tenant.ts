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

/*
 * Pul chegaralari (ADR 0060). `app.tenant_id` ulanish parametri bo'lgani uchun har mijozning o'z puli bor va ularni
 * birlashtirib bo'lmaydi. Umumiy bazada ulanishlar soni = faol mijozlar × max, shuning uchun:
 *  - bo'sh ulanish 30 soniyadan keyin yopiladi — sahifa ochilmayotgan mijoz ulanish band qilmaydi;
 *  - ulanish ko'pi bilan 30 daqiqa yashaydi (server tomonidagi xotira to'planib qolmaydi);
 *  - bitta mijozga ko'pi bilan 3 ta ulanish (sahifadagi parallel so'rovlar navbatda kutadi).
 */
export const TENANT_POOL = { max: 3, idleTimeoutSec: 30, maxLifetimeSec: 30 * 60 } as const;

export interface TenantDbOptions {
  max?: number;
  /** Bo'sh ulanish shuncha soniyadan keyin yopiladi */
  idleTimeoutSec?: number;
  maxLifetimeSec?: number;
}

export function createTenantDb(url: string, tenantId: string, options: TenantDbOptions = {}) {
  if (!url) throw new Error("Mijoz bazasi manzili berilmagan");
  if (!tenantId) throw new Error("tenant_id berilmagan");
  const client = postgres(url, {
    max: options.max ?? TENANT_POOL.max,
    idle_timeout: options.idleTimeoutSec ?? TENANT_POOL.idleTimeoutSec,
    max_lifetime: options.maxLifetimeSec ?? TENANT_POOL.maxLifetimeSec,
    // Ulanish parametri sifatida — pul'dagi har ulanishda bir xil, so'rov oralig'ida yo'qolmaydi
    connection: { "app.tenant_id": tenantId },
  });
  const db = drizzle(client, { schema: tenantSchema });
  return Object.assign(db, { close: () => client.end({ timeout: 5 }) });
}

export type TenantDb = ReturnType<typeof createTenantDb>;
