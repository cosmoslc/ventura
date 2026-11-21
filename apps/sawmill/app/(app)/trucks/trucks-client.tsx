"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Edit2, Plus, Truck } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { toggleArchiveTruckAction } from "./actions";
import { type TruckData, TruckDialog } from "./truck-dialog";

interface TruckItem {
  id: string;
  name: string;
  amount: number;
  archivedAt: Date | null;
}

interface TrucksClientProps {
  activeTrucks: TruckItem[];
  archivedTrucks: TruckItem[];
  canManage: boolean;
  locale: Locale;
}

export function TrucksClient({ activeTrucks, archivedTrucks, canManage, locale }: TrucksClientProps) {
  const [tab, setTab] = React.useState<"active" | "archived">("active");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedTruck, setSelectedTruck] = React.useState<TruckData | null>(null);

  // Confirm archive
  const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(null);

  const list = tab === "active" ? activeTrucks : archivedTrucks;

  function handleAdd() {
    setSelectedTruck(null);
    setDialogOpen(true);
  }

  function handleEdit(tr: TruckItem) {
    setSelectedTruck({
      id: tr.id,
      name: tr.name,
      amount: tr.amount,
    });
    setDialogOpen(true);
  }

  async function handleConfirmArchive() {
    if (!archiveTargetId) return;
    await toggleArchiveTruckAction(archiveTargetId);
    setArchiveTargetId(null);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("trucks_title", locale)}</h1>
          <p className="text-caption text-muted-foreground mt-0.5">{t("trucks_subtitle", locale)}</p>
        </div>

        {canManage && (
          <Button onClick={handleAdd} className="gap-2 shrink-0">
            <Plus className="size-4" />
            <span>{t("trucks_add", locale)}</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`px-4 py-2.5 text-body font-semibold border-b-2 transition-all cursor-pointer ${
            tab === "active"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("workers_active", locale)} ({activeTrucks.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("archived")}
          className={`px-4 py-2.5 text-body font-semibold border-b-2 transition-all cursor-pointer ${
            tab === "archived"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("workers_archived", locale)} ({archivedTrucks.length})
        </button>
      </div>

      {/* Trucks List */}
      {list.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <div className="size-12 rounded-btn bg-muted flex items-center justify-center mx-auto mb-3">
            <Truck className="size-6 text-muted-foreground" />
          </div>
          <p className="text-body font-medium">{t("trucks_empty", locale)}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((tr) => (
            <Card key={tr.id} className="p-5 flex flex-col justify-between hover:border-border-soft transition-all">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-btn bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Truck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-body text-foreground">{tr.name}</h3>
                    <p className="text-caption font-semibold text-primary font-mono mt-0.5">
                      1 reys: {formatMoney(tr.amount)}
                    </p>
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center justify-end gap-1.5 pt-3 mt-4 border-t border-border">
                  <Button variant="ghost" onClick={() => handleEdit(tr)} className="h-8 px-2.5 text-caption">
                    <Edit2 className="size-3.5 mr-1" />
                    {t("action_edit", locale)}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setArchiveTargetId(tr.id)}
                    className="h-8 px-2.5 text-caption text-muted-foreground hover:text-destructive"
                  >
                    {tr.archivedAt ? (
                      <>
                        <ArchiveRestore className="size-3.5 mr-1" />
                        {t("workers_restore", locale)}
                      </>
                    ) : (
                      <>
                        <Archive className="size-3.5 mr-1" />
                        {t("workers_archive_action", locale)}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit / Add Dialog */}
      <TruckDialog open={dialogOpen} onOpenChange={setDialogOpen} truck={selectedTruck} locale={locale} />

      {/* Confirm Archive Modal */}
      <ConfirmModal
        open={!!archiveTargetId}
        onOpenChange={(open) => !open && setArchiveTargetId(null)}
        title={t("workers_archive_action", locale)}
        message="Haqiqatan ham ushbu mashinani arxivlamoqchimisiz?"
        confirmLabel={t("action_save", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmArchive}
      />
    </div>
  );
}
