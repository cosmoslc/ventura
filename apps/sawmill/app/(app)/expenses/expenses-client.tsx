"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, FolderPlus, Plus, Receipt, Search, Tag, Trash2 } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { Modal } from "@ventura/ui/modal";
import { formatMoney } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { deleteGeneralExpenseAction } from "./actions";
import { CategoryDialog } from "./category-dialog";
import { ExpenseDialog } from "./expense-dialog";

export interface GeneralExpenseItem {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  date: string;
  note: string | null;
  createdAt: Date;
}

interface ExpensesClientProps {
  initialExpenses: GeneralExpenseItem[];
  categories: Array<{ id: string; name: string }>;
  canManage: boolean;
  locale: Locale;
}

export function ExpensesClient({ initialExpenses, categories, canManage, locale }: ExpensesClientProps) {
  const router = useRouter();

  const [expenseDialogOpen, setExpenseDialogOpen] = React.useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [deleteTarget, setDeleteTarget] = React.useState<GeneralExpenseItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Jami summa
  const totalAmount = React.useMemo(() => {
    return initialExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [initialExpenses]);

  // Filtrlash
  const filteredExpenses = React.useMemo(() => {
    return initialExpenses.filter((e) => {
      if (selectedCategoryId !== "all" && e.categoryId !== selectedCategoryId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cat = e.categoryName.toLowerCase();
        const note = (e.note ?? "").toLowerCase();
        if (!cat.includes(q) && !note.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [initialExpenses, selectedCategoryId, searchQuery]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteGeneralExpenseAction(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* 1. Sarlavha va amallar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("expenses_title", locale)}</h1>
          <p className="text-xs text-muted-foreground">{t("expenses_subtitle", locale)}</p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="subtle" onClick={() => setCategoryDialogOpen(true)} className="gap-1.5 cursor-pointer">
              <FolderPlus className="size-4" />
              <span>{t("expenses_category_add", locale)}</span>
            </Button>
            <Button variant="primary" onClick={() => setExpenseDialogOpen(true)} className="gap-1.5 cursor-pointer">
              <Plus className="size-4" />
              <span>{t("expenses_add", locale)}</span>
            </Button>
          </div>
        )}
      </div>

      {/* 2. Statistika kartalari */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("expenses_total", locale)}
            </span>
            <div className="text-lg font-bold text-primary font-mono">{formatMoney(totalAmount)}</div>
            <span className="text-2xs text-muted-foreground">Umumiy foydadan ayriladi (K14)</span>
          </div>
          <div className="size-10 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
            <Receipt className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("expenses_category", locale)}
            </span>
            <div className="text-lg font-bold text-foreground font-mono">{categories.length} ta</div>
            <span className="text-2xs text-muted-foreground">Faol xarajat toifalari</span>
          </div>
          <div className="size-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Tag className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              Xarajatlar soni
            </span>
            <div className="text-lg font-bold text-foreground font-mono">{initialExpenses.length} ta</div>
            <span className="text-2xs text-muted-foreground">Barcha qayd etilgan xarajatlar</span>
          </div>
          <div className="size-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Receipt className="size-5" />
          </div>
        </Card>
      </div>

      {/* 3. Filtrlar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted-foreground">{t("expenses_category", locale)}</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="all">{t("expenses_category_all", locale)}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted-foreground">{t("action_search", locale)}</label>
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Toifa yoki izoh..."
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Jadval */}
      <Card className="overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Receipt className="size-10 mx-auto opacity-30" />
            <p className="text-sm font-semibold">{t("expenses_empty", locale)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">{t("expenses_date", locale)}</th>
                  <th className="py-3 px-4">{t("expenses_category", locale)}</th>
                  <th className="py-3 px-4">{t("expenses_amount", locale)}</th>
                  <th className="py-3 px-4">{t("expenses_note", locale)}</th>
                  {canManage && <th className="py-3 px-4 text-right">Amal</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        <span>{exp.date}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Tag className="size-3 text-primary" />
                        <span>{exp.categoryName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-red-600 dark:text-red-400 whitespace-nowrap text-sm">
                      {formatMoney(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">{exp.note || "-"}</td>
                    {canManage && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          onClick={() => setDeleteTarget(exp)}
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

      {/* Xarajat qo'shish modali */}
      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        categories={categories}
        locale={locale}
      />

      {/* Toifa qo'shish modali */}
      <CategoryDialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen} locale={locale} />

      {/* O'chirish tasdiq modali */}
      {deleteTarget && (
        <Modal
          open={Boolean(deleteTarget)}
          onOpenChange={(op) => !op && setDeleteTarget(null)}
          title={t("expenses_delete_confirm", locale)}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Ushbu umumiy xarajatni o'chirmoqchimisiz?</p>

            <div className="p-3 bg-muted/40 rounded-control space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toifa:</span>
                <span className="font-semibold">{deleteTarget.categoryName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Summa:</span>
                <span className="font-mono font-bold text-red-600">{formatMoney(deleteTarget.amount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {t("action_cancel", locale)}
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? t("status_loading", locale) : t("action_delete", locale)}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
