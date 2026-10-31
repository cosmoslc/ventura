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

export async function getDbShippingRates() {
  const db = getDb();
  return db
    .select()
    .from(shippingRates)
    .where(eq(shippingRates.enabled, true));
}
