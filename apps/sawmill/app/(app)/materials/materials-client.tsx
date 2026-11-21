"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Edit2, Layers, Plus, Trash2 } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { pieceVolumeM3, type DimensionUnit } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { deleteMaterialSizeAction, toggleArchiveMaterialAction } from "./actions";
import { AddSizeDialog } from "./add-size-dialog";
import { type MaterialData, MaterialDialog } from "./material-dialog";

interface SizeItem {
  id: string;
  thicknessCm: string;
  widthCm: string;
  lengthCm: string;
}

interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  pricingMode: "piece" | "row";
  thicknessCm: string | null;
  widthCm: string | null;
  lengthCm: string | null;
  archivedAt: Date | null;
  sizes: SizeItem[];
  volumeM3: number | null;
}

interface MaterialsClientProps {
  activeMaterials: MaterialItem[];
  archivedMaterials: MaterialItem[];
  defaultUnit: DimensionUnit;
  canManage: boolean;
  locale: Locale;
}

export function MaterialsClient({
  activeMaterials,
  archivedMaterials,
  defaultUnit,
  canManage,
  locale,
}: MaterialsClientProps) {
  const [tab, setTab] = React.useState<"active" | "archived">("active");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedMaterial, setSelectedMaterial] = React.useState<MaterialData | null>(null);

  // Add Size modal
  const [sizeDialogOpen, setSizeDialogOpen] = React.useState(false);
  const [sizeTargetMaterial, setSizeTargetMaterial] = React.useState<{ id: string; name: string } | null>(null);

  // Confirm delete size
  const [deleteSizeId, setDeleteSizeId] = React.useState<string | null>(null);

  // Confirm archive material
  const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(null);

  const list = tab === "active" ? activeMaterials : archivedMaterials;

  function handleAdd() {
    setSelectedMaterial(null);
    setDialogOpen(true);
  }

  function handleEdit(m: MaterialItem) {
    setSelectedMaterial({
      id: m.id,
      name: m.name,
      unit: m.unit,
      pricingMode: m.pricingMode,
      thicknessCm: m.thicknessCm,
      widthCm: m.widthCm,
      lengthCm: m.lengthCm,
    });
    setDialogOpen(true);
  }

  function handleOpenAddSize(m: MaterialItem) {
    setSizeTargetMaterial({ id: m.id, name: m.name });
    setSizeDialogOpen(true);
  }

  async function handleConfirmArchive() {
    if (!archiveTargetId) return;
    await toggleArchiveMaterialAction(archiveTargetId);
    setArchiveTargetId(null);
  }

  async function handleConfirmDeleteSize() {
    if (!deleteSizeId) return;
    await deleteMaterialSizeAction(deleteSizeId);
    setDeleteSizeId(null);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("materials_title", locale)}</h1>
          <p className="text-caption text-muted-foreground mt-0.5">{t("materials_subtitle", locale)}</p>
        </div>

        {canManage && (
          <Button onClick={handleAdd} className="gap-2 shrink-0">
            <Plus className="size-4" />
            <span>{t("materials_add", locale)}</span>
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
          {t("workers_active", locale)} ({activeMaterials.length})
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
          {t("workers_archived", locale)} ({archivedMaterials.length})
        </button>
      </div>

      {/* Materials List */}
      {list.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <div className="size-12 rounded-btn bg-muted flex items-center justify-center mx-auto mb-3">
            <Layers className="size-6 text-muted-foreground" />
          </div>
          <p className="text-body font-medium">{t("materials_empty", locale)}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((m) => (
            <Card key={m.id} className="p-5 flex flex-col justify-between hover:border-border-soft transition-all">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-foreground">{m.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-caption text-muted-foreground font-medium">
                        Birlik: <strong className="text-foreground">{m.unit}</strong>
                      </span>
                      <span>•</span>
                      <Badge tone={m.pricingMode === "piece" ? "info" : "warning"}>
                        {m.pricingMode === "piece" ? t("pricing_piece", locale) : t("pricing_row", locale)}
                      </Badge>
                    </div>
                  </div>

                  {m.volumeM3 !== null && (
                    <div className="text-right">
                      <span className="text-2xs text-muted-foreground uppercase font-semibold">1 dona</span>
                      <p className="text-caption font-bold text-primary font-mono">{m.volumeM3} m³</p>
                    </div>
                  )}
                </div>

                {/* Asosiy o'lcham */}
                {m.thicknessCm && m.widthCm && m.lengthCm && (
                  <div className="p-2.5 rounded-btn bg-muted/60 text-caption font-mono text-foreground flex items-center justify-between">
                    <span className="text-muted-foreground font-sans text-2xs">Asosiy o'lcham:</span>
                    <span>
                      {m.thicknessCm} × {m.widthCm} × {m.lengthCm} sm
                    </span>
                  </div>
                )}

                {/* Variant o'lchamlar ro'yxati */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-2xs font-bold text-muted-foreground uppercase">
                    <span>
                      {t("materials_sizes", locale)} ({m.sizes.length})
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddSize(m)}
                        className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <Plus className="size-3" />
                        <span>{t("materials_add_size", locale)}</span>
                      </button>
                    )}
                  </div>

                  {m.sizes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.sizes.map((s) => {
                        const sVol = pieceVolumeM3({
                          thicknessCm: Number(s.thicknessCm),
                          widthCm: Number(s.widthCm),
                          lengthCm: Number(s.lengthCm),
                        });
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-control bg-card border border-border text-caption font-mono"
                          >
                            <span>
                              {s.thicknessCm}×{s.widthCm}×{s.lengthCm} sm
                            </span>
                            {sVol !== null && (
                              <span className="text-2xs text-muted-foreground font-sans">({sVol} m³)</span>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => setDeleteSizeId(s.id)}
                                className="p-0.5 text-muted-foreground hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-2xs text-muted-foreground italic">Qo'shimcha variantlar yo'q</p>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="flex items-center justify-end gap-1.5 pt-3 mt-4 border-t border-border">
                  <Button variant="ghost" onClick={() => handleEdit(m)} className="h-8 px-2.5 text-caption">
                    <Edit2 className="size-3.5 mr-1" />
                    {t("action_edit", locale)}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setArchiveTargetId(m.id)}
                    className="h-8 px-2.5 text-caption text-muted-foreground hover:text-destructive"
                  >
                    {m.archivedAt ? (
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

      {/* Edit / Create Material Dialog */}
      <MaterialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        material={selectedMaterial}
        defaultUnit={defaultUnit}
        locale={locale}
      />

      {/* Add Size Dialog */}
      <AddSizeDialog
        open={sizeDialogOpen}
        onOpenChange={setSizeDialogOpen}
        materialId={sizeTargetMaterial?.id ?? null}
        materialName={sizeTargetMaterial?.name ?? ""}
        defaultUnit={defaultUnit}
        locale={locale}
      />

      {/* Confirm Archive Modal */}
      <ConfirmModal
        open={!!archiveTargetId}
        onOpenChange={(open) => !open && setArchiveTargetId(null)}
        title={t("workers_archive_action", locale)}
        message="Haqiqatan ham ushbu materialni arxivlamoqchimisiz?"
        confirmLabel={t("action_save", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmArchive}
      />

      {/* Confirm Delete Size Modal */}
      <ConfirmModal
        open={!!deleteSizeId}
        onOpenChange={(open) => !open && setDeleteSizeId(null)}
        title="O'lchamni o'chirish"
        message="Haqiqatan ham ushbu o'lcham variantini o'chirmoqchimisiz?"
        confirmLabel={t("action_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmDeleteSize}
      />
    </div>
  );
}
