"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  Edit2,
  Layers,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { deleteTerakCostAction } from "../actions";
import { CostDialog } from "./cost-dialog";
import { PriceDialog, type StockMaterialItem } from "./price-dialog";

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

interface TerakDetailClientProps {
  terak: TerakData;
  stock: StockItem[];
  costs: CostItem[];
  totalCostsAmount: number;
  totalRes: number;
  sartirofkaSoni: number;
  remainingRes: number;
  canManage: boolean;
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
  canManage,
  locale,
}: TerakDetailClientProps) {
  const [activeTab, setActiveTab] = React.useState<"stock" | "costs" | "work" | "dispatch" | "orders">("stock");

  // Price Dialog
  const [priceDialogOpen, setPriceDialogOpen] = React.useState(false);
  const [selectedStockItem, setSelectedStockItem] = React.useState<StockMaterialItem | null>(null);

  // Cost Dialog
  const [costDialogOpen, setCostDialogOpen] = React.useState(false);

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
          <span>{t("teraks_work_tab", locale)}</span>
          <span className="text-2xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-mono">S3</span>
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
          <span>{t("teraks_dispatch_tab", locale)}</span>
          <span className="text-2xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-mono">S4</span>
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
          <span>{t("teraks_orders_tab", locale)}</span>
          <span className="text-2xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-mono">S4</span>
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

      {/* Tab 3, 4, 5: Placeholders */}
      {activeTab === "work" && (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="text-body font-semibold">Ushbu terakka tegishli ishlar ro'yxati</p>
          <span className="text-2xs bg-muted px-2 py-1 rounded-control font-mono mt-2 inline-block">
            S3 bosqichida to'liq ishga tushadi
          </span>
        </Card>
      )}

      {activeTab === "dispatch" && (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="text-body font-semibold">Yuk chiqarish (sotuv) tarixi</p>
          <span className="text-2xs bg-muted px-2 py-1 rounded-control font-mono mt-2 inline-block">
            S4 bosqichida to'liq ishga tushadi
          </span>
        </Card>
      )}

      {activeTab === "orders" && (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="text-body font-semibold">Ushbu terakka biriktirilgan zakazlar</p>
          <span className="text-2xs bg-muted px-2 py-1 rounded-control font-mono mt-2 inline-block">
            S4 bosqichida to'liq ishga tushadi
          </span>
        </Card>
      )}

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
