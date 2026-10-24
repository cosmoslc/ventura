"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit2,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  TreePine,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { Modal } from "@ventura/ui/modal";
import { type OrderStatus } from "@/lib/calc/orders";
import { type Locale, t } from "@/lib/i18n";
import {
  deleteOrderAction,
  markOrderNotifiedAction,
  toggleOrderCompletionAction,
} from "./actions";
import { OrderDialog } from "./order-dialog";

export interface OrderItemView {
  id: string;
  terakId: string;
  terakName: string;
  materialId: string;
  materialName: string;
  materialUnit: string;
  quantity: number;
  stockQuantity: number;
  status: OrderStatus;
  isDueSoon: boolean;
  customerName: string;
  phone: string | null;
  address: string | null;
  dueDate: string | null;
  completedAt: Date | null;
  readyNotifiedAt: Date | null;
  dueNotifiedAt: Date | null;
  volumeM3: number | null;
  volumeTotalM3: number | null;
  createdAt: Date;
}

interface OrdersClientProps {
  initialOrders: OrderItemView[];
  teraks: Array<{ id: string; name: string }>;
  materials: Array<{ id: string; name: string; unit: string }>;
  terakMaterials?: Array<{ terakId: string; materialId: string; quantity: string }>;
  canManage: boolean;
  locale: Locale;
}

