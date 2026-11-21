"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CalendarCheck, Coins, Plus, Tag, Trash2 } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/calc/units";
import { deleteWorkAction } from "@/app/(app)/work/actions";
import { deletePaymentAction, deleteWageAccrualAction, deleteWorkerSpecialPriceAction } from "./actions";
import { PaymentDialog } from "./payment-dialog";
import { WageAccrualDialog } from "./wage-accrual-dialog";
import { SpecialPriceDialog } from "./special-price-dialog";

interface WorkerProfileClientProps {
  data: {
    worker: {
      id: string;
      name: string;
      phone: string | null;
      salaryType: "piecework" | "daily" | "weekly" | "monthly";
      wageAmount: number;
    };
    works: Array<{
      id: string;
      date: string;
      terakId: string | null;
      terakName: string | null;
      workTypeId: string | null;
      workTypeName: string | null;
      kind: "regular" | "material";
      groupId: string | null;
      amount: number;
      materialId: string | null;
      materialName: string | null;
      sizeId: string | null;
      sizeName: string | null;
      quantity: string | null;
      rows: string | null;
      payUnit: "piece" | "row" | "cube" | null;
      note: string | null;
      createdAt: Date;
    }>;
    payments: Array<{
      id: string;
      workerId: string;
      amount: number;
      date: string;
      note: string | null;
      createdAt: Date;
    }>;
    accruals: Array<{
      id: string;
      periodStart: string;
      periodEnd: string;
      units: number;
      rate: number;
      amount: number;
      terakId: string | null;
      terakName: string | null;
      workEntryId: string | null;
      createdAt: Date;
    }>;
    specialPrices: Array<{
      materialId: string;
      materialName: string;
      unit: string;
      pricingMode: string;
      price: number;
    }>;
    allMaterials: Array<{
      id: string;
      name: string;
      unit: string;
      pricingMode: string;
    }>;
    activeTeraks: Array<{
      id: string;
      name: string;
    }>;
    balance: {
      totalEarned: number;
      totalPaid: number;
      balance: number;
    };
  };
  canManage: boolean;
  locale: "uz" | "ru";
}

const salaryTones: Record<string, "info" | "success" | "warning" | "neutral"> = {
  piecework: "neutral",
  daily: "info",
  weekly: "warning",
  monthly: "success",
};

