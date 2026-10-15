import "server-only";
import { inArray } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/tenant";
import { REASON_CATEGORY_LIST, REASON_SWITCHES_KEY, type ReasonsConfig, buildReasonsConfig } from "@/lib/reasons";

/** Hamma sabab ro'yxatlari va yoqgichlar (ADR 0035): sozlamada bo'lmasa — standart */
export async function getReasonsConfig(db: TenantDb): Promise<ReasonsConfig> {
  const keys = [...REASON_CATEGORY_LIST.map((c) => c.key), REASON_SWITCHES_KEY];
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, keys));
  return buildReasonsConfig(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}
