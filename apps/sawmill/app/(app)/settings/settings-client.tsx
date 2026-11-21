"use client";

import * as React from "react";
import { Check, Plus, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { type Locale, t } from "@/lib/i18n";
import type { SawmillSettings } from "@/lib/settings/schema";
import { createWorkTypeAction, deleteWorkTypeAction, saveGeneralSettingsAction } from "./actions";

interface WorkTypeItem {
  id: string;
  name: string;
  kind: "regular" | "sorting";
  isSystem: boolean;
}

interface SettingsClientProps {
  initialSettings: SawmillSettings;
  workTypes: WorkTypeItem[];
  canManage: boolean;
  locale: Locale;
}

export function SettingsClient({ initialSettings, workTypes, canManage, locale }: SettingsClientProps) {
  // General settings state
  const [profitMode, setProfitMode] = React.useState(initialSettings.profitMode);
  const [qtyDisplay, setQtyDisplay] = React.useState(initialSettings.qtyDisplay);
  const [cubeInputMode, setCubeInputMode] = React.useState(initialSettings.cubeInputMode);
  const [dimensionUnit, setDimensionUnit] = React.useState(initialSettings.dimensionUnit);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);

  // Work type dialog
  const [workTypeModalOpen, setWorkTypeModalOpen] = React.useState(false);
  const [newTypeName, setNewTypeName] = React.useState("");
  const [newTypeKind, setNewTypeKind] = React.useState<"regular" | "sorting">("regular");
  const [savingWorkType, setSavingWorkType] = React.useState(false);
  const [workTypeError, setWorkTypeError] = React.useState<string | null>(null);

  // Delete work type modal
  const [deleteWorkTypeId, setDeleteWorkTypeId] = React.useState<string | null>(null);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);
    setSettingsError(null);

    const formData = new FormData();
    formData.append("profitMode", profitMode);
    formData.append("qtyDisplay", qtyDisplay);
    formData.append("cubeInputMode", cubeInputMode);
    formData.append("dimensionUnit", dimensionUnit);

    const res = await saveGeneralSettingsAction(formData);
    setSavingSettings(false);

    if (!res.ok) {
      setSettingsError(res.error ?? t("status_error", locale));
      return;
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  async function handleCreateWorkType(e: React.FormEvent) {
    e.preventDefault();
    setSavingWorkType(true);
    setWorkTypeError(null);

    const formData = new FormData();
    formData.append("name", newTypeName);
    formData.append("kind", newTypeKind);

    const res = await createWorkTypeAction(formData);
    setSavingWorkType(false);

    if (!res.ok) {
      setWorkTypeError(res.error ?? t("status_error", locale));
      return;
    }

    setNewTypeName("");
    setNewTypeKind("regular");
    setWorkTypeModalOpen(false);
  }

  async function handleConfirmDeleteWorkType() {
    if (!deleteWorkTypeId) return;
    await deleteWorkTypeAction(deleteWorkTypeId);
    setDeleteWorkTypeId(null);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("settings_title", locale)}</h1>
        <p className="text-caption text-muted-foreground mt-0.5">{t("settings_subtitle", locale)}</p>
      </div>

      {/* 1. Umumiy hisoblash sozlamalari */}
      <Card className="p-6">
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <div className="size-8 rounded-btn bg-primary/10 text-primary flex items-center justify-center">
              <Settings2 className="size-4" />
            </div>
            <div>
              <h2 className="text-body font-bold text-foreground">Hisoblash parametrlari</h2>
              <p className="text-2xs text-muted-foreground">O'lcham birligi, foyda va kub hisoblash usullari</p>
            </div>
          </div>

          {settingsError && (
            <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
              {settingsError}
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 text-caption text-success-fg bg-success-bg border border-success-border rounded-btn flex items-center gap-2">
              <Check className="size-4" />
              <span>{t("settings_save_success", locale)}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* O'lcham birligi */}
            <div className="space-y-1.5">
              <Label>{t("settings_dimension_unit", locale)}</Label>
              <select
                value={dimensionUnit}
                onChange={(e) => setDimensionUnit(e.target.value as "mm" | "sm" | "m")}
                disabled={!canManage}
                className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="mm">{t("unit_mm", locale)}</option>
                <option value="sm">{t("unit_sm", locale)}</option>
                <option value="m">{t("unit_m", locale)}</option>
              </select>
              <span className="text-2xs text-muted-foreground block">
                Foydalanuvchi kiritishi uchun (bazada doim santimetr saqlanadi).
              </span>
            </div>

            {/* Foyda hisoblash usuli */}
            <div className="space-y-1.5">
              <Label>{t("settings_profit_mode", locale)}</Label>
              <select
                value={profitMode}
                onChange={(e) => setProfitMode(e.target.value as "estimated" | "actual")}
                disabled={!canManage}
                className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="estimated">{t("profit_estimated", locale)}</option>
                <option value="actual">{t("profit_actual", locale)}</option>
              </select>
              <span className="text-2xs text-muted-foreground block">
                Bosh sahifa va teraklar ro'yxatida foyda qanday hisoblanishi.
              </span>
            </div>

            {/* Miqdor ko'rinishi */}
            <div className="space-y-1.5">
              <Label>{t("settings_qty_display", locale)}</Label>
              <select
                value={qtyDisplay}
                onChange={(e) => setQtyDisplay(e.target.value as "piece" | "cube" | "both")}
                disabled={!canManage}
                className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="piece">{t("qty_piece", locale)}</option>
                <option value="cube">{t("qty_cube", locale)}</option>
                <option value="both">{t("qty_both", locale)}</option>
              </select>
              <span className="text-2xs text-muted-foreground block">
                Ombor va hisobotlarda material miqdori qanday aks etishi.
              </span>
            </div>

            {/* Kub kiritish usuli */}
            <div className="space-y-1.5">
              <Label>{t("settings_cube_input_mode", locale)}</Label>
              <select
                value={cubeInputMode}
                onChange={(e) => setCubeInputMode(e.target.value as "direct" | "calculated")}
                disabled={!canManage}
                className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="direct">{t("cube_direct", locale)}</option>
                <option value="calculated">{t("cube_calculated", locale)}</option>
              </select>
              <span className="text-2xs text-muted-foreground block">Ish qo'shishda kub metr qanday kiritilishi.</span>
            </div>
          </div>

          {canManage && (
            <div className="flex justify-end pt-3 border-t border-border">
              <Button type="submit" disabled={savingSettings}>
                {savingSettings ? t("status_loading", locale) : t("action_save", locale)}
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* 2. Ish turlari boshqaruvi */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-body font-bold text-foreground">{t("settings_work_types", locale)}</h2>
            <p className="text-2xs text-muted-foreground">Ish haqi hisoblash uchun sex ish turlari ro'yxati</p>
          </div>
          {canManage && (
            <Button
              variant="subtle"
              onClick={() => setWorkTypeModalOpen(true)}
              className="gap-1.5 h-8 px-3 text-caption"
            >
              <Plus className="size-3.5" />
              <span>{t("settings_add_work_type", locale)}</span>
            </Button>
          )}
        </div>

        <div className="divide-y divide-border pt-2">
          {workTypes.map((wt) => (
            <div key={wt.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-body font-semibold text-foreground">{wt.name}</span>
                <Badge tone={wt.kind === "sorting" ? "warning" : "neutral"}>
                  {wt.kind === "sorting" ? t("work_kind_sorting", locale) : t("work_kind_regular", locale)}
                </Badge>
                {wt.isSystem && (
                  <span className="text-2xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                    Standart
                  </span>
                )}
              </div>

              {!wt.isSystem && canManage && (
                <button
                  type="button"
                  onClick={() => setDeleteWorkTypeId(wt.id)}
                  className="p-1.5 rounded-btn text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  title={t("action_delete", locale)}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Add Work Type Modal */}
      <Modal
        open={workTypeModalOpen}
        onOpenChange={setWorkTypeModalOpen}
        title={t("settings_add_work_type", locale)}
        position="center"
      >
        <form onSubmit={handleCreateWorkType} className="space-y-4 pt-2">
          {workTypeError && (
            <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
              {workTypeError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="worktype-name">{t("settings_work_type_name", locale)} *</Label>
            <Input
              id="worktype-name"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="Maydalash"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="worktype-kind">{t("settings_work_type_kind", locale)}</Label>
            <select
              id="worktype-kind"
              value={newTypeKind}
              onChange={(e) => setNewTypeKind(e.target.value as "regular" | "sorting")}
              className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="regular">{t("work_kind_regular", locale)}</option>
              <option value="sorting">{t("work_kind_sorting", locale)}</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setWorkTypeModalOpen(false)} disabled={savingWorkType}>
              {t("action_cancel", locale)}
            </Button>
            <Button type="submit" disabled={savingWorkType}>
              {savingWorkType ? t("status_loading", locale) : t("action_save", locale)}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Work Type Modal */}
      <ConfirmModal
        open={!!deleteWorkTypeId}
        onOpenChange={(open) => !open && setDeleteWorkTypeId(null)}
        title={t("action_delete", locale)}
        message="Haqiqatan ham ushbu ish turini o'chirmoqchimisiz?"
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmDeleteWorkType}
      />
    </div>
  );
}