export function OrdersClient({
  initialOrders,
  teraks,
  materials,
  terakMaterials = [],
  canManage,
  locale,
}: OrdersClientProps) {
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingOrder, setEditingOrder] = React.useState<OrderItemView | null>(null);

  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "completed">("all");
  const [selectedTerakId, setSelectedTerakId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [deleteTarget, setDeleteTarget] = React.useState<OrderItemView | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Statistika
  const stats = React.useMemo(() => {
    let pendingCount = 0;
    let readyCount = 0;
    let completedCount = 0;

    for (const o of initialOrders) {
      if (o.status === "completed") {
        completedCount++;
      } else if (o.status === "ready") {
        readyCount++;
      } else {
        pendingCount++;
      }
    }

    return {
      total: initialOrders.length,
      pendingCount,
      readyCount,
      completedCount,
    };
  }, [initialOrders]);

  // Diqqat talab zakazlar (bajarilmagan va (tayyor yoki muddati yaqin/o'tgan))
  const attentionOrders = React.useMemo(() => {
    return initialOrders.filter(
      (o) => o.status !== "completed" && (o.status === "ready" || o.isDueSoon),
    );
  }, [initialOrders]);

  // Filtrlash
  const filteredOrders = React.useMemo(() => {
    return initialOrders.filter((o) => {
      if (statusFilter === "active" && o.status === "completed") return false;
      if (statusFilter === "completed" && o.status !== "completed") return false;
      if (selectedTerakId !== "all" && o.terakId !== selectedTerakId) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = o.customerName.toLowerCase();
        const phone = (o.phone ?? "").toLowerCase();
        const mat = o.materialName.toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !mat.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [initialOrders, statusFilter, selectedTerakId, searchQuery]);

  async function handleToggle(orderId: string) {
    if (!canManage) return;
    setTogglingId(orderId);
    await toggleOrderCompletionAction(orderId);
    setTogglingId(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteOrderAction(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleDismissNotification(order: OrderItemView, type: "ready" | "due_soon") {
    await markOrderNotifiedAction(order.id, type);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* 1. Sarlavha va yangi qo'shish */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("orders_title", locale)}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("orders_subtitle", locale)}
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            onClick={() => {
              setEditingOrder(null);
              setDialogOpen(true);
            }}
            className="gap-2 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>{t("orders_add", locale)}</span>
          </Button>
        )}
      </div>

      {/* 2. Diqqat talab zakazlar bloki (agar bor bo'lsa) */}
      {attentionOrders.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="size-4" />
            <span>{t("orders_attention_needed", locale)} ({attentionOrders.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attentionOrders.map((ao) => (
              <div
                key={ao.id}
                className="p-3 bg-card rounded-control border border-border flex items-center justify-between gap-3 text-xs shadow-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground truncate">
                      {ao.customerName}
                    </span>
                    {ao.status === "ready" && (
                      <Badge tone="success" className="text-2xs py-0">
                        {t("orders_status_ready", locale)}
                      </Badge>
                    )}
                    {ao.isDueSoon && (
                      <Badge tone="warning" className="text-2xs py-0">
                        {t("orders_due_soon", locale)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {ao.materialName} — {ao.quantity} {ao.materialUnit} (omborda: {ao.stockQuantity})
                  </div>
                  {ao.dueDate && (
                    <div className="text-2xs text-muted-foreground font-mono">
                      Muddat: {ao.dueDate}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {ao.status === "ready" && !ao.readyNotifiedAt && (
                    <Button
                      variant="ghost"
                      onClick={() => handleDismissNotification(ao, "ready")}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer h-8 px-2"
                    >
                      {t("orders_notification_dismiss", locale)}
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      variant="subtle"
                      onClick={() => handleToggle(ao.id)}
                      className="shrink-0 text-xs gap-1 cursor-pointer h-8 px-2.5"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      <span>{t("orders_toggle_complete", locale)}</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 3. Statistika kartalari */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 space-y-1">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("orders_filter_all", locale)}
          </span>
          <div className="text-xl font-bold text-foreground font-mono">
            {stats.total}
          </div>
        </Card>

        <Card className="p-3.5 space-y-1">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("orders_status_ready", locale)}
          </span>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {stats.readyCount}
          </div>
        </Card>

        <Card className="p-3.5 space-y-1">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("orders_status_pending", locale)}
          </span>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {stats.pendingCount}
          </div>
        </Card>

        <Card className="p-3.5 space-y-1">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("orders_status_completed", locale)}
          </span>
          <div className="text-xl font-bold text-muted-foreground font-mono">
            {stats.completedCount}
          </div>
        </Card>
      </div>

      {/* 4. Filtrlar va Qidiruv */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Status tablari */}
          <div className="flex rounded-control border border-border p-1 bg-muted/40 gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("orders_filter_all", locale)}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("orders_filter_active", locale)}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-all cursor-pointer ${
                statusFilter === "completed"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("orders_filter_completed", locale)}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedTerakId}
              onChange={(e) => setSelectedTerakId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="all">{t("dispatch_filter_terak", locale)}</option>
              {teraks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mijoz yoki telefon..."
                className="pl-8 text-xs h-8 w-full sm:w-48"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Zakazlar jadvali */}
      <Card className="overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <ShoppingCart className="size-10 mx-auto opacity-30" />
            <p className="text-sm font-semibold">{t("orders_empty", locale)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4 w-12 text-center">Holat</th>
                  <th className="py-3 px-4">{t("orders_customer", locale)}</th>
                  <th className="py-3 px-4">{t("work_material", locale)}</th>
                  <th className="py-3 px-4">{t("orders_quantity", locale)}</th>
                  <th className="py-3 px-4">Ombordagi qoldiq</th>
                  <th className="py-3 px-4">{t("work_terak", locale)}</th>
                  <th className="py-3 px-4">{t("orders_due_date", locale)}</th>
                  {canManage && <th className="py-3 px-4 text-right">Amallar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((o) => {
                  const isCompleted = o.status === "completed";
                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isCompleted ? "opacity-60 bg-muted/10" : ""
                      }`}
                    >
                      {/* Holat tugmasi (Checkbox) */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          disabled={!canManage || togglingId === o.id}
                          onClick={() => handleToggle(o.id)}
                          className={`size-6 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                            isCompleted
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border hover:border-primary text-transparent hover:text-muted-foreground"
                          }`}
                        >
                          <CheckCircle2 className="size-4" />
                        </button>
                      </td>

                      {/* Mijoz */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className={`font-semibold text-foreground ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                            {o.customerName}
                          </div>
                          {o.phone && (
                            <div className="flex items-center gap-1 text-2xs text-muted-foreground font-mono">
                              <Phone className="size-2.5" />
                              <span>{o.phone}</span>
                            </div>
                          )}
                          {o.address && (
                            <div className="text-2xs text-muted-foreground truncate max-w-xs">
                              {o.address}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Material */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-foreground">
                          {o.materialName}
                        </span>
                      </td>

                      {/* Miqdor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-foreground">
                          {o.quantity} {o.materialUnit}
                        </span>
                      </td>

                      {/* Qoldiq va tayyorlik */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {o.stockQuantity} {o.materialUnit}
                          </span>
                          {!isCompleted && (
                            o.status === "ready" ? (
                              <Badge tone="success" className="text-2xs py-0">
                                {t("orders_status_ready", locale)}
                              </Badge>
                            ) : (
                              <Badge tone="neutral" className="text-2xs py-0">
                                {t("orders_status_pending", locale)}
                              </Badge>
                            )
                          )}
                        </div>
                      </td>

                      {/* Terak */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <TreePine className="size-3 text-primary" />
                          <span>{o.terakName}</span>
                        </div>
                      </td>

                      {/* Muddat */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {o.dueDate ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-mono text-xs">
                              <Calendar className="size-3 text-muted-foreground" />
                              <span>{o.dueDate}</span>
                            </div>
                            {!isCompleted && o.isDueSoon && (
                              <Badge tone="warning" className="text-2xs py-0">
                                {t("orders_due_soon", locale)}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-2xs text-muted-foreground italic">-</span>
                        )}
                      </td>

                      {/* Amallar */}
                      {canManage && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingOrder(o);
                                setDialogOpen(true);
                              }}
                              className="size-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setDeleteTarget(o)}
                              className="size-8 p-0 text-red-500 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Zakaz qo'shish / tahrirlash modali */}
      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teraks={teraks}
        materials={materials}
        terakMaterials={terakMaterials}
        initialOrder={editingOrder}
        locale={locale}
      />

      {/* O'chirish tasdiq modali */}
      {deleteTarget && (
        <Modal
          open={Boolean(deleteTarget)}
          onOpenChange={(op) => !op && setDeleteTarget(null)}
          title={t("orders_delete_confirm", locale)}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ushbu zakazni ro'yxatdan o'chirmoqchimisiz?
            </p>

            <div className="p-3 bg-muted/40 rounded-control space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mijoz:</span>
                <span className="font-semibold">{deleteTarget.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material:</span>
                <span className="font-semibold">
                  {deleteTarget.materialName} ({deleteTarget.quantity}{" "}
                  {deleteTarget.materialUnit})
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
