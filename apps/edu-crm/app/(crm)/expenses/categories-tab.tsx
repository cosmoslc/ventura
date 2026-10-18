"use client";

import { Check, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { FilterBar, FilterSearch } from "@ventura/ui/filter-bar";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { EmptyState } from "@ventura/ui/page-header";
import { Switch } from "@ventura/ui/switch";
import { toast } from "@ventura/ui/toast";
import type { CategoryRow } from "@/lib/server/expenses";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { deleteCategoryAction, saveCategoryAction } from "./actions";

const t = uz.expenses;
type Kind = CategoryRow["kind"];

export function CategoriesTab({
  categories,
  branches,
  canAllBranches,
  canEdit,
}: {
  categories: CategoryRow[];
  branches: PickerBranch[];
  canAllBranches: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [form, setForm] = React.useState<{ kind: Kind; editing: CategoryRow | null } | null>(null);
  const [toDelete, setToDelete] = React.useState<CategoryRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const q = query.trim().toLowerCase();
  const branchNames = (ids: string[] | null) =>
    ids
      ? branches
          .filter((b) => ids.includes(b.id))
          .map((b) => b.name)
          .join(", ")
      : t.allBranches;
  /** Filial cheklovi bor xodim "barcha filiallar" toifasini o'zgartira olmaydi (server ham tekshiradi) */
  const manageable = (c: CategoryRow) => canEdit && (canAllBranches || !!c.branchIds);

  function toggle(c: CategoryRow, active: boolean) {
    startTransition(async () => {
      const res = await saveCategoryAction({
        id: c.id,
        kind: c.kind,
        name: c.name,
        branchIds: c.branchIds ?? [],
        active,
      });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.categorySaved, description: c.name });
      router.refresh();
    });
  }

  function remove(c: CategoryRow) {
    startTransition(async () => {
      const res = await deleteCategoryAction(c.id);
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.categoryDeleted, description: c.name });
      router.refresh();
    });
  }

  const section = (kind: Kind, title: string) => {
    const list = categories.filter((c) => c.kind === kind && (!q || c.name.toLowerCase().includes(q)));
    return (
      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="type-heading text-base">{title}</h2>
          {canEdit ? (
            <Button size="sm" onClick={() => setForm({ kind, editing: null })}>
              <Plus /> {t.addCategory}
            </Button>
          ) : null}
        </div>
        {list.length ? (
          <ul className="divide-y divide-border">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className={c.active ? "font-medium text-foreground" : "text-muted-foreground line-through"}>
                    {c.name}
                  </div>
                  <div className="text-caption text-muted-foreground">
                    {branches.length > 1 ? `${branchNames(c.branchIds)} · ` : ""}
                    {t.categoryUsage(c.usage)}
                  </div>
                </div>
                <Switch
                  checked={c.active}
                  disabled={!manageable(c) || pending}
                  onCheckedChange={(v) => toggle(c, v)}
                  aria-label={`${c.name}: ${t.categoryActive}`}
                />
                {manageable(c) ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="icon"
                      size="icon-sm"
                      title={uz.common.edit}
                      aria-label={`${c.name} — ${uz.common.edit}`}
                      onClick={() => setForm({ kind, editing: c })}
                    >
                      <Pencil />
                    </Button>
                    {c.usage === 0 ? (
                      <Button
                        variant="icon"
                        size="icon-sm"
                        className="text-destructive-text"
                        title={uz.common.delete}
                        aria-label={`${c.name} — ${uz.common.delete}`}
                        onClick={() => setToDelete(c)}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Tags />} title={t.categoriesEmpty} />
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-section">
      <FilterBar standalone>
        <FilterSearch placeholder={t.categoriesSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
      </FilterBar>
      <div className="grid gap-4 lg:grid-cols-2">
        {section("expense", t.expenseCategories)}
        {section("income", t.incomeCategories)}
      </div>

      {canEdit ? (
        <CategoryForm
          state={form}
          onClose={() => setForm(null)}
          branches={branches}
          canAllBranches={canAllBranches}
          onSaved={() => router.refresh()}
        />
      ) : null}
      <ConfirmModal
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t.categoryDeleteTitle}
        message={toDelete ? t.categoryDeleteMessage(toDelete.name) : ""}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toDelete && remove(toDelete)}
      />
    </div>
  );
}

function CategoryForm({
  state,
  onClose,
  branches,
  canAllBranches,
  onSaved,
}: {
  state: { kind: Kind; editing: CategoryRow | null } | null;
  onClose: () => void;
  branches: PickerBranch[];
  canAllBranches: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [all, setAll] = React.useState(true);
  const [branchIds, setBranchIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const editing = state?.editing ?? null;
  const key = state ? (editing?.id ?? `new-${state.kind}`) : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (state) {
      setName(editing?.name ?? "");
      const scoped = editing ? editing.branchIds : canAllBranches ? null : branches.map((b) => b.id);
      setAll(scoped === null);
      setBranchIds(scoped ?? []);
      setError(null);
    }
  }

  function toggleBranch(id: string, on: boolean) {
    const next = on ? [...branchIds, id] : branchIds.filter((x) => x !== id);
    setBranchIds(next);
    setAll(next.length === 0 && canAllBranches);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!state) return;
    if (!name.trim()) return setError(t.categoryNameRequired);
    if (!all && !branchIds.length) return setError(uz.common.branchRequired);
    startTransition(async () => {
      const res = await saveCategoryAction({
        id: editing?.id,
        kind: state.kind,
        name,
        branchIds: all ? [] : branchIds,
        active: editing?.active ?? true,
      });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onClose();
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.categorySaved, description: name.trim() });
      onClose();
      onSaved();
    });
  }

  return (
    <Modal
      open={!!state}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={editing ? t.categoryFormEdit : t.categoryFormNew}
      description={state ? (state.kind === "expense" ? t.expenseCategories : t.incomeCategories) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="category-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : t.addCategory}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="category-name">{t.categoryName} *</Label>
          <Input
            id="category-name"
            autoFocus
            maxLength={60}
            placeholder={t.categoryNamePlaceholder}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>
        {branches.length > 1 || !canAllBranches ? (
          <div>
            <Label>{t.categoryBranches} *</Label>
            <div className="grid gap-2.5 rounded-control border border-border-soft p-3 sm:grid-cols-2">
              {canAllBranches ? (
                <ChoiceField
                  label={t.allBranches}
                  control={
                    <Checkbox
                      checked={all}
                      onCheckedChange={(v) => {
                        setAll(v === true);
                        if (v === true) setBranchIds([]);
                      }}
                    />
                  }
                />
              ) : null}
              {branches.map((b) => (
                <ChoiceField
                  key={b.id}
                  label={b.name}
                  control={
                    <Checkbox
                      checked={!all && branchIds.includes(b.id)}
                      onCheckedChange={(v) => {
                        if (all) setAll(false);
                        toggleBranch(b.id, v === true);
                      }}
                    />
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
