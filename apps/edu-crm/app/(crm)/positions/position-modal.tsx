"use client";

import { Check, Plus, Search } from "lucide-react";
import * as React from "react";
import { PERMISSION_CATEGORIES, POSITION_TEMPLATES, normalizePermissions } from "@ventura/auth/staff/policy";
import { Button } from "@ventura/ui/button";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { ColorSwatches } from "@ventura/ui/color-swatches";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { POSITION_COLORS } from "@/lib/palette";
import { uz } from "@/lib/uz";
import { savePositionAction } from "./actions";
import type { PositionRow } from "./data";

// Bosh Direktor shabloni — tizim lavozimi, undan nusxa faqat "Barchasini Tanlash" orqali
const TEMPLATES = POSITION_TEMPLATES.filter((t) => !t.system);

export function PositionModal({
  open,
  editing,
  grantable,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: PositionRow | null;
  /** null — hamma ruxsatni bera oladi (direktor) */
  grantable: string[] | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(POSITION_COLORS[0]!.value);
  const [perms, setPerms] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const [template, setTemplate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = open ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setName(editing?.name ?? "");
      setColor(editing?.color ?? POSITION_COLORS[0]!.value);
      setPerms(editing?.permissions ?? []);
      setQuery("");
      setTemplate("");
      setError(null);
    }
  }

  // Tahrirda lavozimda allaqachon bor ruxsat olib tashlanishi mumkin, yangisi esa faqat xodimda bo'lsa
  const canGrant = (p: string) => grantable === null || grantable.includes(p) || !!editing?.permissions.includes(p);
  const grantableAll = PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => p.id)).filter(canGrant);

  const update = (next: string[]) => {
    setPerms(normalizePermissions(next));
    setError(null);
  };
  const toggle = (id: string, on: boolean) => update(on ? [...perms, id] : perms.filter((p) => p !== id));

  function applyTemplate(code: string) {
    const t = TEMPLATES.find((x) => x.code === code);
    if (!t) return;
    setTemplate(code);
    update(t.permissions.filter(canGrant));
    if (!name.trim()) setName(t.name);
    setColor(t.color);
    toast({ tone: "info", title: uz.positions.templateApplied(t.name) });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError(uz.positions.nameRequired);
    startTransition(async () => {
      const res = await savePositionAction({ id: editing?.id, name: trimmed, color, permissions: perms });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? uz.positions.saved(trimmed) : uz.positions.created(trimmed) });
      onOpenChange(false);
      onSaved(res.id);
    });
  }

  const q = query.trim().toLowerCase();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      wide
      title={editing ? uz.positions.modalEdit : uz.positions.modalNew}
      footer={
        <>
          <span className="mr-auto text-body font-semibold text-muted-foreground">
            {uz.positions.selected(perms.length)}
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.positions.cancel}
          </Button>
          <Button type="submit" form="position-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {uz.positions.save}
          </Button>
        </>
      }
    >
      <form id="position-form" onSubmit={submit} className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label>{uz.positions.template}</Label>
            <Select value={template} onValueChange={applyTemplate}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={uz.positions.template} />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" onClick={() => update(grantableAll)}>
            {uz.positions.selectAll}
          </Button>
          <Button variant="ghost" onClick={() => update([])}>
            {uz.positions.clear}
          </Button>
        </div>

        <div>
          <Label htmlFor="position-name">{uz.positions.name} *</Label>
          <Input
            id="position-name"
            autoFocus
            placeholder={uz.positions.namePlaceholder}
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>

        <div>
          <Label>{uz.positions.color}</Label>
          <ColorSwatches value={color} onChange={setColor} options={POSITION_COLORS} />
        </div>

        {error ? <FieldHint error>{error}</FieldHint> : null}

        <Input
          icon={<Search />}
          placeholder={uz.positions.modalSearch}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="space-y-4">
          {PERMISSION_CATEGORIES.map((cat) => {
            const items = cat.permissions.filter(
              (p) => !q || p.name.toLowerCase().includes(q) || p.id.includes(q) || cat.title.toLowerCase().includes(q),
            );
            if (!items.length) return null;
            const ids: string[] = cat.permissions.map((p) => p.id).filter(canGrant);
            const allOn = ids.length > 0 && ids.every((id) => perms.includes(id));
            return (
              <section key={cat.id} className="rounded-card border border-border-soft p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-body font-bold text-foreground">{cat.title}</span>
                  <Button
                    size="sm"
                    variant={allOn ? "primary" : "ghost"}
                    disabled={!ids.length}
                    onClick={() => update(allOn ? perms.filter((p) => !ids.includes(p)) : [...perms, ...ids])}
                  >
                    {allOn ? uz.positions.categoryAll : uz.positions.categoryPick}
                  </Button>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {items.map((p) => {
                    const on = perms.includes(p.id);
                    return (
                      <ChoiceField
                        key={p.id}
                        label={p.name}
                        control={
                          <Checkbox
                            checked={on}
                            disabled={!on && !canGrant(p.id)}
                            onCheckedChange={(v) => toggle(p.id, v === true)}
                          />
                        }
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
