"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Edit2, Plus, Trash2, TreePine, Undo2 } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { permanentDeleteTerakAction, restoreTerakAction, trashTerakAction } from "./actions";
import { type TerakData, TerakDialog } from "./terak-dialog";

interface TerakListItem {
  id: string;
  name: string;
  purchaseDate: string;
  purchasePrice: number;
  note: string | null;
  deletedAt?: Date | null;
}

interface TeraksClientProps {
  activeTeraks: TerakListItem[];
  trashedTeraks: TerakListItem[];
  canManage: boolean;
  canDelete: boolean;
  locale: Locale;
}

export function TeraksClient({
  activeTeraks,
  trashedTeraks,
  canManage,
  canDelete,
  locale,
}: TeraksClientProps) {
  const [tab, setTab] = React.useState<"active" | "trash">("active");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedTerak, setSelectedTerak] = React.useState<TerakData | null>(null);

  // Trash / Restore / Permanent delete modals
  const [trashTargetId, setTrashTargetId] = React.useState<string | null>(null);
  const [restoreTargetId, setRestoreTargetId] = React.useState<string | null>(null);
  const [permDeleteTargetId, setPermDeleteTargetId] = React.useState<string | null>(null);

  const list = tab === "active" ? activeTeraks : trashedTeraks;

  function handleAdd() {
    setSelectedTerak(null);
    setDialogOpen(true);
  }

  function handleEdit(trk: TerakListItem) {
    setSelectedTerak({
      id: trk.id,
      name: trk.name,
      purchaseDate: trk.purchaseDate,
      purchasePrice: trk.purchasePrice,
      note: trk.note,
    });
    setDialogOpen(true);
  }

  async function handleConfirmTrash() {
    if (!trashTargetId) return;
    await trashTerakAction(trashTargetId);
    setTrashTargetId(null);
  }

  async function handleConfirmRestore() {
    if (!restoreTargetId) return;
    await restoreTerakAction(restoreTargetId);
    setRestoreTargetId(null);
  }

  async function handleConfirmPermDelete() {
    if (!permDeleteTargetId) return;
    await permanentDeleteTerakAction(permDeleteTargetId);
    setPermDeleteTargetId(null);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {t("teraks_title", locale)}
          </h1>
          <p className="text-caption text-muted-foreground mt-0.5">
            {t("teraks_subtitle", locale)}
          </p>
        </div>

        {canManage && (
          <Button onClick={handleAdd} className="gap-2 shrink-0">
            <Plus className="size-4" />
            <span>{t("teraks_add", locale)}</span>
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
          {t("teraks_active", locale)} ({activeTeraks.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("trash")}
          className={`px-4 py-2.5 text-body font-semibold border-b-2 transition-all cursor-pointer ${
            tab === "trash"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("teraks_trash", locale)} ({trashedTeraks.length})
        </button>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <div className="size-12 rounded-btn bg-muted flex items-center justify-center mx-auto mb-3">
            <TreePine className="size-6 text-muted-foreground" />
          </div>
          <p className="text-body font-medium">
            {tab === "active" ? t("teraks_empty", locale) : t("teraks_trash_empty", locale)}
          </p>
          {tab === "trash" && (
            <p className="text-2xs text-muted-foreground mt-1">
              {t("teraks_trash_hint", locale)}
            </p>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((trk) => (
            <Card key={trk.id} className="p-5 flex flex-col justify-between hover:border-border-soft transition-all">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-btn bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <TreePine className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground">{trk.name}</h3>
                      <p className="text-2xs text-muted-foreground font-mono">
                        {trk.purchaseDate}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-card bg-muted/50 space-y-1">
                  <div className="flex items-center justify-between text-caption">
                    <span className="text-muted-foreground">{t("teraks_purchase_price", locale)}:</span>
                    <span className="font-bold font-mono text-foreground">
                      {formatMoney(trk.purchasePrice)}
                    </span>
                  </div>
                  {trk.note && (
                    <p className="text-2xs text-muted-foreground truncate pt-0.5" title={trk.note}>
                      {trk.note}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-4 border-t border-border">
                {tab === "active" ? (
                  <>
                    <div className="flex items-center gap-1">
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => handleEdit(trk)}
                            className="h-8 px-2 text-caption"
                            title={t("action_edit", locale)}
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setTrashTargetId(trk.id)}
                            className="h-8 px-2 text-caption text-muted-foreground hover:text-destructive"
                            title={t("teraks_to_trash", locale)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>

                    <Button asChild variant="subtle" className="h-8 px-3 text-caption gap-1">
                      <Link href={`/teraks/${trk.id}`}>
                        <span>Batafsil</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    {canManage && (
                      <Button
                        variant="ghost"
                        onClick={() => setRestoreTargetId(trk.id)}
                        className="h-8 px-2.5 text-caption gap-1 text-primary hover:text-primary"
                      >
                        <Undo2 className="size-3.5" />
                        <span>{t("teraks_restore", locale)}</span>
                      </Button>
                    )}

                    {canDelete && (
                      <Button
                        variant="ghost"
                        onClick={() => setPermDeleteTargetId(trk.id)}
                        className="h-8 px-2.5 text-caption text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        <span>{t("teraks_permanent_delete", locale)}</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Terak Dialog */}
      <TerakDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        terak={selectedTerak}
        locale={locale}
      />

      {/* Confirm Trash Modal */}
      <ConfirmModal
        open={!!trashTargetId}
        onOpenChange={(open) => !open && setTrashTargetId(null)}
        title={t("teraks_to_trash", locale)}
        message="Haqiqatan ham ushbu terakni savatga tashlamoqchimisiz? (Savatdagi terak ombor va hisobotlarga kirmaydi)"
        confirmLabel={t("action_save", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmTrash}
      />

      {/* Confirm Restore Modal */}
      <ConfirmModal
        open={!!restoreTargetId}
        onOpenChange={(open) => !open && setRestoreTargetId(null)}
        title={t("teraks_restore", locale)}
        message="Ushbu terakni yana faol ro'yxatga qaytarasizmi?"
        confirmLabel={t("teraks_restore", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmRestore}
      />

      {/* Confirm Permanent Delete Modal */}
      <ConfirmModal
        open={!!permDeleteTargetId}
        onOpenChange={(open) => !open && setPermDeleteTargetId(null)}
        title={t("teraks_permanent_delete", locale)}
        message="DIQQAT! Ushbu terak va unga bog'liq barcha ombor hamda xarajatlar bazadan butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi!"
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmPermDelete}
      />
    </div>
  );
}
