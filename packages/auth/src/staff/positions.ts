import { and, eq, inArray, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { positions, userPositions, users } from "@ventura/db/schema/tenant";
import { LEGACY_ROLE_TEMPLATE, POSITION_TEMPLATES, VIEW_PERMISSIONS } from "./policy";

/*
 * Lavozimlarni tayyorlash (EDU-CRM-PLAN 14-qaror). Markazda lavozim bo'lmasa — 7 ta tayyor shablon qo'shiladi;
 * lavozimlardan oldin yaratilgan xodimlar (manager / cashier / viewer) mos lavozimga o'tkaziladi. Qayta chaqirish
 * xavfsiz: bor narsa o'zgartirilmaydi. Mijoz ulanishi bilan (RLS) — faqat shu markaz.
 */

const VIEWER_CODE = "viewer";
const VIEWER_NAME = "Kuzatuvchi";
const LEGACY_ROLES = ["manager", "cashier", "viewer"] as const;

export async function ensurePositions(db: TenantDb): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: positions.id }).from(positions).limit(1);
    if (!existing.length) {
      await tx.insert(positions).values(
        POSITION_TEMPLATES.map((t) => ({
          code: t.code,
          name: t.name,
          color: t.color,
          permissions: [...t.permissions],
          system: t.system,
        })),
      );
    }

    const legacy = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(inArray(users.role, [...LEGACY_ROLES]), isNull(users.archivedAt)));
    if (!legacy.length) return;

    const byCode = new Map(
      (await tx.select({ id: positions.id, code: positions.code }).from(positions)).map((p) => [p.code, p.id]),
    );
    for (const u of legacy) {
      const code = LEGACY_ROLE_TEMPLATE[u.role] ?? VIEWER_CODE;
      let positionId = byCode.get(code);
      if (!positionId && code === VIEWER_CODE) {
        const [row] = await tx
          .insert(positions)
          .values({ code: VIEWER_CODE, name: VIEWER_NAME, color: "#64748b", permissions: [...VIEW_PERMISSIONS] })
          .onConflictDoNothing()
          .returning({ id: positions.id });
        positionId =
          row?.id ??
          (await tx.select({ id: positions.id }).from(positions).where(eq(positions.name, VIEWER_NAME)))[0]?.id;
        if (positionId) byCode.set(VIEWER_CODE, positionId);
      }
      if (positionId) {
        await tx.insert(userPositions).values({ userId: u.id, positionId }).onConflictDoNothing();
      }
      await tx.update(users).set({ role: "staff" }).where(eq(users.id, u.id));
    }
  });
}

/** Xodim lavozimlari ruxsatlarining birlashmasi (direktor uchun ishlatilmaydi) */
export async function staffPermissions(db: TenantDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({ permissions: positions.permissions })
    .from(userPositions)
    .innerJoin(positions, eq(positions.id, userPositions.positionId))
    .where(eq(userPositions.userId, userId));
  return [...new Set(rows.flatMap((r) => r.permissions))];
}

export async function staffPositions(db: TenantDb, userId: string) {
  return db
    .select({ id: positions.id, name: positions.name, color: positions.color })
    .from(userPositions)
    .innerJoin(positions, eq(positions.id, userPositions.positionId))
    .where(eq(userPositions.userId, userId));
}
