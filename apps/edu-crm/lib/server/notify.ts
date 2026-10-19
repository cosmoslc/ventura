import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Permission } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import { notifications, positions, userBranches, userPositions, users } from "@ventura/db/schema/tenant";
import type { NotificationDraft } from "@/lib/notifications";

/*
 * Ichki bildirishnoma yozish (E6d, ADR 0039). Qabul qiluvchilar yozish vaqtida aniqlanadi va filial doirasiga amal
 * qilinadi: direktor — hamma filialdan, boshqa xodim — ruxsati lavozimidan va filiali o'ziga biriktirilgan bo'lsa.
 * Bildirishnoma asosiy amalni to'xtatmaydi: yozilmasa xato faqat server logiga (Telegram xabarlari bilan bir xil).
 */

/**
 * Berilgan ruxsatlardan birortasi bor (lavozimidan) va shu filialga biriktirilgan xodimlar + direktorlar.
 * `branchId` null — filial cheklovi yo'q (filialsiz yozuv). Arxivdagi (bo'shatilgan) xodim kirmaydi.
 */
export async function staffWithPermission(
  db: TenantDb,
  permissions: readonly Permission[],
  branchId: string | null,
): Promise<string[]> {
  const list = sql.join(
    permissions.map((p) => sql`${p}`),
    sql`, `,
  );
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.archivedAt),
        // O'qituvchi hisobi (ADR 0062) admin bildirishnomalarini olmaydi
        eq(users.kind, "staff"),
        or(
          eq(users.role, "director"),
          and(
            sql`exists (
              select 1 from ${userPositions}
              join ${positions} on ${positions.id} = ${userPositions.positionId}
              where ${userPositions.userId} = ${users.id} and ${positions.permissions} && array[${list}]::text[]
            )`,
            branchId
              ? sql`exists (select 1 from ${userBranches} where ${userBranches.userId} = ${users.id} and ${userBranches.branchId} = ${branchId})`
              : undefined,
          ),
        ),
      ),
    );
  return rows.map((r) => r.id);
}

/** Barcha (bo'shatilmagan) direktorlar — tasdiq so'rovlari shularga boradi. */
export async function directorIds(db: TenantDb): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "director"), isNull(users.archivedAt)));
  return rows.map((r) => r.id);
}

/**
 * Har qabul qiluvchiga bittadan bildirishnoma. Takror va `except` (amalni o'zi qilgan xodim) olib tashlanadi.
 * Yozilganlar sonini qaytaradi; xatoda — 0 (asosiy amal buzilmasin).
 */
export async function notify(
  db: TenantDb,
  recipients: readonly string[],
  draft: NotificationDraft,
  except?: string | null,
): Promise<number> {
  const ids = [...new Set(recipients)].filter((id) => id !== except);
  if (!ids.length) return 0;
  try {
    await db.insert(notifications).values(
      ids.map((userId) => ({
        userId,
        kind: draft.kind,
        title: draft.title,
        body: draft.body ?? null,
        href: draft.href ?? null,
      })),
    );
    return ids.length;
  } catch (e) {
    console.error("[notify] bildirishnoma yozilmadi:", (e as Error).message);
    return 0;
  }
}
