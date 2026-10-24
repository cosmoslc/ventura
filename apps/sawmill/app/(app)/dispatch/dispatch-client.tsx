"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Layers,
  Phone,
  Plus,
  Search,
  Trash2,
  TreePine,
  Truck,
  User,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { Modal } from "@ventura/ui/modal";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { deleteDispatchAction } from "./actions";
import { DispatchDialog } from "./dispatch-dialog";

export interface DispatchItemView {
  id: string;
  terakId: string;
  terakName: string;
  materialId: string;
  materialName: string;
  materialUnit: string;
  quantity: number;
  enteredUnit: string;
  enteredQty: number;
  totalAmount: number;
  date: string;
  recipientName: string | null;
  phone: string | null;
  address: string | null;
  truckId: string | null;
  truckName: string | null;
  volumeM3: number | null;
  volumeTotalM3: number | null;
  createdAt: Date;
}

interface DispatchClientProps {
  initialDispatches: DispatchItemView[];
  teraks: Array<{ id: string; name: string }>;
  materials: Array<{
    id: string;
    name: string;
    unit: string;
    thicknessCm?: number | null;
    widthCm?: number | null;
    lengthCm?: number | null;
  }>;
  terakMaterials: Array<{
    terakId: string;
    materialId: string;
    quantity: string;
    sellingPrice: number;
    cubePrice: number;
  }>;
  trucks: Array<{ id: string; name: string; amount: number }>;
  canManage: boolean;
  canDelete: boolean;
  locale: Locale;
}

