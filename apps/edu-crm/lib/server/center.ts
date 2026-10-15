import "server-only";
import { eq } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/tenant";
import { CENTER_KEY, type CenterSettings, parseCenter } from "@/lib/center-settings";
import { RECEIPT_KEY, type ReceiptConfig, parseReceiptConfig } from "@/lib/receipt-config";

/* Markaz va chek sozlamalari (E6a, E6b): `settings` jadvalidan; yo'q yoki buzilgan bo'lsa — standart. */

export async function getCenterSettings(db: TenantDb): Promise<CenterSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, CENTER_KEY));
  return parseCenter(row?.value);
}

export async function getReceiptConfig(db: TenantDb): Promise<ReceiptConfig> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, RECEIPT_KEY));
  return parseReceiptConfig(row?.value);
}

/** `settings` qatorini yozadi (bor bo'lsa almashtiradi); oldingi qiymatni qaytaradi (jurnal uchun) */
export async function putSetting(db: TenantDb, key: string, value: unknown, staffId: string): Promise<unknown> {
  const [before] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key));
  await db
    .insert(settings)
    .values({ key, value, updatedBy: staffId })
    .onConflictDoUpdate({
      target: [settings.tenantId, settings.key],
      set: { value, updatedBy: staffId, updatedAt: new Date() },
    });
  return before?.value ?? null;
}
