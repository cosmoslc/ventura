"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Edit2, Plus, Users } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { toggleArchiveWorkerAction } from "./actions";
import { type WorkerData, WorkerDialog } from "./worker-dialog";

interface WorkerItem {
  id: string;
  name: string;
  phone: string | null;
  salaryType: "piecework" | "daily" | "weekly" | "monthly";
  wageAmount: number;
  archivedAt: Date | null;
}

interface WorkersClientProps {
  activeWorkers: WorkerItem[];
  archivedWorkers: WorkerItem[];
  canManage: boolean;
  locale: Locale;
}

export function WorkersClient({
  activeWorkers,
  archivedWorkers,
  canManage,
  locale,
}: WorkersClientProps) {
  const [tab, setTab] = React.useState<"active" | "archived">("active");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedWorker, setSelectedWorker] = React.useState<WorkerData | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(null);

  const list = tab === "active" ? activeWorkers : archivedWorkers;

  const salaryLabels: Record<string, string> = {
    piecework: t("salary_piecework", locale),
    daily: t("salary_daily", locale),
    weekly: t("salary_weekly", locale),
    monthly: t("salary_monthly", locale),
  };

  const salaryTones: Record<string, "info" | "success" | "warning" | "neutral"> = {
    piecework: "info",
    daily: "warning",
    weekly: "warning",
    monthly: "success",
  };

  function handleAdd() {
    setSelectedWorker(null);
    setDialogOpen(true);
  }

  function handleEdit(w: WorkerItem) {
    setSelectedWorker({
      id: w.id,
      name: w.name,
      phone: w.phone,
      salaryType: w.salaryType,
      wageAmount: w.wageAmount,
    });
    setDialogOpen(true);
  }

  function triggerArchive(id: string) {
    setArchiveTargetId(id);
    setConfirmOpen(true);
  }

  async function handleConfirmArchive() {
    if (!archiveTargetId) return;
    await toggleArchiveWorkerAction(archiveTargetId);
    setArchiveTargetId(null);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {t("workers_title", locale)}
          </h1>
          <p className="text-caption text-muted-foreground mt-0.5">
            {t("workers_subtitle", locale)}
          </p>
        </div>

        {canManage && (
          <Button onClick={handleAdd} className="gap-2 shrink-0">
            <Plus className="size-4" />
            <span>{t("workers_add", locale)}</span>
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
          {t("workers_active", locale)} ({activeWorkers.length})
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
          {t("workers_archived", locale)} ({archivedWorkers.length})
        </button>
      </div>

      {/* Workers List */}
      {list.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <div className="size-12 rounded-btn bg-muted flex items-center justify-center mx-auto mb-3">
            <Users className="size-6 text-muted-foreground" />
          </div>
          <p className="text-body font-medium">{t("workers_empty", locale)}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((w) => (
            <Card key={w.id} className="p-4 flex flex-col justify-between hover:border-border-soft transition-all">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-body text-foreground">{w.name}</h3>
                    <p className="text-caption text-muted-foreground font-mono">
                      {w.phone ?? "Telefon kiritilmagan"}
                    </p>
                  </div>
                  <Badge tone={salaryTones[w.salaryType] ?? "neutral"}>
                    {salaryLabels[w.salaryType] ?? w.salaryType}
                  </Badge>
                </div>

                {w.salaryType !== "piecework" && (
                  <div className="text-caption font-semibold text-foreground pt-1">
                    {formatMoney(w.wageAmount)}
                  </div>
                )}
              </div>

              {canManage && (
                <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-border">
                  <Button
                    variant="ghost"
                    onClick={() => handleEdit(w)}
                    className="h-8 px-2.5 text-caption"
                  >
                    <Edit2 className="size-3.5 mr-1" />
                    {t("action_edit", locale)}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => triggerArchive(w.id)}
                    className="h-8 px-2.5 text-caption text-muted-foreground hover:text-destructive"
                  >
                    {w.archivedAt ? (
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

      {/* Add / Edit Dialog */}
      <WorkerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        worker={selectedWorker}
        locale={locale}
      />

      {/* Confirm Archive Modal */}
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("workers_archive_action", locale)}
        message={t("workers_archive_confirm", locale)}
        confirmLabel={t("action_save", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmArchive}
      />
    </div>
  );
}
