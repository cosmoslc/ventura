"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, Filter, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { Input } from "@ventura/ui/input";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/calc/units";
import { deleteWorkAction, type WorkListItem } from "./actions";
import { SingleWorkDialog, type SingleWorkDialogProps } from "./single-work-dialog";
import { GroupWorkDialog } from "./group-work-dialog";

interface WorkClientProps {
  initialWorks: WorkListItem[];
  workers: SingleWorkDialogProps["workers"];
  teraks: SingleWorkDialogProps["teraks"];
  workTypes: SingleWorkDialogProps["workTypes"];
  materials: SingleWorkDialogProps["materials"];
  terakMaterials: SingleWorkDialogProps["terakMaterials"];
  specialPrices: SingleWorkDialogProps["specialPrices"];
  cubeInputMode: "direct" | "calculated";
  canManage: boolean;
  locale: "uz" | "ru";
}

export function WorkClient({
  initialWorks,
  workers,
  teraks,
  workTypes,
  materials,
  terakMaterials,
  specialPrices,
  cubeInputMode,
  canManage,
  locale,
}: WorkClientProps) {
  const today = new Date().toISOString().slice(0, 10);

  // Filters
  const [filterWorkerId, setFilterWorkerId] = React.useState<string>("");
  const [filterTerakId, setFilterTerakId] = React.useState<string>("");
  const [filterDate, setFilterDate] = React.useState<string>("");

  // Dialogs
  const [singleDialogOpen, setSingleDialogOpen] = React.useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = React.useState(false);

  // Delete modal
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Filtered works
  const filteredWorks = React.useMemo(() => {
    return initialWorks.filter((w) => {
      if (filterWorkerId && w.workerId !== filterWorkerId) return false;
      if (filterTerakId && w.terakId !== filterTerakId) return false;
      if (filterDate && w.date !== filterDate) return false;
      return true;
    });
  }, [initialWorks, filterWorkerId, filterTerakId, filterDate]);

  // Stats
  const todayWorks = React.useMemo(() => initialWorks.filter((w) => w.date === today), [initialWorks, today]);
  const todayTotal = React.useMemo(() => todayWorks.reduce((acc, w) => acc + w.amount, 0), [todayWorks]);
  const filteredTotal = React.useMemo(() => filteredWorks.reduce((acc, w) => acc + w.amount, 0), [filteredWorks]);

  async function handleConfirmDelete() {
    if (!deleteId) return;
    await deleteWorkAction(deleteId);
    setDeleteId(null);
  }

  function clearFilters() {
    setFilterWorkerId("");
    setFilterTerakId("");
    setFilterDate("");
  }

  const hasActiveFilters = !!(filterWorkerId || filterTerakId || filterDate);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("work_title", locale)}</h1>
          <p className="text-caption text-muted-foreground mt-0.5">{t("work_subtitle", locale)}</p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setSingleDialogOpen(true)}
              className="gap-2 shrink-0 bg-primary text-primary-foreground"
            >
              <Plus className="size-4" />
              <span>{t("work_add_single", locale)}</span>
            </Button>
            <Button onClick={() => setGroupDialogOpen(true)} variant="subtle" className="gap-2 shrink-0">
              <Users className="size-4" />
              <span>{t("work_add_group", locale)}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <span className="text-caption text-muted-foreground block font-medium">{t("work_today_count", locale)}</span>
          <span className="text-title font-bold text-foreground font-mono mt-1 block">
            {todayWorks.length} ta yozuv
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-caption text-muted-foreground block font-medium">{t("work_today_total", locale)}</span>
          <span className="text-title font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
            {formatMoney(todayTotal)}
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-caption text-muted-foreground block font-medium">
            {t("work_filtered_total", locale)}
          </span>
          <span className="text-title font-bold text-primary font-mono mt-1 block">{formatMoney(filteredTotal)}</span>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 text-caption font-semibold text-foreground shrink-0">
            <Filter className="size-4 text-muted-foreground" />
            <span>Filtrlar:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            {/* Worker Filter */}
            <select
              value={filterWorkerId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterWorkerId(e.target.value)}
              className="w-full px-3 py-1.5 text-caption bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">{t("work_filter_worker", locale)}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            {/* Terak Filter */}
            <select
              value={filterTerakId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterTerakId(e.target.value)}
              className="w-full px-3 py-1.5 text-caption bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">{t("work_filter_terak", locale)}</option>
              {teraks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>

            {/* Date Filter */}
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={filterDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterDate(e.target.value)}
                className="h-8 text-caption"
              />
              <Button
                variant={filterDate === today ? "primary" : "subtle"}
                onClick={() => setFilterDate(filterDate === today ? "" : today)}
                className="h-8 px-2.5 text-2xs shrink-0"
              >
                Bugun
              </Button>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-8 px-2.5 text-2xs text-muted-foreground hover:text-foreground shrink-0"
            >
              Tozalash
            </Button>
          )}
        </div>
      </Card>

      {/* Works Table */}
      {filteredWorks.length === 0 ? (
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
                  <th className="px-4 py-3">{t("work_worker", locale)}</th>
                  <th className="px-4 py-3">{t("work_type", locale)}</th>
                  <th className="px-4 py-3">{t("work_terak", locale)}</th>
                  <th className="px-4 py-3">{t("work_quantity", locale)}</th>
                  <th className="px-4 py-3 text-right">{t("work_amount", locale)}</th>
                  {canManage && <th className="px-4 py-3 text-right">Amallar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-caption">
                {filteredWorks.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{w.date}</td>
                    <td className="px-4 py-3 text-foreground font-sans font-semibold">
                      <Link href={`/workers/${w.workerId}`} className="hover:text-primary transition-colors block">
                        {w.workerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground font-sans">
                      <div className="flex items-center gap-1.5">
                        <span>
                          {w.kind === "material" ? (w.materialName ?? "Material") : (w.workTypeName ?? "Oddiy ish")}
                        </span>
                        {w.groupId && <Badge tone="info">{t("work_group_badge", locale)}</Badge>}
                      </div>
                      {w.note && <span className="text-2xs text-muted-foreground block">{w.note}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      {w.terakId ? (
                        <Link href={`/teraks/${w.terakId}`} className="hover:text-primary transition-colors">
                          {w.terakName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
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
                          onClick={() => setDeleteId(w.id)}
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

      {/* Dialogs */}
      <SingleWorkDialog
        open={singleDialogOpen}
        onOpenChange={setSingleDialogOpen}
        workers={workers}
        teraks={teraks}
        workTypes={workTypes}
        materials={materials}
        terakMaterials={terakMaterials}
        specialPrices={specialPrices}
        cubeInputMode={cubeInputMode}
        locale={locale}
      />

      <GroupWorkDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        workers={workers}
        teraks={teraks}
        workTypes={workTypes}
        materials={materials}
        terakMaterials={terakMaterials}
        specialPrices={specialPrices}
        cubeInputMode={cubeInputMode}
        locale={locale}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteId}
        onOpenChange={(open: boolean) => !open && setDeleteId(null)}
        title={t("action_delete", locale)}
        message={t("work_delete_confirm", locale)}
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
