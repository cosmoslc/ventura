"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Edit2,
  Layers,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { deleteDispatchAction } from "@/app/(app)/dispatch/actions";
import { DispatchDialog } from "@/app/(app)/dispatch/dispatch-dialog";
import {
  deleteOrderAction,
  toggleOrderCompletionAction,
} from "@/app/(app)/orders/actions";
import { OrderDialog } from "@/app/(app)/orders/order-dialog";
import { type OrderStatus } from "@/lib/calc/orders";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { deleteTerakCostAction } from "../actions";
import { CostDialog } from "./cost-dialog";
import { PriceDialog, type StockMaterialItem } from "./price-dialog";

export interface TerakDispatchItem {
  id: string;
  date: string;
  materialId: string;
  materialName: string;
  materialUnit: string;
  quantity: number;
  enteredUnit: string;
  enteredQty: number;
  totalAmount: number;
  recipientName: string | null;
  phone: string | null;
  address: string | null;
  truckId: string | null;
  truckName: string | null;
  volumeM3: number | null;
  volumeTotalM3: number | null;
}

export interface TerakOrderItem {
  id: string;
  materialId: string;
  materialName: string;
  materialUnit: string;
  quantity: number;
  stockQuantity: number;
  customerName: string;
  phone: string | null;
  address: string | null;
  dueDate: string | null;
  completedAt: Date | null;
  status: OrderStatus;
  isDueSoon: boolean;
}

interface TerakData {
  id: string;
  name: string;
  purchaseDate: string;
  purchasePrice: number;
  note: string | null;
}

interface StockItem {
  tmId: string;
  materialId: string;
  name: string;
  unit: string;
  pricingMode: "piece" | "row";
  thicknessCm: string | null;
  widthCm: string | null;
  lengthCm: string | null;
  quantity: string | null;
  workerPrice: number;
  sellingPrice: number;
  cubeWorkerPrice: number;
  cubePrice: number;
  goal: string | null;
  volumeM3: number | null;
  progress: number;
  stockValue: number;
}

interface CostItem {
  id: string;
  kind: "transport" | "res" | "truck" | "other";
  title: string | null;
  amount: number;
  date: string;
  trips: number | null;
  pricePerTrip: number | null;
}

interface TerakWorkItem {
  id: string;
  date: string;
  workerId: string;
  workerName: string;
  workTypeId: string | null;
  workTypeName: string | null;
  kind: "regular" | "material";
  groupId: string | null;
  amount: number;
  materialId: string | null;
  materialName: string | null;
  quantity: string | null;
  rows: string | null;
  payUnit: "piece" | "row" | "cube" | null;
  note: string | null;
}

interface TerakDetailClientProps {
  terak: TerakData;
  stock: StockItem[];
  costs: CostItem[];
  totalCostsAmount: number;
  totalRes: number;
  sartirofkaSoni: number;
  remainingRes: number;
  works?: TerakWorkItem[];
  totalWorkAmount?: number;
  dispatches?: TerakDispatchItem[];
  totalDispatchedAmount?: number;
  orders?: TerakOrderItem[];
  trucks?: Array<{ id: string; name: string; amount: number }>;
  canManage: boolean;
  canManageDispatch?: boolean;
  canDeleteDispatch?: boolean;
  canManageOrders?: boolean;
  locale: Locale;
}

