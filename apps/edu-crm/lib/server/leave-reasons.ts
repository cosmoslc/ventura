import "server-only";
import { eq } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/tenant";
import { DEFAULT_LEAVE_REASONS, LEAVE_REASONS_KEY, parseReasonList } from "@/lib/reasons";

/** Guruhdan chiqish sabablari (ADR 0031): sozlamada bo'lmasa — standart ro'yxat */
export async function getLeaveReasons(db: TenantDb): Promise<string[]> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, LEAVE_REASONS_KEY));
  return row ? parseReasonList(row.value, DEFAULT_LEAVE_REASONS) : [...DEFAULT_LEAVE_REASONS];
}