export function WorkerProfileClient({ data, canManage, locale }: WorkerProfileClientProps) {
  const { worker, works, payments, accruals, specialPrices, allMaterials, activeTeraks, balance } = data;

  const [activeTab, setActiveTab] = React.useState<"works" | "payments" | "accruals" | "specialPrices">("works");

  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [accrualDialogOpen, setAccrualDialogOpen] = React.useState(false);
  const [specialPriceDialogOpen, setSpecialPriceDialogOpen] = React.useState(false);
  const [selectedSpecialPrice, setSelectedSpecialPrice] = React.useState<{
    materialId: string;
    price: number;
  } | null>(null);

  // Confirm delete states
  const [deleteWorkId, setDeleteWorkId] = React.useState<string | null>(null);
  const [deletePaymentId, setDeletePaymentId] = React.useState<string | null>(null);
  const [deleteAccrualId, setDeleteAccrualId] = React.useState<string | null>(null);
  const [deleteSpecialPriceMatId, setDeleteSpecialPriceMatId] = React.useState<string | null>(null);

  const salaryLabels: Record<string, string> = {
    piecework: t("salary_piecework", locale),
    daily: t("salary_daily", locale),
    weekly: t("salary_weekly", locale),
    monthly: t("salary_monthly", locale),
  };

  async function handleConfirmDeleteWork() {
    if (!deleteWorkId) return;
    await deleteWorkAction(deleteWorkId);
    setDeleteWorkId(null);
  }

  async function handleConfirmDeletePayment() {
    if (!deletePaymentId) return;
    await deletePaymentAction(deletePaymentId, worker.id);
    setDeletePaymentId(null);
  }

  async function handleConfirmDeleteAccrual() {
    if (!deleteAccrualId) return;
    await deleteWageAccrualAction(deleteAccrualId, worker.id);
    setDeleteAccrualId(null);
  }

  async function handleConfirmDeleteSpecialPrice() {
    if (!deleteSpecialPriceMatId) return;
    await deleteWorkerSpecialPriceAction(worker.id, deleteSpecialPriceMatId);
    setDeleteSpecialPriceMatId(null);
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/workers"
          className="inline-flex items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>{t("workers_title", locale)}</span>
        </Link>
      </div>

      {/* Header Profile Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{worker.name}</h1>
              <Badge tone={salaryTones[worker.salaryType] ?? "neutral"}>
                {salaryLabels[worker.salaryType] ?? worker.salaryType}
              </Badge>
            </div>
            <p className="text-caption text-muted-foreground font-mono">
              {worker.phone ?? "Telefon raqam ko'rsatilmagan"}
            </p>
            {worker.salaryType !== "piecework" && (
              <p className="text-caption font-semibold text-foreground">
                Stavka: <span className="font-mono">{formatMoney(worker.wageAmount)}</span> (
                {salaryLabels[worker.salaryType]})
              </p>
            )}
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setPaymentDialogOpen(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Banknote className="size-4" />
                <span>{t("worker_give_payment", locale)}</span>
              </Button>

              {worker.salaryType !== "piecework" && (
                <Button onClick={() => setAccrualDialogOpen(true)} variant="subtle" className="gap-2">
                  <CalendarCheck className="size-4" />
                  <span>{t("worker_accrue_wage", locale)}</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Balance Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-6 border-t border-border">
          <div className="p-4 rounded-card bg-muted/40 border border-border">
            <span className="text-caption text-muted-foreground block font-medium">
              {t("worker_total_earned", locale)}
            </span>
            <span className="text-title font-bold text-foreground font-mono mt-1 block">
              {formatMoney(balance.totalEarned)}
            </span>
          </div>

          <div className="p-4 rounded-card bg-muted/40 border border-border">
            <span className="text-caption text-muted-foreground block font-medium">
              {t("worker_total_paid", locale)}
            </span>
            <span className="text-title font-bold text-foreground font-mono mt-1 block">
              {formatMoney(balance.totalPaid)}
            </span>
          </div>

          <div
            className={`p-4 rounded-card border ${
              balance.balance > 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : balance.balance < 0
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                  : "bg-muted/40 border-border text-foreground"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-caption font-medium">{t("worker_current_balance", locale)}</span>
              {balance.balance > 0 && <Badge tone="success">{t("worker_balance_payable", locale)}</Badge>}
              {balance.balance < 0 && <Badge tone="warning">{t("worker_balance_overpaid", locale)}</Badge>}
            </div>
            <span className="text-title font-bold font-mono mt-1 block">{formatMoney(Math.abs(balance.balance))}</span>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("works")}
          className={`px-4 py-2.5 text-body font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "works"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("worker_tab_works", locale)} ({works.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2.5 text-body font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "payments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("worker_tab_payments", locale)} ({payments.length})
        </button>

        {worker.salaryType !== "piecework" && (
          <button
            type="button"
            onClick={() => setActiveTab("accruals")}
            className={`px-4 py-2.5 text-body font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "accruals"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("worker_tab_accruals", locale)} ({accruals.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("specialPrices")}
          className={`px-4 py-2.5 text-body font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "specialPrices"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("worker_tab_special_prices", locale)} ({specialPrices.length})
        </button>
      </div>

      {/* Tab 1: Works */}
      {activeTab === "works" && (
        <div>
          {works.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <Coins className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-body font-medium">{t("work_empty", locale)}</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body">
                  <thead className="bg-muted/50 border-b border-border text-caption font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">{t("work_date", locale)}</th>
                      <th className="px-4 py-3">{t("work_type", locale)}</th>
                      <th className="px-4 py-3">{t("work_terak", locale)}</th>
                      <th className="px-4 py-3">{t("work_quantity", locale)}</th>
                      <th className="px-4 py-3 text-right">{t("work_amount", locale)}</th>
                      {canManage && <th className="px-4 py-3 text-right">Amallar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-caption">
                    {works.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">{w.date}</td>
                        <td className="px-4 py-3 text-foreground font-sans">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">
                              {w.kind === "material" ? (w.materialName ?? "Material") : (w.workTypeName ?? "Oddiy ish")}
                            </span>
                            {w.groupId && <Badge tone="info">{t("work_group_badge", locale)}</Badge>}
                          </div>
                          {w.note && <span className="text-2xs text-muted-foreground block">{w.note}</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-sans">{w.terakName ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {w.kind === "material" ? (
                            <>
                              {w.payUnit === "row" && w.rows && `${w.rows} qator`}
                              {w.payUnit === "piece" && w.quantity && `${w.quantity} dona`}
                              {w.payUnit === "cube" && w.quantity && `${w.quantity} dona`}
                              {w.sizeName && <span className="block text-2xs text-muted-foreground">{w.sizeName}</span>}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{formatMoney(w.amount)}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              onClick={() => setDeleteWorkId(w.id)}
                              className="size-8 p-0 text-muted-foreground hover:text-destructive"
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
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Payments */}
      {activeTab === "payments" && (
        <div>
          {payments.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <Banknote className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-body font-medium">{t("payment_empty", locale)}</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body">
                  <thead className="bg-muted/50 border-b border-border text-caption font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">{t("payment_date", locale)}</th>
                      <th className="px-4 py-3">{t("payment_amount", locale)}</th>
                      <th className="px-4 py-3">{t("payment_note", locale)}</th>
                      {canManage && <th className="px-4 py-3 text-right">Amallar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-caption">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">{p.date}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-sans">{p.note ?? "—"}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              onClick={() => setDeletePaymentId(p.id)}
                              className="size-8 p-0 text-muted-foreground hover:text-destructive"
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
            </Card>
          )}
        </div>
      )}

      {/* Tab 3: Accruals */}
      {activeTab === "accruals" && (
        <div>
          {accruals.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <CalendarCheck className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-body font-medium">{t("wage_accruals_empty", locale)}</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body">
                  <thead className="bg-muted/50 border-b border-border text-caption font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">{t("wage_accrual_period", locale)}</th>
                      <th className="px-4 py-3">{t("wage_accrual_units", locale)}</th>
                      <th className="px-4 py-3">{t("wage_accrual_rate", locale)}</th>
                      <th className="px-4 py-3">{t("wage_accrual_terak", locale)}</th>
                      <th className="px-4 py-3 text-right">{t("cost_amount", locale)}</th>
                      {canManage && <th className="px-4 py-3 text-right">Amallar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-caption">
                    {accruals.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          {a.periodStart} — {a.periodEnd}
                        </td>
                        <td className="px-4 py-3 text-foreground">{a.units}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatMoney(a.rate)}</td>
                        <td className="px-4 py-3 text-muted-foreground font-sans">{a.terakName ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{formatMoney(a.amount)}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              onClick={() => setDeleteAccrualId(a.id)}
                              className="size-8 p-0 text-muted-foreground hover:text-destructive"
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
            </Card>
          )}
        </div>
      )}

      {/* Tab 4: Special Prices */}
      {activeTab === "specialPrices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted-foreground">{t("special_price_hint", locale)}</p>
            {canManage && (
              <Button
                onClick={() => {
                  setSelectedSpecialPrice(null);
                  setSpecialPriceDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="size-4" />
                <span>{t("special_price_set", locale)}</span>
              </Button>
            )}
          </div>

          {specialPrices.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <Tag className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-body font-medium">{t("special_price_empty", locale)}</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body">
                  <thead className="bg-muted/50 border-b border-border text-caption font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">{t("work_material", locale)}</th>
                      <th className="px-4 py-3">{t("materials_pricing_mode", locale)}</th>
                      <th className="px-4 py-3 text-right">{t("special_price_val", locale)}</th>
                      {canManage && <th className="px-4 py-3 text-right">Amallar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-caption">
                    {specialPrices.map((sp) => (
                      <tr key={sp.materialId} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-foreground font-sans font-semibold">{sp.materialName}</td>
                        <td className="px-4 py-3 text-muted-foreground font-sans">
                          {sp.pricingMode === "row" ? "Qator bo'yicha" : "Dona bo'yicha"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{formatMoney(sp.price)}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setSelectedSpecialPrice({
                                    materialId: sp.materialId,
                                    price: sp.price,
                                  });
                                  setSpecialPriceDialogOpen(true);
                                }}
                                className="h-8 px-2 text-2xs"
                              >
                                {t("action_edit", locale)}
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => setDeleteSpecialPriceMatId(sp.materialId)}
                                className="size-8 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Dialogs */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        workerId={worker.id}
        locale={locale}
      />

      <WageAccrualDialog
        open={accrualDialogOpen}
        onOpenChange={setAccrualDialogOpen}
        workerId={worker.id}
        salaryType={worker.salaryType}
        defaultRate={worker.wageAmount}
        teraks={activeTeraks}
        locale={locale}
      />

      <SpecialPriceDialog
        open={specialPriceDialogOpen}
        onOpenChange={setSpecialPriceDialogOpen}
        workerId={worker.id}
        allMaterials={allMaterials}
        initialMaterialId={selectedSpecialPrice?.materialId}
        initialPrice={selectedSpecialPrice?.price}
        locale={locale}
      />

      {/* Delete Modals */}
      <ConfirmModal
        open={!!deleteWorkId}
        onOpenChange={(open: boolean) => !open && setDeleteWorkId(null)}
        title={t("action_delete", locale)}
        message={t("work_delete_confirm", locale)}
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmDeleteWork}
      />

      <ConfirmModal
        open={!!deletePaymentId}
        onOpenChange={(open: boolean) => !open && setDeletePaymentId(null)}
        title={t("action_delete", locale)}
        message={t("payment_delete_confirm", locale)}
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmDeletePayment}
      />

      <ConfirmModal
        open={!!deleteAccrualId}
        onOpenChange={(open: boolean) => !open && setDeleteAccrualId(null)}
        title={t("action_delete", locale)}
        message={t("wage_accrual_delete_confirm", locale)}
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmDeleteAccrual}
      />

      <ConfirmModal
        open={!!deleteSpecialPriceMatId}
        onOpenChange={(open: boolean) => !open && setDeleteSpecialPriceMatId(null)}
        title={t("action_delete", locale)}
        message="Haqiqatan ham ushbu maxsus narxni o'chirmoqchimisiz?"
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmDeleteSpecialPrice}
      />
    </div>
  );
}