export function DispatchClient({
  initialDispatches,
  teraks,
  materials,
  terakMaterials,
  trucks,
  canManage,
  canDelete,
  locale,
}: DispatchClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dialogOpen, setDialogOpen] = React.useState(
    () => searchParams.get("action") === "new" && canManage,
  );
  const [selectedTerakId, setSelectedTerakId] = React.useState<string>("all");
  const [selectedMaterialId, setSelectedMaterialId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [deleteTarget, setDeleteTarget] = React.useState<DispatchItemView | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Bugungi sana
  const todayStr = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Statistika
  const stats = React.useMemo(() => {
    const todayDispatches = initialDispatches.filter((d) => d.date === todayStr);
    const todayTotal = todayDispatches.reduce((acc, d) => acc + d.totalAmount, 0);
    const allTotal = initialDispatches.reduce((acc, d) => acc + d.totalAmount, 0);
    return {
      totalCount: initialDispatches.length,
      todayCount: todayDispatches.length,
      todayTotal,
      allTotal,
    };
  }, [initialDispatches, todayStr]);

  // Filtrlash
  const filteredDispatches = React.useMemo(() => {
    return initialDispatches.filter((d) => {
      if (selectedTerakId !== "all" && d.terakId !== selectedTerakId) {
        return false;
      }
      if (selectedMaterialId !== "all" && d.materialId !== selectedMaterialId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const recipient = (d.recipientName ?? "").toLowerCase();
        const phone = (d.phone ?? "").toLowerCase();
        const truck = (d.truckName ?? "").toLowerCase();
        if (!recipient.includes(q) && !phone.includes(q) && !truck.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [initialDispatches, selectedTerakId, selectedMaterialId, searchQuery]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteDispatchAction(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* 1. Yuqori qism: sarlavha va yangi qo'shish tugmasi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("dispatch_title", locale)}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("dispatch_subtitle", locale)}
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            onClick={() => setDialogOpen(true)}
            className="gap-2 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>{t("dispatch_add", locale)}</span>
          </Button>
        )}
      </div>

      {/* 2. Statistika kartalari */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("dispatch_today_total", locale)}
            </span>
            <div className="text-lg font-bold text-foreground font-mono">
              {formatMoney(stats.todayTotal)}
            </div>
            <span className="text-2xs text-muted-foreground">
              {stats.todayCount} ta operatsiya
            </span>
          </div>
          <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Truck className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("dispatch_total_revenue", locale)}
            </span>
            <div className="text-lg font-bold text-primary font-mono">
              {formatMoney(stats.allTotal)}
            </div>
            <span className="text-2xs text-muted-foreground">
              Jami {stats.totalCount} ta yuk chiqarilgan
            </span>
          </div>
          <div className="size-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Layers className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("nav_teraks", locale)}
            </span>
            <div className="text-lg font-bold text-foreground font-mono">
              {teraks.length} ta
            </div>
            <span className="text-2xs text-muted-foreground">
              Omborida mahsulot mavjud
            </span>
          </div>
          <div className="size-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <TreePine className="size-5" />
          </div>
        </Card>
      </div>

      {/* 3. Filtrlar va qidiruv */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted-foreground">
              {t("work_terak", locale)}
            </label>
            <select
              value={selectedTerakId}
              onChange={(e) => setSelectedTerakId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="all">{t("dispatch_filter_terak", locale)}</option>
              {teraks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted-foreground">
              {t("work_material", locale)}
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="all">{t("dispatch_filter_material", locale)}</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted-foreground">
              Qidiruv (Mijoz / Telefon / Mashina)
            </label>
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ism yoki raqam..."
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Jadval / Ro'yxat */}
      <Card className="overflow-hidden">
        {filteredDispatches.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Truck className="size-10 mx-auto opacity-30" />
            <p className="text-sm font-semibold">{t("dispatch_empty", locale)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">{t("dispatch_date", locale)}</th>
                  <th className="py-3 px-4">{t("work_terak", locale)}</th>
                  <th className="py-3 px-4">{t("work_material", locale)}</th>
                  <th className="py-3 px-4">{t("dispatch_quantity", locale)}</th>
                  <th className="py-3 px-4">{t("dispatch_total", locale)}</th>
                  <th className="py-3 px-4">{t("dispatch_recipient", locale)}</th>
                  <th className="py-3 px-4">{t("dispatch_truck", locale)}</th>
                  {canDelete && <th className="py-3 px-4 text-right">Amal</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    {/* Sana */}
                    <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        <span>{d.date}</span>
                      </div>
                    </td>

                    {/* Terak */}
                    <td className="py-3 px-4 font-semibold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <TreePine className="size-3.5 text-primary" />
                        <span>{d.terakName}</span>
                      </div>
                    </td>

                    {/* Material */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-foreground">
                        {d.materialName}
                      </div>
                      {d.enteredUnit === "cube" && (
                        <span className="text-2xs text-muted-foreground">
                          Kiritilgan: {d.enteredQty} m³
                        </span>
                      )}
                    </td>

                    {/* Miqdor */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-foreground">
                        {d.quantity} {d.materialUnit}
                      </div>
                      {d.volumeTotalM3 && (
                        <div className="text-2xs text-muted-foreground font-mono">
                          {d.volumeTotalM3} m³
                        </div>
                      )}
                    </td>

                    {/* Summa */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-primary text-sm">
                        {formatMoney(d.totalAmount)}
                      </span>
                    </td>

                    {/* Mijoz */}
                    <td className="py-3 px-4">
                      {d.recipientName ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-semibold text-foreground">
                            <User className="size-3 text-muted-foreground" />
                            <span>{d.recipientName}</span>
                          </div>
                          {d.phone && (
                            <div className="flex items-center gap-1 text-2xs text-muted-foreground font-mono">
                              <Phone className="size-2.5" />
                              <span>{d.phone}</span>
                            </div>
                          )}
                          {d.address && (
                            <div className="text-2xs text-muted-foreground truncate max-w-xs">
                              {d.address}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-2xs">
                          Ko'rsatilmagan
                        </span>
                      )}
                    </td>

                    {/* Mashina */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {d.truckName ? (
                        <Badge tone="info" className="gap-1">
                          <Truck className="size-3" />
                          <span>{d.truckName}</span>
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-2xs">-</span>
                      )}
                    </td>

                    {/* O'chirish */}
                    {canDelete && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          onClick={() => setDeleteTarget(d)}
                          className="size-8 p-0 text-red-500 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Yuk chiqarish modali */}
      <DispatchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teraks={teraks}
        materials={materials}
        terakMaterials={terakMaterials}
        trucks={trucks}
        locale={locale}
      />

      {/* O'chirish tasdiq modali */}
      {deleteTarget && (
        <Modal
          open={Boolean(deleteTarget)}
          onOpenChange={(op) => !op && setDeleteTarget(null)}
          title="Yuk chiqarishni bekor qilish"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("dispatch_delete_confirm", locale)}
            </p>

            <div className="p-3 bg-muted/40 rounded-control space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Terak:</span>
                <span className="font-semibold">{deleteTarget.terakName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material:</span>
                <span className="font-semibold">
                  {deleteTarget.materialName} ({deleteTarget.quantity}{" "}
                  {deleteTarget.materialUnit})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Summa:</span>
                <span className="font-mono font-bold text-primary">
                  {formatMoney(deleteTarget.totalAmount)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                {t("action_cancel", locale)}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? t("status_loading", locale) : t("action_delete", locale)}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