export function TerakDetailClient({
  terak,
  stock,
  costs,
  totalCostsAmount,
  totalRes,
  sartirofkaSoni: _sartirofkaSoni,
  remainingRes,
  works = [],
  totalWorkAmount = 0,
  dispatches = [],
  totalDispatchedAmount = 0,
  orders = [],
  trucks = [],
  canManage,
  canManageDispatch = false,
  canDeleteDispatch = false,
  canManageOrders = false,
  locale,
}: TerakDetailClientProps) {
  const [activeTab, setActiveTab] = React.useState<"stock" | "costs" | "work" | "dispatch" | "orders">("stock");

  // Price Dialog
  const [priceDialogOpen, setPriceDialogOpen] = React.useState(false);
  const [selectedStockItem, setSelectedStockItem] = React.useState<StockMaterialItem | null>(null);

  // Cost Dialog
  const [costDialogOpen, setCostDialogOpen] = React.useState(false);

  // Dispatch Dialog & Delete
  const [dispatchDialogOpen, setDispatchDialogOpen] = React.useState(false);
  const [deleteDispatchId, setDeleteDispatchId] = React.useState<string | null>(null);

  // Order Dialog & Delete & Toggle
  const [orderDialogOpen, setOrderDialogOpen] = React.useState(false);
  const [deleteOrderId, setDeleteOrderId] = React.useState<string | null>(null);

  // Delete cost modal
  const [deleteCostId, setDeleteCostId] = React.useState<string | null>(null);

  // Jami ombor qiymati
  const totalStockValue = stock.reduce((acc, s) => acc + s.stockValue, 0);

  function handleOpenPriceDialog(s: StockItem) {
    setSelectedStockItem({
      materialId: s.materialId,
      name: s.name,
      unit: s.unit,
      pricingMode: s.pricingMode,
      workerPrice: s.workerPrice,
      sellingPrice: s.sellingPrice,
      cubeWorkerPrice: s.cubeWorkerPrice,
      cubePrice: s.cubePrice,
      goal: s.goal,
      volumeM3: s.volumeM3,
    });
    setPriceDialogOpen(true);
  }

  async function handleConfirmDeleteCost() {
    if (!deleteCostId) return;
    await deleteTerakCostAction(deleteCostId, terak.id);
    setDeleteCostId(null);
  }

  const costKindLabels: Record<string, string> = {
    transport: t("cost_kind_transport", locale),
    res: t("cost_kind_res", locale),
    truck: t("cost_kind_truck", locale),
    other: t("cost_kind_other", locale),
  };

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="subtle" className="size-9 p-0 shrink-0">
            <Link href="/teraks">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {terak.name}
              </h1>
              <Badge tone="neutral" className="font-mono text-2xs">
                {terak.purchaseDate}
              </Badge>
            </div>
            {terak.note && (
              <p className="text-caption text-muted-foreground mt-0.5">{terak.note}</p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <span className="text-2xs font-bold text-muted-foreground uppercase">
            {t("teraks_purchase_price", locale)}
          </span>
          <p className="text-base sm:text-lg font-bold font-mono text-foreground mt-1">
            {formatMoney(terak.purchasePrice)}
          </p>
        </Card>

        <Card className="p-4">
          <span className="text-2xs font-bold text-muted-foreground uppercase">
            {t("terak_costs_title", locale)}
          </span>
          <p className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {formatMoney(totalCostsAmount)}
          </p>
        </Card>

        <Card className="p-4">
          <span className="text-2xs font-bold text-muted-foreground uppercase">
            {t("stock_total_value", locale)}
          </span>
          <p className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(totalStockValue)}
          </p>
        </Card>

        <Card className="p-4">
          <span className="text-2xs font-bold text-muted-foreground uppercase">
            Reslar (Qolgan / Jami)
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base sm:text-lg font-bold font-mono text-primary">
              {remainingRes}
            </span>
            <span className="text-caption text-muted-foreground font-mono">/ {totalRes} ta</span>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 px-4 py-2.5 text-body font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "stock"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="size-4" />
          <span>{t("teraks_stock_tab", locale)} ({stock.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("costs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-body font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "costs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="size-4" />
          <span>{t("teraks_costs_tab", locale)} ({costs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("work")}
          className={`flex items-center gap-2 px-4 py-2.5 text-body font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "work"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{t("teraks_work_tab", locale)} ({works.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dispatch")}
          className={`flex items-center gap-2 px-4 py-2.5 text-body font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "dispatch"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="size-4" />
          <span>{t("teraks_dispatch_tab", locale)} ({dispatches.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 px-4 py-2.5 text-body font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "orders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart className="size-4" />
          <span>{t("teraks_orders_tab", locale)} ({orders.length})</span>
        </button>
      </div>

      {/* Tab 1: Ombor (Stock) */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stock.map((s) => (
              <Card key={s.materialId} className="p-5 flex flex-col justify-between hover:border-border-soft transition-all">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-foreground">{s.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge tone={s.pricingMode === "piece" ? "info" : "warning"}>
                          {s.pricingMode === "piece" ? t("pricing_piece", locale) : t("pricing_row", locale)}
                        </Badge>
                        {s.volumeM3 !== null && (
                          <span className="text-2xs text-muted-foreground font-mono">
                            {s.volumeM3} m³
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-2xs text-muted-foreground uppercase">{t("stock_quantity", locale)}</span>
                      <p className="text-lg font-extrabold text-foreground font-mono">
                        {Number(s.quantity ?? 0).toLocaleString()} {s.unit}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar to goal */}
                  {Number(s.goal ?? 0) > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-2xs text-muted-foreground font-mono">
                        <span>{t("stock_progress", locale)}:</span>
                        <span>{Math.round(s.progress * 100)}% ({Number(s.quantity ?? 0)} / {Number(s.goal)})</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${s.progress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Prices & Value */}
                  <div className="p-3 rounded-card bg-muted/40 space-y-1 text-caption font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">{t("stock_worker_price", locale)}:</span>
                      <span className="text-foreground">{formatMoney(s.workerPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">{t("stock_selling_price", locale)}:</span>
                      <span className="text-foreground">{formatMoney(s.sellingPrice)}</span>
                    </div>
                    {s.volumeM3 !== null && s.cubePrice > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-sans">{t("stock_cube_price", locale)}:</span>
                        <span className="text-foreground">{formatMoney(s.cubePrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-border font-bold text-foreground">
                      <span className="font-sans">{t("stock_total_value", locale)}:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(s.stockValue)}</span>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="pt-3 mt-3 border-t border-border flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={() => handleOpenPriceDialog(s)}
                      className="h-8 px-2.5 text-caption gap-1 text-primary hover:text-primary"
                    >
                      <Edit2 className="size-3.5" />
                      <span>{t("stock_edit_prices", locale)}</span>
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Xarajatlar (Costs) */}
      {activeTab === "costs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-body font-bold text-foreground">{t("terak_costs_title", locale)}</h2>
              <p className="text-2xs text-muted-foreground">Tashish, res va boshqa qo'shimcha xarajatlar</p>
            </div>
            {canManage && (
              <Button onClick={() => setCostDialogOpen(true)} className="gap-1.5 h-9 text-caption">
                <Plus className="size-4" />
                <span>{t("terak_costs_add", locale)}</span>
              </Button>
            )}
          </div>

          {costs.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <div className="size-12 rounded-btn bg-muted flex items-center justify-center mx-auto mb-3">
                <DollarSign className="size-6 text-muted-foreground" />
              </div>
              <p className="text-body font-medium">Bu terak uchun hali xarajatlar kiritilmagan</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body">
                  <thead className="bg-muted text-2xs font-bold text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-3">{t("cost_date", locale)}</th>
                      <th className="px-4 py-3">{t("terak_cost_kind", locale)}</th>
                      <th className="px-4 py-3">{t("cost_title", locale)}</th>
                      <th className="px-4 py-3 text-right">{t("cost_amount", locale)}</th>
                      {canManage && <th className="px-4 py-3 text-right">Amal</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-caption">
                    {costs.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{c.date}</td>
                        <td className="px-4 py-3 font-sans">
                          <Badge tone={c.kind === "res" ? "warning" : "neutral"}>
                            {costKindLabels[c.kind] ?? c.kind}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-sans font-medium text-foreground">
                          {c.title}
                          {c.kind === "res" && c.trips && (
                            <span className="text-2xs text-muted-foreground block font-mono">
                              {c.trips} reys × {formatMoney(c.pricePerTrip ?? 0)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatMoney(c.amount)}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => setDeleteCostId(c.id)}
                              className="p-1.5 rounded-btn text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                              title={t("action_delete", locale)}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 font-bold border-t border-border">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-body text-foreground">Jami xarajatlar:</td>
                      <td className="px-4 py-3 text-right font-mono text-base text-rose-600 dark:text-rose-400">
                        {formatMoney(totalCostsAmount)}
                      </td>
                      {canManage && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 3: Work */}
      {activeTab === "work" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-body font-bold text-foreground">
                Ushbu terakka tegishli ishlar
              </h2>
              <p className="text-caption text-muted-foreground">
                Jami hisoblangan ish haqi: <strong className="text-foreground font-mono">{formatMoney(totalWorkAmount)}</strong>
              </p>
            </div>

            {canManage && (
              <Link href="/work">
                <Button className="gap-2">
                  <Plus className="size-4" />
                  <span>{t("work_add_single", locale)}</span>
                </Button>
              </Link>
            )}
          </div>

          {works.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p className="text-body font-semibold">{t("work_empty", locale)}</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body">
                  <thead className="bg-muted/50 border-b border-border text-caption font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">{t("work_date", locale)}</th>
                      <th className="px-4 py-3">{t("work_worker", locale)}</th>
                      <th className="px-4 py-3">{t("work_type", locale)}</th>
                      <th className="px-4 py-3">{t("work_quantity", locale)}</th>
                      <th className="px-4 py-3 text-right">{t("work_amount", locale)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-caption">
                    {works.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">{w.date}</td>
                        <td className="px-4 py-3 text-foreground font-sans font-semibold">
                          <Link href={`/workers/${w.workerId}`} className="hover:text-primary transition-colors">
                            {w.workerName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-foreground font-sans">
                          {w.kind === "material" ? w.materialName ?? "Material" : w.workTypeName ?? "Oddiy ish"}
                          {w.note && <span className="text-2xs text-muted-foreground block">{w.note}</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {w.kind === "material" ? (
                            <>
                              {w.payUnit === "row" && w.rows && `${w.rows} qator`}
                              {w.payUnit === "piece" && w.quantity && `${w.quantity} dona`}
                              {w.payUnit === "cube" && w.quantity && `${w.quantity} dona`}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatMoney(w.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t border-border font-mono text-caption font-bold">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-foreground font-sans">
                        Jami ish haqi xarajati:
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {formatMoney(totalWorkAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 4: Yuk chiqarish (Dispatch) */}
      {activeTab === "dispatch" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-control border border-border">
            <div>
              <h3 className="font-bold text-base text-foreground">
                {t("dispatch_title", locale)}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("dispatch_total_revenue", locale)}:{" "}
                <span className="font-mono font-bold text-primary">
                  {formatMoney(totalDispatchedAmount)}
                </span>
              </p>
            </div>
            {canManageDispatch && (
              <Button
                variant="primary"
                onClick={() => setDispatchDialogOpen(true)}
                className="gap-1.5 cursor-pointer"
              >
                <Plus className="size-4" />
                <span>{t("dispatch_add", locale)}</span>
              </Button>
            )}
          </div>

          <Card className="overflow-hidden">
            {dispatches.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <Truck className="size-8 mx-auto opacity-30" />
                <p className="text-sm font-semibold">{t("dispatch_empty", locale)}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">{t("dispatch_date", locale)}</th>
                      <th className="py-2.5 px-3">{t("work_material", locale)}</th>
                      <th className="py-2.5 px-3">{t("dispatch_quantity", locale)}</th>
                      <th className="py-2.5 px-3">{t("dispatch_total", locale)}</th>
                      <th className="py-2.5 px-3">{t("dispatch_recipient", locale)}</th>
                      <th className="py-2.5 px-3">{t("dispatch_truck", locale)}</th>
                      {canDeleteDispatch && <th className="py-2.5 px-3 text-right">Amal</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dispatches.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium whitespace-nowrap">
                          {d.date}
                        </td>
                        <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {d.materialName}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                          <span className="font-bold">{d.quantity} {d.materialUnit}</span>
                          {d.volumeTotalM3 && (
                            <span className="text-2xs text-muted-foreground ml-1">
                              ({d.volumeTotalM3} m³)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-primary">
                          {formatMoney(d.totalAmount)}
                        </td>
                        <td className="py-2.5 px-3">
                          {d.recipientName ? (
                            <div>
                              <div className="font-semibold">{d.recipientName}</div>
                              {d.phone && <div className="text-2xs text-muted-foreground font-mono">{d.phone}</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-2xs">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {d.truckName ? (
                            <Badge tone="info" className="gap-1 text-2xs">
                              <Truck className="size-2.5" />
                              <span>{d.truckName}</span>
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-2xs">-</span>
                          )}
                        </td>
                        {canDeleteDispatch && (
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              onClick={() => setDeleteDispatchId(d.id)}
                              className="size-7 p-0 text-red-500 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 5: Zakazlar (Orders) */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-control border border-border">
            <div>
              <h3 className="font-bold text-base text-foreground">
                {t("orders_title", locale)}
              </h3>
              <p className="text-xs text-muted-foreground">
                Ushbu terakka biriktirilgan buyurtmalar nazorati
              </p>
            </div>
            {canManageOrders && (
              <Button
                variant="primary"
                onClick={() => setOrderDialogOpen(true)}
                className="gap-1.5 cursor-pointer"
              >
                <Plus className="size-4" />
                <span>{t("orders_add", locale)}</span>
              </Button>
            )}
          </div>

          <Card className="overflow-hidden">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <ShoppingCart className="size-8 mx-auto opacity-30" />
                <p className="text-sm font-semibold">{t("orders_empty", locale)}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3 w-10 text-center">Holat</th>
                      <th className="py-2.5 px-3">{t("orders_customer", locale)}</th>
                      <th className="py-2.5 px-3">{t("work_material", locale)}</th>
                      <th className="py-2.5 px-3">{t("orders_quantity", locale)}</th>
                      <th className="py-2.5 px-3">Omborda bor</th>
                      <th className="py-2.5 px-3">{t("orders_due_date", locale)}</th>
                      {canManageOrders && <th className="py-2.5 px-3 text-right">Amal</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((o) => {
                      const isCompleted = o.status === "completed";
                      return (
                        <tr
                          key={o.id}
                          className={`hover:bg-muted/20 transition-colors ${
                            isCompleted ? "opacity-60 bg-muted/10" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              disabled={!canManageOrders}
                              onClick={async () => {
                                await toggleOrderCompletionAction(o.id);
                              }}
                              className={`size-5 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                                isCompleted
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-border hover:border-primary text-transparent hover:text-muted-foreground"
                              }`}
                            >
                              <CheckCircle2 className="size-3.5" />
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className={`font-semibold ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                              {o.customerName}
                            </div>
                            {o.phone && <div className="text-2xs text-muted-foreground font-mono">{o.phone}</div>}
                          </td>
                          <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                            {o.materialName}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                            {o.quantity} {o.materialUnit}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span>{o.stockQuantity} {o.materialUnit}</span>
                              {!isCompleted && (
                                o.status === "ready" ? (
                                  <Badge tone="success" className="text-2xs py-0">
                                    {t("orders_status_ready", locale)}
                                  </Badge>
                                ) : (
                                  <Badge tone="neutral" className="text-2xs py-0">
                                    {t("orders_status_pending", locale)}
                                  </Badge>
                                )
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {o.dueDate ? (
                              <div className="space-y-0.5">
                                <span className="font-mono text-2xs">{o.dueDate}</span>
                                {!isCompleted && o.isDueSoon && (
                                  <div>
                                    <Badge tone="warning" className="text-2xs py-0">
                                      {t("orders_due_soon", locale)}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-2xs">-</span>
                            )}
                          </td>
                          {canManageOrders && (
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <Button
                                variant="ghost"
                                onClick={() => setDeleteOrderId(o.id)}
                                className="size-7 p-0 text-red-500 hover:bg-red-500/10 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Dispatch Dialog (Terak ichidan) */}
      <DispatchDialog
        open={dispatchDialogOpen}
        onOpenChange={setDispatchDialogOpen}
        teraks={[{ id: terak.id, name: terak.name }]}
        preselectedTerakId={terak.id}
        materials={stock.map((s) => ({
          id: s.materialId,
          name: s.name,
          unit: s.unit,
          thicknessCm: s.thicknessCm ? Number(s.thicknessCm) : null,
          widthCm: s.widthCm ? Number(s.widthCm) : null,
          lengthCm: s.lengthCm ? Number(s.lengthCm) : null,
        }))}
        terakMaterials={stock.map((s) => ({
          terakId: terak.id,
          materialId: s.materialId,
          quantity: s.quantity ?? "0",
          sellingPrice: s.sellingPrice,
          cubePrice: s.cubePrice,
        }))}
        trucks={trucks}
        locale={locale}
      />

      {/* Order Dialog (Terak ichidan) */}
      <OrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        teraks={[{ id: terak.id, name: terak.name }]}
        preselectedTerakId={terak.id}
        materials={stock.map((s) => ({
          id: s.materialId,
          name: s.name,
          unit: s.unit,
        }))}
        terakMaterials={stock.map((s) => ({
          terakId: terak.id,
          materialId: s.materialId,
          quantity: s.quantity ?? "0",
        }))}
        locale={locale}
      />

      {/* Confirm Delete Dispatch */}
      <ConfirmModal
        open={!!deleteDispatchId}
        onOpenChange={(open) => !open && setDeleteDispatchId(null)}
        title={t("action_delete", locale)}
        message={t("dispatch_delete_confirm", locale)}
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={async () => {
          if (!deleteDispatchId) return;
          await deleteDispatchAction(deleteDispatchId);
          setDeleteDispatchId(null);
        }}
      />

      {/* Confirm Delete Order */}
      <ConfirmModal
        open={!!deleteOrderId}
        onOpenChange={(open) => !open && setDeleteOrderId(null)}
        title={t("action_delete", locale)}
        message={t("orders_delete_confirm", locale)}
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={async () => {
          if (!deleteOrderId) return;
          await deleteOrderAction(deleteOrderId);
          setDeleteOrderId(null);
        }}
      />

      {/* Price Dialog */}
      <PriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        terakId={terak.id}
        item={selectedStockItem}
        locale={locale}
      />

      {/* Cost Dialog */}
      <CostDialog
        open={costDialogOpen}
        onOpenChange={setCostDialogOpen}
        terakId={terak.id}
        locale={locale}
      />

      {/* Confirm Delete Cost */}
      <ConfirmModal
        open={!!deleteCostId}
        onOpenChange={(open) => !open && setDeleteCostId(null)}
        title={t("action_delete", locale)}
        message="Haqiqatan ham ushbu xarajatni o'chirmoqchimisiz?"
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmDeleteCost}
      />
    </div>
  );
}
