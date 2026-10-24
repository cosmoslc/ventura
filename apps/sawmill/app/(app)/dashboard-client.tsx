"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Layers,
  Receipt,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import {
  calculateOverallProfit,
  calculateTerakProfit,
  calculateWeeklyChart,
  type DispatchDayData,
  type TerakProfitResult,
} from "@/lib/calc/profit";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { toggleOrderCompletionAction } from "./orders/actions";

export interface TerakDashboardData {
  id: string;
  name: string;
  purchasePrice: number;
  additionalCosts: number;
  workCosts: number;
  dispatchRevenue: number;
  stockValue: number;
  stock: Array<{
    materialId: string;
    name: string;
    unit: string;
    quantity: number;
    goal: number | null;
    progress: number;
    stockValue: number;
  }>;
}

export interface AttentionOrderData {
  id: string;
  customerName: string;
  materialName: string;
  quantity: number;
  materialUnit: string;
  stockQuantity: number;
  status: "ready" | "pending" | "completed";
  isDueSoon: boolean;
  dueDate: string | null;
}

interface DashboardClientProps {
  teraks: TerakDashboardData[];
  generalExpensesTotal: number;
  profitMethod: "estimated" | "real";
  dispatchesLast7Days: DispatchDayData[];
  attentionOrders: AttentionOrderData[];
  canManage: boolean;
  locale: Locale;
}

