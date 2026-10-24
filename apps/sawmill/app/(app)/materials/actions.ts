"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { materialSizes, materials } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { pieceVolumeM3, toCm, type DimensionUnit } from "@/lib/calc/units";
import { currentDeps, requireUser } from "@/lib/server/session";

const materialSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nomi kiritilishi shart").max(100),
  unit: z.string().trim().min(1).default("dona"),
  pricingMode: z.enum(["piece", "row"]).default("piece"),
  dimensionUnit: z.enum(["mm", "sm", "m"]).default("sm"),
  thickness: z.coerce.number().min(0).nullable().optional(),
  width: z.coerce.number().min(0).nullable().optional(),
  length: z.coerce.number().min(0).nullable().optional(),
});

const sizeVariantSchema = z.object({
  materialId: z.string().uuid(),
  dimensionUnit: z.enum(["mm", "sm", "m"]).default("sm"),
  thickness: z.coerce.number().positive("Qalinlik musbat son bo'lishi kerak"),
  width: z.coerce.number().positive("Eni musbat son bo'lishi kerak"),
  length: z.coerce.number().positive("Uzunlik musbat son bo'lishi kerak"),
});

export type MaterialActionResult = {
  ok: boolean;
  error?: string;
};

export async function createMaterialAction(formData: FormData): Promise<MaterialActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "stock.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = materialSchema.safeParse({
    name: formData.get("name"),
    unit: formData.get("unit") || "dona",
    pricingMode: formData.get("pricingMode") || "piece",
    dimensionUnit: formData.get("dimensionUnit") || "sm",
    thickness: formData.get("thickness") ? Number(formData.get("thickness")) : null,
    width: formData.get("width") ? Number(formData.get("width")) : null,
    length: formData.get("length") ? Number(formData.get("length")) : null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  const { name, unit, pricingMode, dimensionUnit, thickness, width, length } = parsed.data;

  const thicknessCm = thickness ? toCm(thickness, dimensionUnit) : null;
  const widthCm = width ? toCm(width, dimensionUnit) : null;
  const lengthCm = length ? toCm(length, dimensionUnit) : null;

  try {
    const [inserted] = await deps.db
      .insert(materials)
      .values({
        name,
        unit,
        pricingMode,
        thicknessCm: thicknessCm !== null ? String(thicknessCm) : null,
        widthCm: widthCm !== null ? String(widthCm) : null,
        lengthCm: lengthCm !== null ? String(lengthCm) : null,
      })
      .returning();

    if (inserted) {
      await tenantAudit.record(deps.db, {
        actor: { type: "user", id: user.id, name: user.name },
        action: "material.created",
        target: { type: "materials", id: inserted.id },
        metadata: { name, pricingMode, thicknessCm, widthCm, lengthCm },
      });
    }

    revalidatePath("/materials");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateMaterialAction(formData: FormData): Promise<MaterialActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "stock.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = materialSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    unit: formData.get("unit") || "dona",
    pricingMode: formData.get("pricingMode") || "piece",
    dimensionUnit: formData.get("dimensionUnit") || "sm",
    thickness: formData.get("thickness") ? Number(formData.get("thickness")) : null,
    width: formData.get("width") ? Number(formData.get("width")) : null,
    length: formData.get("length") ? Number(formData.get("length")) : null,
  });

  if (!parsed.success || !parsed.data.id) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Identifikator noto'g'ri" };
  }

  const { id, name, unit, pricingMode, dimensionUnit, thickness, width, length } = parsed.data;

  const thicknessCm = thickness ? toCm(thickness, dimensionUnit) : null;
  const widthCm = width ? toCm(width, dimensionUnit) : null;
  const lengthCm = length ? toCm(length, dimensionUnit) : null;

  try {
    const [updated] = await deps.db
      .update(materials)
      .set({
        name,
        unit,
        pricingMode,
        thicknessCm: thicknessCm !== null ? String(thicknessCm) : null,
        widthCm: widthCm !== null ? String(widthCm) : null,
        lengthCm: lengthCm !== null ? String(lengthCm) : null,
        updatedAt: new Date(),
      })
      .where(eq(materials.id, id))
      .returning();

    if (!updated) return { ok: false, error: "Material topilmadi" };

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "material.updated",
      target: { type: "materials", id: updated.id },
      metadata: { name, pricingMode, thicknessCm, widthCm, lengthCm },
    });

    revalidatePath("/materials");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleArchiveMaterialAction(materialId: string): Promise<MaterialActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "stock.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    const [existing] = await deps.db
      .select({ id: materials.id, archivedAt: materials.archivedAt })
      .from(materials)
      .where(eq(materials.id, materialId))
      .limit(1);

    if (!existing) return { ok: false, error: "Material topilmadi" };

    const isArchived = !!existing.archivedAt;
    const newArchivedAt = isArchived ? null : new Date();

    await deps.db
      .update(materials)
      .set({
        archivedAt: newArchivedAt,
        updatedAt: new Date(),
      })
      .where(eq(materials.id, materialId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: isArchived ? "material.restored" : "material.archived",
      target: { type: "materials", id: materialId },
    });

    revalidatePath("/materials");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function addMaterialSizeAction(formData: FormData): Promise<MaterialActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "stock.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = sizeVariantSchema.safeParse({
    materialId: formData.get("materialId"),
    dimensionUnit: formData.get("dimensionUnit") || "sm",
    thickness: formData.get("thickness"),
    width: formData.get("width"),
    length: formData.get("length"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "O'lcham noto'g'ri" };
  }

  const { materialId, dimensionUnit, thickness, width, length } = parsed.data;
  const thicknessCm = toCm(thickness, dimensionUnit as DimensionUnit);
  const widthCm = toCm(width, dimensionUnit as DimensionUnit);
  const lengthCm = toCm(length, dimensionUnit as DimensionUnit);

  try {
    const [inserted] = await deps.db
      .insert(materialSizes)
      .values({
        materialId,
        thicknessCm: String(thicknessCm),
        widthCm: String(widthCm),
        lengthCm: String(lengthCm),
      })
      .returning();

    if (inserted) {
      await tenantAudit.record(deps.db, {
        actor: { type: "user", id: user.id, name: user.name },
        action: "material_size.created",
        target: { type: "material_sizes", id: inserted.id },
        metadata: { materialId, thicknessCm, widthCm, lengthCm },
      });
    }

    revalidatePath("/materials");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteMaterialSizeAction(sizeId: string): Promise<MaterialActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "stock.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    await deps.db.delete(materialSizes).where(eq(materialSizes.id, sizeId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "material_size.deleted",
      target: { type: "material_sizes", id: sizeId },
    });

    revalidatePath("/materials");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getMaterialsCatalog(db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"]) {
  const allMaterials = await db.select().from(materials).orderBy(materials.name);
  const allSizes = await db.select().from(materialSizes);

  const sizesByMaterial = new Map<string, typeof allSizes>();
  for (const size of allSizes) {
    const list = sizesByMaterial.get(size.materialId) ?? [];
    list.push(size);
    sizesByMaterial.set(size.materialId, list);
  }

  const active = allMaterials.filter((m) => !m.archivedAt).map((m) => ({
    ...m,
    sizes: sizesByMaterial.get(m.id) ?? [],
    volumeM3: pieceVolumeM3({
      thicknessCm: m.thicknessCm ? Number(m.thicknessCm) : null,
      widthCm: m.widthCm ? Number(m.widthCm) : null,
      lengthCm: m.lengthCm ? Number(m.lengthCm) : null,
    }),
  }));

  const archived = allMaterials.filter((m) => !!m.archivedAt).map((m) => ({
    ...m,
    sizes: sizesByMaterial.get(m.id) ?? [],
    volumeM3: pieceVolumeM3({
      thicknessCm: m.thicknessCm ? Number(m.thicknessCm) : null,
      widthCm: m.widthCm ? Number(m.widthCm) : null,
      lengthCm: m.lengthCm ? Number(m.lengthCm) : null,
    }),
  }));

  return { active, archived };
}
