import { eq } from "drizzle-orm";
import { z } from "zod";
import type { SawmillDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/sawmill";

export const sawmillSettingsSchema = z.object({
  profitMode: z.enum(["estimated", "actual"]).default("estimated"),
  qtyDisplay: z.enum(["piece", "cube", "both"]).default("piece"),
  cubeInputMode: z.enum(["direct", "calculated"]).default("direct"),
  dimensionUnit: z.enum(["mm", "sm", "m"]).default("sm"),
});

export type SawmillSettings = z.infer<typeof sawmillSettingsSchema>;

export const DEFAULT_SETTINGS: SawmillSettings = {
  profitMode: "estimated",
  qtyDisplay: "piece",
  cubeInputMode: "direct",
  dimensionUnit: "sm",
};

const SETTINGS_KEY = "general";

/**
 * Sex sozlamalarini bazadan o'qiydi yoki standart qiymatlarni qaytaradi.
 */
export async function getSawmillSettings(db: SawmillDb): Promise<SawmillSettings> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);

  if (!row?.value) return DEFAULT_SETTINGS;
  const parsed = sawmillSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

/**
 * Sex sozlamalarini saqlaydi (upsert).
 */
export async function saveSawmillSettings(
  db: SawmillDb,
  userId: string | null,
  newSettings: Partial<SawmillSettings>,
): Promise<SawmillSettings> {
  const current = await getSawmillSettings(db);
  const updated = sawmillSettingsSchema.parse({ ...current, ...newSettings });
  const validUserId = userId && z.string().uuid().safeParse(userId).success ? userId : null;

  await db
    .insert(settings)
    .values({
      key: SETTINGS_KEY,
      value: updated,
      updatedBy: validUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [settings.tenantId, settings.key],
      set: {
        value: updated,
        updatedBy: validUserId,
        updatedAt: new Date(),
      },
    });

  return updated;
}