export function DashboardClient({
  teraks,
  generalExpensesTotal,
  profitMethod,
  dispatchesLast7Days,
  attentionOrders,
  canManage,
  locale,
}: DashboardClientProps) {
  const [selectedTerakId, setSelectedTerakId] = React.useState<string>("all");
  const [method, setMethod] = React.useState<"estimated" | "real">(profitMethod);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Teraklar foydasi xaritasi
  const terakProfitsMap = React.useMemo(() => {
    const map = new Map<string, TerakProfitResult>();
    for (const tr of teraks) {
      const res = calculateTerakProfit({
        purchasePrice: tr.purchasePrice,
        additionalCosts: tr.additionalCosts,
        workCosts: tr.workCosts,
        dispatchRevenue: tr.dispatchRevenue,
        stockValue: tr.stockValue,
      });
      map.set(tr.id, res);
    }
    return map;
  }, [teraks]);

  // Umumiy foyda (K14: umumiy xarajatlar ayirilgan holda)
  const overallProfitResult = React.useMemo(() => {
    return calculateOverallProfit({
      terakProfits: Array.from(terakProfitsMap.values()),
      generalExpenses: generalExpensesTotal,
      profitMethod: method,
    });
  }, [terakProfitsMap, generalExpensesTotal, method]);

  // Tanlangan terak bo'yicha ko'rsatkichlar
  const currentMetrics = React.useMemo(() => {
    if (selectedTerakId === "all") {
      return {
        isAll: true,
        title: t("dashboard_all_teraks", locale),
        netProfitEstimated: overallProfitResult.profitEstimated,
        netProfitReal: overallProfitResult.profitReal,
        effectiveProfit: overallProfitResult.effectiveProfit,
        revenue: overallProfitResult.dispatchRevenueTotal,
        totalCosts: overallProfitResult.allCostsTotal,
        stockValue: overallProfitResult.stockValueTotal,
        generalExpenses: overallProfitResult.generalExpensesTotal,
      };
    }

    const tr = teraks.find((t) => t.id === selectedTerakId);
    const p = tr ? terakProfitsMap.get(tr.id) : null;

    return {
      isAll: false,
      title: tr?.name ?? "Terak",
      netProfitEstimated: p?.profitEstimated ?? 0,
      netProfitReal: p?.profitReal ?? 0,
      effectiveProfit: method === "estimated" ? (p?.profitEstimated ?? 0) : (p?.profitReal ?? 0),
      revenue: p?.dispatchRevenue ?? 0,
      totalCosts: p?.totalCosts ?? 0,
      stockValue: p?.stockValue ?? 0,
      generalExpenses: 0,
    };
  }, [selectedTerakId, teraks, terakProfitsMap, overallProfitResult, method, locale]);

  // Haftalik grafik (K11)
  const weeklyBars = React.useMemo(() => {
    return calculateWeeklyChart(dispatchesLast7Days);
  }, [dispatchesLast7Days]);

  const maxBarQty = React.useMemo(() => {
    const max = Math.max(...weeklyBars.map((b) => b.quantityPiece), 0);
    return max > 0 ? max : 1;
  }, [weeklyBars]);

  // Tanlangan terakdagi ombor materiallari
  const currentStockMaterials = React.useMemo(() => {
    if (selectedTerakId !== "all") {
      const tr = teraks.find((t) => t.id === selectedTerakId);
      return tr?.stock ?? [];
    }
    // "Barcha teraklar" bo'lsa materiallarni yig'ish
    const map = new Map<string, { materialId: string; name: string; unit: string; quantity: number; stockValue: number }>();
    for (const tr of teraks) {
      for (const s of tr.stock) {
        const existing = map.get(s.materialId);
        if (existing) {
          existing.quantity += s.quantity;
          existing.stockValue += s.stockValue;
        } else {
          map.set(s.materialId, {
            materialId: s.materialId,
            name: s.name,
            unit: s.unit,
            quantity: s.quantity,
            stockValue: s.stockValue,
          });
        }
      }
    }
    return Array.from(map.values()).map((item) => ({
      ...item,
      goal: null,
      progress: 0,
    }));
  }, [selectedTerakId, teraks]);

  async function handleToggleOrder(orderId: string) {
    if (!canManage) return;
    setTogglingId(orderId);
    await toggleOrderCompletionAction(orderId);
    setTogglingId(null);
  }

  const isProfitPositive = currentMetrics.effectiveProfit >= 0;

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          {t("nav_home", locale)}
        </h1>
        <p className="text-caption text-muted-foreground mt-0.5">
          Yog'och partiyalari, ombor qoldiqlari va sof foyda tahlili
        </p>
      </div>

      {/* 1. Yuqori qism: Terak tanlash va foyda usuli toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-control border border-border shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="dashboard-terak" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            {t("dashboard_terak_select", locale)}:
          </label>
          <select
            id="dashboard-terak"
            value={selectedTerakId}
            onChange={(e) => setSelectedTerakId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none font-semibold text-foreground"
          >
            <option value="all">{t("dashboard_all_teraks", locale)}</option>
            {teraks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
        </div>

        {/* Foyda hisoblash usuli: Taxminiy / Haqiqiy */}
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground font-semibold">Usul:</span>
          <div className="flex rounded-control border border-border p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => setMethod("estimated")}
              className={`px-2.5 py-1 text-2xs font-semibold rounded-control transition-all cursor-pointer ${
                method === "estimated"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Taxminiy
            </button>
            <button
              type="button"
              onClick={() => setMethod("real")}
              className={`px-2.5 py-1 text-2xs font-semibold rounded-control transition-all cursor-pointer ${
                method === "real"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Haqiqiy
            </button>
          </div>
        </div>
      </div>

      {/* 2. Asosiy 4 ta ko'rsatkich (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Sof foyda */}
        <Card className="p-5 flex flex-col justify-between border-primary/20 bg-primary/5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboard_net_profit", locale)}
              </span>
              {isProfitPositive ? (
                <div className="size-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="size-4" />
                </div>
              ) : (
                <div className="size-7 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <TrendingDown className="size-4" />
                </div>
              )}
            </div>

            <div
              className={`text-2xl font-extrabold font-mono ${
                isProfitPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatMoney(currentMetrics.effectiveProfit)}
            </div>

            <div className="text-2xs text-muted-foreground">
              {method === "estimated"
                ? t("dashboard_profit_estimated_hint", locale)
                : t("dashboard_profit_real_hint", locale)}
            </div>
          </div>

          {currentMetrics.isAll && currentMetrics.generalExpenses > 0 && (
            <div className="text-2xs text-muted-foreground border-t border-border/40 pt-2 mt-2">
              K14: -{formatMoney(currentMetrics.generalExpenses)} umumiy xarajat
            </div>
          )}
        </Card>

        {/* KPI 2: Sotuv daromadi */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboard_revenue", locale)}
              </span>
              <div className="size-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Truck className="size-4" />
              </div>
            </div>

            <div className="text-2xl font-bold font-mono text-foreground">
              {formatMoney(currentMetrics.revenue)}
            </div>

            <div className="text-2xs text-muted-foreground">
              Barcha yuk chiqarish tushumi
            </div>
          </div>
        </Card>

        {/* KPI 3: Jami xarajatlar */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboard_total_costs", locale)}
              </span>
              <div className="size-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Receipt className="size-4" />
              </div>
            </div>

            <div className="text-2xl font-bold font-mono text-foreground">
              {formatMoney(currentMetrics.totalCosts)}
            </div>

            <div className="text-2xs text-muted-foreground">
              Xarid + Qo'shimcha + Ish haqi
            </div>
          </div>
        </Card>

        {/* KPI 4: Ombor qiymati */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboard_stock_value", locale)}
              </span>
              <div className="size-7 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Layers className="size-4" />
              </div>
            </div>

            <div className="text-2xl font-bold font-mono text-foreground">
              {formatMoney(currentMetrics.stockValue)}
            </div>

            <div className="text-2xs text-muted-foreground">
              Ombordagi qoldiq sotilsa
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Haftalik sotuv grafigi (K11) va Diqqat talab zakazlar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Haftalik grafik (2 ustun) */}
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {t("dashboard_weekly_sales", locale)}
              </h3>
              <p className="text-2xs text-muted-foreground">
                {t("dashboard_weekly_sales_desc", locale)}
              </p>
            </div>
            <Link
              href="/dispatch"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>{t("nav_dispatch", locale)}</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Vizual grafik (Bar chart) */}
          <div className="pt-4">
            <div className="h-44 flex items-end justify-between gap-2 border-b border-border pb-2">
              {weeklyBars.map((bar) => {
                const heightPercent = Math.max(
                  8,
                  Math.round((bar.quantityPiece / maxBarQty) * 100),
                );
                return (
                  <div
                    key={bar.date}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 bg-foreground text-background text-2xs px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap font-mono">
                      <div>{bar.quantityPiece} dona</div>
                      <div>{formatMoney(bar.totalAmount)}</div>
                    </div>

                    <div className="w-full max-w-[40px] flex flex-col items-center">
                      <span className="text-2xs font-mono font-bold text-muted-foreground mb-1 group-hover:text-primary transition-colors">
                        {bar.quantityPiece > 0 ? `${bar.quantityPiece}` : ""}
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all ${
                          bar.isToday
                            ? "bg-primary shadow-xs"
                            : "bg-muted-foreground/25 hover:bg-muted-foreground/40"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Kunlar satri */}
            <div className="flex justify-between gap-2 pt-2 text-2xs font-semibold text-muted-foreground">
              {weeklyBars.map((bar) => (
                <div
                  key={bar.date}
                  className={`flex-1 text-center truncate ${
                    bar.isToday ? "text-primary font-bold" : ""
                  }`}
                >
                  {locale === "ru" ? bar.dayLabelRu : bar.dayLabelUz}
                  {bar.isToday && (
                    <span className="block text-3xs font-normal">
                      ({t("dashboard_today", locale)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Diqqat talab zakazlar (1 ustun) */}
        <Card className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              <AlertTriangle className="size-4" />
              <span>{t("orders_attention_needed", locale)}</span>
            </div>
            <Link
              href="/orders"
              className="text-2xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Barchasi</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-56">
            {attentionOrders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
                <CheckCircle2 className="size-6 mx-auto opacity-30 text-emerald-500" />
                <p>Hozircha diqqat talab zakazlar yo'q</p>
              </div>
            ) : (
              attentionOrders.slice(0, 4).map((ao) => (
                <div
                  key={ao.id}
                  className="p-2.5 bg-muted/30 border border-border rounded-control flex items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {ao.customerName}
                    </div>
                    <div className="text-2xs text-muted-foreground truncate">
                      {ao.materialName} • {ao.quantity} {ao.materialUnit}
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {ao.status === "ready" && (
                        <Badge tone="success" className="text-3xs py-0">
                          Tayyor
                        </Badge>
                      )}
                      {ao.isDueSoon && (
                        <Badge tone="warning" className="text-3xs py-0">
                          Muddat yaqin
                        </Badge>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={togglingId === ao.id}
                      onClick={() => handleToggleOrder(ao.id)}
                      className="size-7 p-0 shrink-0 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                    >
                      <CheckCircle2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-2xs text-muted-foreground">
            <span>Jami: {attentionOrders.length} ta zakaz</span>
            <Link href="/orders?action=new" className="text-primary font-semibold hover:underline">
              + Yangi zakaz
            </Link>
          </div>
        </Card>
      </div>

      {/* 4. Ombor qoldig'i kartalari */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">
            Ombordagi materiallar qoldig'i
          </h3>
          <Link
            href="/materials"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Katalog</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {currentStockMaterials.map((mat) => (
            <Card key={mat.materialId} className="p-3.5 space-y-2">
              <span className="text-xs font-semibold text-foreground truncate block">
                {mat.name}
              </span>
              <div>
                <div className="text-base font-bold font-mono text-primary">
                  {mat.quantity} <span className="text-2xs font-normal text-muted-foreground">{mat.unit}</span>
                </div>
                <div className="text-2xs font-mono text-muted-foreground">
                  {formatMoney(mat.stockValue)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
