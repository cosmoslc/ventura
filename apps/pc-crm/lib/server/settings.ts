import "server-only";
import { eq } from "drizzle-orm";
import { settings, shippingRates } from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";

export async function getDbSettings(): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db.select().from(settings);
  const result: Record<string, unknown> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

export async function updateDbSetting(key: string, value: unknown) {
  const db = getDb();
  return db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getDbShippingRates(includeDisabled = false) {
  const db = getDb();
  const query = db.select().from(shippingRates);
  return includeDisabled ? query : query.where(eq(shippingRates.enabled, true));
}

export async function saveDbShippingRates(rates: { region: string; price: bigint; enabled: boolean; estimatedDays?: string }[]) {
  const db = getDb();
  return db.transaction(async (tx) => {
    for (const rate of rates) {
      await tx.insert(shippingRates).values(rate).onConflictDoUpdate({
        target: shippingRates.region,
        set: { price: rate.price, enabled: rate.enabled, estimatedDays: rate.estimatedDays, updatedAt: new Date() },
      });
    }
  });
}
