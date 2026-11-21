import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  dispatches,
  generalExpenses,
  materials,
  orders,
  terakCosts,
  terakMaterials,
  teraks,
  workEntries,
} from "@ventura/db/schema/sawmill";
import { can } from "@/lib/auth/roles";
import { getOrderStatus, isOrderDueSoon } from "@/lib/calc/orders";
import { pieceVolumeM3 } from "@/lib/calc/units";
import { getSettings } from "@/lib/settings/schema";
import { currentDeps, requireUser } from "@/lib/server/session";
import { type AttentionOrderData, DashboardClient, type TerakDashboardData } from "./dashboard-client";

export default async function DashboardPage() {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return null;

  const locale = user.locale ?? "uz";
  const canManage = can(user.role, "teraks.manage");

  // 1. Sozlamalar (foyda hisoblash usuli: taxminiy / haqiqiy)
  const settings = await getSettings(deps.db);

  // 2. Faol teraklar
  const activeTeraks = await deps.db
    .select({
      id: teraks.id,
      name: teraks.name,
      purchasePrice: teraks.purchasePrice,
    })
    .from(teraks)
    .where(isNull(teraks.deletedAt))
    .orderBy(desc(teraks.purchaseDate));

  // 3. Har bir terak bo'yicha ma'lumotlar
  const teraksData: TerakDashboardData[] = await Promise.all(
    activeTeraks.map(async (tr) => {
      // 3.1. Qo'shimcha xarajatlar
      const [costsRow] = await deps.db
        .select({ total: sql<number>`coalesce(sum(${terakCosts.amount}), 0)` })
        .from(terakCosts)
        .where(eq(terakCosts.terakId, tr.id));
      const additionalCosts = Number(costsRow?.total ?? 0);

      // 3.2. Ish haqi xarajatlari
      const [workRow] = await deps.db
        .select({ total: sql<number>`coalesce(sum(${workEntries.amount}), 0)` })
        .from(workEntries)
        .where(eq(workEntries.terakId, tr.id));
      const workCosts = Number(workRow?.total ?? 0);

      // 3.3. Yuk chiqarish tushumi
      const [dispRow] = await deps.db
        .select({ total: sql<number>`coalesce(sum(${dispatches.totalAmount}), 0)` })
        .from(dispatches)
        .where(eq(dispatches.terakId, tr.id));
      const dispatchRevenue = Number(dispRow?.total ?? 0);

      // 3.4. Ombor materiallari va ombor qiymati
      const stockRows = await deps.db
        .select({
          materialId: materials.id,
          name: materials.name,
          unit: materials.unit,
          thicknessCm: materials.thicknessCm,
          widthCm: materials.widthCm,
          lengthCm: materials.lengthCm,
          quantity: terakMaterials.quantity,
          sellingPrice: terakMaterials.sellingPrice,
          cubePrice: terakMaterials.cubePrice,
          goal: terakMaterials.goal,
        })
        .from(terakMaterials)
        .innerJoin(materials, eq(materials.id, terakMaterials.materialId))
        .where(eq(terakMaterials.terakId, tr.id));

      let totalStockValue = 0;
      const stockList = stockRows.map((s) => {
        const qty = Number(s.quantity ?? 0);
        const goalNum = s.goal ? Number(s.goal) : null;
        const progress = goalNum && goalNum > 0 ? Math.min(1, qty / goalNum) : 0;

        const vol = pieceVolumeM3({
          thicknessCm: s.thicknessCm ? Number(s.thicknessCm) : null,
          widthCm: s.widthCm ? Number(s.widthCm) : null,
          lengthCm: s.lengthCm ? Number(s.lengthCm) : null,
        });

        let sVal = 0;
        if (s.sellingPrice > 0) {
          sVal = qty * s.sellingPrice;
        } else if (s.cubePrice > 0 && vol) {
          sVal = qty * vol * s.cubePrice;
        }
        totalStockValue += sVal;

        return {
          materialId: s.materialId,
          name: s.name,
          unit: s.unit,
          quantity: qty,
          goal: goalNum,
          progress,
          stockValue: Math.round(sVal),
        };
      });

      return {
        id: tr.id,
        name: tr.name,
        purchasePrice: Number(tr.purchasePrice),
        additionalCosts,
        workCosts,
        dispatchRevenue,
        stockValue: Math.round(totalStockValue),
        stock: stockList,
      };
    }),
  );

  // 4. Umumiy xarajatlar (K14: general_expenses)
  const [genExpRow] = await deps.db
    .select({ total: sql<number>`coalesce(sum(${generalExpenses.amount}), 0)` })
    .from(generalExpenses);
  const generalExpensesTotal = Number(genExpRow?.total ?? 0);

  // 5. Oxirgi 7 kunlik yuk chiqarishlar (K11: haftalik grafik)
  const today = new Date();
  const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const recentDispatches = await deps.db
    .select({
      date: dispatches.date,
      quantity: dispatches.quantity,
      totalAmount: dispatches.totalAmount,
    })
    .from(dispatches)
    .where(gte(dispatches.date, sevenDaysAgoStr));

  const dispatchesLast7Days = recentDispatches.map((d) => ({
    date: d.date,
    quantity: Number(d.quantity),
    totalAmount: Number(d.totalAmount),
  }));

  // 6. Diqqat talab zakazlar (bajarilmagan va (tayyor yoki muddati <= 2 kun))
  const uncompletedOrders = await deps.db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      materialId: orders.materialId,
      materialName: materials.name,
      materialUnit: materials.unit,
      quantity: orders.quantity,
      dueDate: orders.dueDate,
      completedAt: orders.completedAt,
      stockQuantity: terakMaterials.quantity,
    })
    .from(orders)
    .innerJoin(materials, eq(materials.id, orders.materialId))
    .leftJoin(
      terakMaterials,
      and(eq(terakMaterials.terakId, orders.terakId), eq(terakMaterials.materialId, orders.materialId)),
    )
    .where(isNull(orders.completedAt))
    .orderBy(desc(orders.createdAt));

  const attentionOrders: AttentionOrderData[] = [];
  for (const o of uncompletedOrders) {
    const qty = Number(o.quantity);
    const stockQty = Number(o.stockQuantity ?? 0);
    const status = getOrderStatus({ quantity: qty, completedAt: o.completedAt }, stockQty);
    const dueSoon = isOrderDueSoon(o.dueDate, today);

    if (status === "ready" || dueSoon) {
      attentionOrders.push({
        id: o.id,
        customerName: o.customerName,
        materialName: o.materialName,
        quantity: qty,
        materialUnit: o.materialUnit,
        stockQuantity: stockQty,
        status,
        isDueSoon: dueSoon,
        dueDate: o.dueDate,
      });
    }
  }

  return (
    <DashboardClient
      teraks={teraksData}
      generalExpensesTotal={generalExpensesTotal}
      profitMethod={settings.profitMode === "actual" ? "real" : "estimated"}
      dispatchesLast7Days={dispatchesLast7Days}
      attentionOrders={attentionOrders}
      canManage={canManage}
      locale={locale}
    />
  );
}
