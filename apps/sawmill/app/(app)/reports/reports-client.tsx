"use client";

import * as React from "react";
import { Coins, Download, Filter, RotateCcw, TrendingDown, TrendingUp, Truck, Users, Wallet } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import {
  type DispatchReportRow,
  getFilteredDispatchReportAction,
  getFilteredWagesReportAction,
  type TerakProfitReportRow,
  type WorkerWageReportRow,
} from "./actions";

interface ReportsClientProps {
  initialProfit: {
    rows: TerakProfitReportRow[];
    generalExpensesTotal: number;
  };
  initialWages: WorkerWageReportRow[];
  initialDispatches: DispatchReportRow[];
  teraksList: Array<{ id: string; name: string }>;
  locale: Locale;
}

export function ReportsClient({
  initialProfit,
  initialWages,
  initialDispatches,
  teraksList,
  locale,
}: ReportsClientProps) {
  const [activeTab, setActiveTab] = React.useState<"profit" | "wages" | "dispatch">("profit");

  // Wages state
  const [wagesDateFrom, setWagesDateFrom] = React.useState("");
  const [wagesDateTo, setWagesDateTo] = React.useState("");
  const [wagesRows, setWagesRows] = React.useState<WorkerWageReportRow[]>(initialWages);
  const [wagesLoading, setWagesLoading] = React.useState(false);

  // Dispatch state
  const [dispatchDateFrom, setDispatchDateFrom] = React.useState("");
  const [dispatchDateTo, setDispatchDateTo] = React.useState("");
  const [dispatchTerakId, setDispatchTerakId] = React.useState("");
  const [dispatchRows, setDispatchRows] = React.useState<DispatchReportRow[]>(initialDispatches);
  const [dispatchLoading, setDispatchLoading] = React.useState(false);

  // Profit totals
  const totalPurchase = initialProfit.rows.reduce((acc, r) => acc + r.purchasePrice, 0);
  const totalAdditional = initialProfit.rows.reduce((acc, r) => acc + r.additionalCosts, 0);
  const totalWork = initialProfit.rows.reduce((acc, r) => acc + r.workCosts, 0);
  const totalTerakCosts = initialProfit.rows.reduce((acc, r) => acc + r.totalCosts, 0);
  const totalOverallCosts = totalTerakCosts + initialProfit.generalExpensesTotal;
  const totalRevenue = initialProfit.rows.reduce((acc, r) => acc + r.dispatchRevenue, 0);
  const totalStock = initialProfit.rows.reduce((acc, r) => acc + r.stockValue, 0);
  const totalEstimatedProfit =
    initialProfit.rows.reduce((acc, r) => acc + r.profitEstimated, 0) - initialProfit.generalExpensesTotal;
  const totalRealProfit =
    initialProfit.rows.reduce((acc, r) => acc + r.profitReal, 0) - initialProfit.generalExpensesTotal;

  // Wages totals
  const totalWagesEarned = wagesRows.reduce((acc, r) => acc + r.totalEarned, 0);
  const totalWagesPaid = wagesRows.reduce((acc, r) => acc + r.totalPaid, 0);
  const totalWagesBalance = wagesRows.reduce((acc, r) => acc + r.currentBalance, 0);

  // Dispatch totals
  const totalDispatchAmount = dispatchRows.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalDispatchPieces = dispatchRows.reduce((acc, r) => acc + r.quantity, 0);
  const totalDispatchVolume = dispatchRows.reduce((acc, r) => acc + (r.volumeTotalM3 ?? 0), 0);

  // Wages filter handlers
  const handleFilterWages = async (e: React.FormEvent) => {
    e.preventDefault();
    setWagesLoading(true);
    try {
      const res = await getFilteredWagesReportAction({
        dateFrom: wagesDateFrom || undefined,
        dateTo: wagesDateTo || undefined,
      });
      setWagesRows(res);
    } finally {
      setWagesLoading(false);
    }
  };

  const handleResetWages = async () => {
    setWagesDateFrom("");
    setWagesDateTo("");
    setWagesLoading(true);
    try {
      const res = await getFilteredWagesReportAction({});
      setWagesRows(res);
    } finally {
      setWagesLoading(false);
    }
  };

  // Dispatch filter handlers
  const handleFilterDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchLoading(true);
    try {
      const res = await getFilteredDispatchReportAction({
        dateFrom: dispatchDateFrom || undefined,
        dateTo: dispatchDateTo || undefined,
        terakId: dispatchTerakId || undefined,
      });
      setDispatchRows(res);
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleResetDispatch = async () => {
    setDispatchDateFrom("");
    setDispatchDateTo("");
    setDispatchTerakId("");
    setDispatchLoading(true);
    try {
      const res = await getFilteredDispatchReportAction({});
      setDispatchRows(res);
    } finally {
      setDispatchLoading(false);
    }
  };

  // Compute active excel URL
  const excelHref = React.useMemo(() => {
    if (activeTab === "profit") {
      return "/api/reports/excel?type=profit";
    }
    if (activeTab === "wages") {
      const params = new URLSearchParams({ type: "wages" });
      if (wagesDateFrom) params.set("dateFrom", wagesDateFrom);
      if (wagesDateTo) params.set("dateTo", wagesDateTo);
      return `/api/reports/excel?${params.toString()}`;
    }
    const params = new URLSearchParams({ type: "dispatch" });
    if (dispatchDateFrom) params.set("dateFrom", dispatchDateFrom);
    if (dispatchDateTo) params.set("dateTo", dispatchDateTo);
    if (dispatchTerakId) params.set("terakId", dispatchTerakId);
    return `/api/reports/excel?${params.toString()}`;
  }, [activeTab, wagesDateFrom, wagesDateTo, dispatchDateFrom, dispatchDateTo, dispatchTerakId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("reports_title", locale)}</h1>
          <p className="text-body text-muted-foreground">{t("reports_subtitle", locale)}</p>
        </div>

        <a
          href={excelHref}
          download
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-control text-caption shadow-sm transition-colors cursor-pointer"
        >
          <Download className="size-4" />
          <span>{t("reports_export_excel", locale)}</span>
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("profit")}
          className={`flex items-center gap-2 px-4 py-2.5 text-body font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "profit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Coins className="size-4" />
          <span>{t("reports_tab_profit", locale)}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("wages")}
          className={`flex items-center gap-2 px-4 py-2.5 text-body font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "wages"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="size-4" />
          <span>{t("reports_tab_wages", locale)}</span>
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
          <span>{t("reports_tab_dispatch", locale)}</span>
        </button>
      </div>

      {/* TAB 1: PROFIT REPORT */}
      {activeTab === "profit" && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center justify-between text-muted-foreground text-caption">
                <span>{t("dashboard_revenue", locale)}</span>
                <TrendingUp className="size-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-foreground">{formatMoney(totalRevenue)}</div>
              <p className="text-2xs text-muted-foreground mt-1">Jami amalga oshirilgan sotuvlar</p>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="flex items-center justify-between text-muted-foreground text-caption">
                <span>{t("dashboard_total_costs", locale)}</span>
                <TrendingDown className="size-4 text-rose-500" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-foreground">{formatMoney(totalOverallCosts)}</div>
              <p className="text-2xs text-muted-foreground mt-1">Teraklar + K14 umumiy xarajatlar</p>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="flex items-center justify-between text-muted-foreground text-caption">
                <span>{t("reports_net_profit_estimated", locale)}</span>
                <Wallet className="size-4 text-blue-500" />
              </div>
              <div
                className={`mt-2 text-xl font-bold font-mono ${
                  totalEstimatedProfit >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatMoney(totalEstimatedProfit)}
              </div>
              <p className="text-2xs text-muted-foreground mt-1">Ombor qoldig'i hisobga olingan holda</p>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="flex items-center justify-between text-muted-foreground text-caption">
                <span>{t("reports_net_profit_real", locale)}</span>
                <Coins className="size-4 text-amber-500" />
              </div>
              <div
                className={`mt-2 text-xl font-bold font-mono ${
                  totalRealProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatMoney(totalRealProfit)}
              </div>
              <p className="text-2xs text-muted-foreground mt-1">Faqat kassa va tushum bo'yicha</p>
            </Card>
          </div>

          {/* Table */}
          <Card className="overflow-hidden border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-caption">
                    <th className="p-3 font-semibold">{t("teraks_name", locale)}</th>
                    <th className="p-3 font-semibold">{t("teraks_purchase_date", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("teraks_purchase_price", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("terak_costs_title", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("work_title", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("dashboard_total_costs", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("dashboard_revenue", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("dashboard_stock_value", locale)}</th>
                    <th className="p-3 font-semibold text-right">Taxminiy foyda</th>
                    <th className="p-3 font-semibold text-right">Haqiqiy foyda</th>
                    <th className="p-3 font-semibold text-center">{t("reports_margin", locale)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initialProfit.rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground">
                        {t("reports_empty", locale)}
                      </td>
                    </tr>
                  ) : (
                    initialProfit.rows.map((row) => (
                      <tr key={row.terakId} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium text-foreground">{row.name}</td>
                        <td className="p-3 text-muted-foreground font-mono text-caption">{row.purchaseDate}</td>
                        <td className="p-3 text-right font-mono">{formatMoney(row.purchasePrice)}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {formatMoney(row.additionalCosts)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">{formatMoney(row.workCosts)}</td>
                        <td className="p-3 text-right font-mono font-medium text-foreground">
                          {formatMoney(row.totalCosts)}
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {formatMoney(row.dispatchRevenue)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {formatMoney(row.stockValue)}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-bold ${
                            row.profitEstimated >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {formatMoney(row.profitEstimated)}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-bold ${
                            row.profitReal >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {formatMoney(row.profitReal)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge tone={row.marginEstimated >= 0 ? "success" : "danger"}>{row.marginEstimated}%</Badge>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* K14 General Expenses Row */}
                  {initialProfit.generalExpensesTotal > 0 && (
                    <tr className="bg-amber-500/5 font-medium border-t border-dashed border-amber-500/30">
                      <td colSpan={5} className="p-3 text-amber-700 dark:text-amber-400 font-semibold">
                        {t("reports_general_expenses", locale)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatMoney(initialProfit.generalExpensesTotal)}
                      </td>
                      <td colSpan={5} className="p-3 text-caption text-muted-foreground">
                        Umumiy sof foydadan chegiriladi (ijara, elektr va b.)
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40 font-bold text-foreground">
                  <tr>
                    <td colSpan={2} className="p-3">
                      {t("reports_total", locale)}:
                    </td>
                    <td className="p-3 text-right font-mono">{formatMoney(totalPurchase)}</td>
                    <td className="p-3 text-right font-mono">{formatMoney(totalAdditional)}</td>
                    <td className="p-3 text-right font-mono">{formatMoney(totalWork)}</td>
                    <td className="p-3 text-right font-mono text-foreground">{formatMoney(totalOverallCosts)}</td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {formatMoney(totalRevenue)}
                    </td>
                    <td className="p-3 text-right font-mono">{formatMoney(totalStock)}</td>
                    <td
                      className={`p-3 text-right font-mono ${totalEstimatedProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                    >
                      {formatMoney(totalEstimatedProfit)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${totalRealProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                    >
                      {formatMoney(totalRealProfit)}
                    </td>
                    <td className="p-3 text-center">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: WAGES REPORT */}
      {activeTab === "wages" && (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="p-4 border-border">
            <form onSubmit={handleFilterWages} className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                  {t("reports_date_from", locale)}:
                </span>
                <Input
                  type="date"
                  value={wagesDateFrom}
                  onChange={(e) => setWagesDateFrom(e.target.value)}
                  className="w-36 h-9 text-caption"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                  {t("reports_date_to", locale)}:
                </span>
                <Input
                  type="date"
                  value={wagesDateTo}
                  onChange={(e) => setWagesDateTo(e.target.value)}
                  className="w-36 h-9 text-caption"
                />
              </div>

              <Button type="submit" disabled={wagesLoading} className="gap-1.5 h-9 text-caption">
                <Filter className="size-4" />
                <span>{t("reports_filter_apply", locale)}</span>
              </Button>

              {(wagesDateFrom || wagesDateTo) && (
                <Button
                  type="button"
                  variant="subtle"
                  onClick={handleResetWages}
                  disabled={wagesLoading}
                  className="gap-1.5 h-9 text-caption"
                >
                  <RotateCcw className="size-4" />
                  <span>{t("reports_filter_clear", locale)}</span>
                </Button>
              )}
            </form>
          </Card>

          {/* Wages KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-card border-border">
              <div className="text-caption text-muted-foreground font-medium">{t("reports_wages_earned", locale)}</div>
              <div className="mt-2 text-xl font-bold font-mono text-foreground">{formatMoney(totalWagesEarned)}</div>
              <p className="text-2xs text-muted-foreground mt-1">Davr bo'yicha hisoblangan jami ish haqi</p>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="text-caption text-muted-foreground font-medium">{t("reports_wages_paid", locale)}</div>
              <div className="mt-2 text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatMoney(totalWagesPaid)}
              </div>
              <p className="text-2xs text-muted-foreground mt-1">Berilgan avans va ish haqi to'lovlari</p>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="text-caption text-muted-foreground font-medium">{t("reports_wages_balance", locale)}</div>
              <div
                className={`mt-2 text-xl font-bold font-mono ${
                  totalWagesBalance <= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {formatMoney(totalWagesBalance)}
              </div>
              <p className="text-2xs text-muted-foreground mt-1">Ishchilarga to'lanishi kerak bo'lgan qoldiq</p>
            </Card>
          </div>

          {/* Wages Table */}
          <Card className="overflow-hidden border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-caption">
                    <th className="p-3 font-semibold">{t("workers_name", locale)}</th>
                    <th className="p-3 font-semibold">{t("workers_salary_type", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("reports_wages_earned", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("reports_wages_paid", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("reports_wages_balance", locale)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {wagesRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {t("reports_empty", locale)}
                      </td>
                    </tr>
                  ) : (
                    wagesRows.map((w) => (
                      <tr key={w.workerId} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium text-foreground">{w.name}</td>
                        <td className="p-3">
                          <Badge tone={w.salaryType === "piecework" ? "info" : "neutral"}>
                            {w.salaryType === "piecework" ? t("salary_piecework", locale) : t("salary_monthly", locale)}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono font-medium">{formatMoney(w.totalEarned)}</td>
                        <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatMoney(w.totalPaid)}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-bold ${
                            w.currentBalance <= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {formatMoney(w.currentBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40 font-bold text-foreground">
                  <tr>
                    <td colSpan={2} className="p-3">
                      {t("reports_total", locale)}:
                    </td>
                    <td className="p-3 text-right font-mono">{formatMoney(totalWagesEarned)}</td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {formatMoney(totalWagesPaid)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${
                        totalWagesBalance <= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {formatMoney(totalWagesBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: DISPATCH REPORT */}
      {activeTab === "dispatch" && (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="p-4 border-border">
            <form onSubmit={handleFilterDispatch} className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                  {t("reports_date_from", locale)}:
                </span>
                <Input
                  type="date"
                  value={dispatchDateFrom}
                  onChange={(e) => setDispatchDateFrom(e.target.value)}
                  className="w-36 h-9 text-caption"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                  {t("reports_date_to", locale)}:
                </span>
                <Input
                  type="date"
                  value={dispatchDateTo}
                  onChange={(e) => setDispatchDateTo(e.target.value)}
                  className="w-36 h-9 text-caption"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
                  {t("nav_teraks", locale)}:
                </span>
                <select
                  value={dispatchTerakId}
                  onChange={(e) => setDispatchTerakId(e.target.value)}
                  className="h-9 px-3 rounded-control border border-border bg-card text-foreground text-caption"
                >
                  <option value="">{t("reports_all_teraks", locale)}</option>
                  {teraksList.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" disabled={dispatchLoading} className="gap-1.5 h-9 text-caption">
                <Filter className="size-4" />
                <span>{t("reports_filter_apply", locale)}</span>
              </Button>

              {(dispatchDateFrom || dispatchDateTo || dispatchTerakId) && (
                <Button
                  type="button"
                  variant="subtle"
                  onClick={handleResetDispatch}
                  disabled={dispatchLoading}
                  className="gap-1.5 h-9 text-caption"
                >
                  <RotateCcw className="size-4" />
                  <span>{t("reports_filter_clear", locale)}</span>
                </Button>
              )}
            </form>
          </Card>

          {/* Dispatch KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-card border-border">
              <div className="text-caption text-muted-foreground font-medium">Yuk chiqarishlar soni</div>
              <div className="mt-2 text-xl font-bold font-mono text-foreground">{dispatchRows.length} ta</div>
              <p className="text-2xs text-muted-foreground mt-1">Jami amalga oshirilgan partiyalar</p>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="text-caption text-muted-foreground font-medium">Jami miqdor va hajm</div>
              <div className="mt-2 text-xl font-bold font-mono text-foreground">
                {totalDispatchPieces} dona / {totalDispatchVolume.toFixed(2)} m³
              </div>
              <p className="text-2xs text-muted-foreground mt-1">Chiqarilgan yog'och mahsulotlari hajmi</p>
            </Card>

            <Card className="p-4 bg-card border-border">
              <div className="text-caption text-muted-foreground font-medium">
                {t("dispatch_total_revenue", locale)}
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatMoney(totalDispatchAmount)}
              </div>
              <p className="text-2xs text-muted-foreground mt-1">Davr bo'yicha umumiy savdo aylanmasi</p>
            </Card>
          </div>

          {/* Dispatch Table */}
          <Card className="overflow-hidden border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-caption">
                    <th className="p-3 font-semibold">{t("dispatch_date", locale)}</th>
                    <th className="p-3 font-semibold">{t("nav_teraks", locale)}</th>
                    <th className="p-3 font-semibold">{t("nav_materials", locale)}</th>
                    <th className="p-3 font-semibold text-right">{t("dispatch_quantity", locale)}</th>
                    <th className="p-3 font-semibold text-right">Hajm (m³)</th>
                    <th className="p-3 font-semibold text-right">{t("dispatch_total", locale)}</th>
                    <th className="p-3 font-semibold">{t("dispatch_recipient", locale)}</th>
                    <th className="p-3 font-semibold">{t("dispatch_truck", locale)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dispatchRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        {t("reports_empty", locale)}
                      </td>
                    </tr>
                  ) : (
                    dispatchRows.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-muted-foreground font-mono text-caption">{d.date}</td>
                        <td className="p-3 font-medium text-foreground">{d.terakName}</td>
                        <td className="p-3 text-foreground">{d.materialName}</td>
                        <td className="p-3 text-right font-mono font-medium">
                          {d.quantity} {d.materialUnit}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {d.volumeTotalM3 ? `${d.volumeTotalM3} m³` : "-"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(d.totalAmount)}
                        </td>
                        <td className="p-3 text-foreground">
                          <div>{d.recipientName || "-"}</div>
                          {d.phone && <div className="text-2xs text-muted-foreground font-mono">{d.phone}</div>}
                        </td>
                        <td className="p-3 text-muted-foreground">{d.truckName || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40 font-bold text-foreground">
                  <tr>
                    <td colSpan={3} className="p-3">
                      {t("reports_total", locale)}:
                    </td>
                    <td className="p-3 text-right font-mono">{totalDispatchPieces}</td>
                    <td className="p-3 text-right font-mono">{totalDispatchVolume.toFixed(2)} m³</td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {formatMoney(totalDispatchAmount)}
                    </td>
                    <td colSpan={2} className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
