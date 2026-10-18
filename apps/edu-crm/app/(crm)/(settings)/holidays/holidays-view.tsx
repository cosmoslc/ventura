"use client";

import { CalendarOff, Check, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterSearch } from "@ventura/ui/filter-bar";
import { Checkbox, ChoiceField, RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { formatDate } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../../branch-picker";
import { deleteHolidayAction, saveHolidayAction } from "./actions";
import type { HolidayRow } from "./data";

const TYPES = ["official", "center", "custom"] as const;
const TONE = { official: "info", center: "success", custom: "neutral" } as const;

function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const dayCount = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd! + n)).toISOString().slice(0, 10);
};

export function HolidaysView({
  rows,
  branches,
  canWrite,
  canAllBranches,
}: {
  rows: HolidayRow[];
  branches: PickerBranch[];
  canWrite: boolean;
  /** "Barcha filiallar" bayramini faqat filial cheklovisiz xodim boshqaradi */
  canAllBranches: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<HolidayRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<HolidayRow | null>(null);
  const today = todayLocal();

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (h) => !q || h.name.toLowerCase().includes(q) || (h.note ?? "").toLowerCase().includes(q),
  );
  const branchNames = (ids: string[] | null) =>
    ids
      ? branches
          .filter((b) => ids.includes(b.id))
          .map((b) => b.name)
          .join(", ")
      : uz.holidays.allBranches;
  const manageable = (h: HolidayRow) => canWrite && (h.branchIds ? true : canAllBranches);

  async function remove(h: HolidayRow) {
    const res = await deleteHolidayAction(h.id);
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: uz.holidays.deleted, description: h.name });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={uz.holidays.title}
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> {uz.holidays.add}
            </Button>
          ) : null
        }
      />

      <Notice tone="warning">
        <div className="font-semibold">{uz.holidays.bannerTitle}</div>
        <div className="mt-1">{uz.holidays.bannerText}</div>
      </Notice>

      <FilterBar standalone>
        <FilterSearch placeholder={uz.holidays.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </FilterBar>

      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((h) => {
            const n = dayCount(h.startDate, h.endDate);
            const past = h.endDate < today;
            return (
              <Card key={h.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-body font-bold text-foreground">{h.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={TONE[h.type]}>{uz.holidays.types[h.type]}</Badge>
                      <Badge tone="neutral">{uz.holidays.days(n)}</Badge>
                      {past ? <Badge tone="neutral">{uz.holidays.past}</Badge> : null}
                    </div>
                  </div>
                  {manageable(h) ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="icon"
                        size="icon-sm"
                        title={uz.holidays.edit}
                        aria-label={`${h.name} — ${uz.holidays.edit}`}
                        onClick={() => {
                          setEditing(h);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="icon"
                        size="icon-sm"
                        className="text-destructive-text"
                        title={uz.holidays.delete}
                        aria-label={`${h.name} — ${uz.holidays.delete}`}
                        onClick={() => setToDelete(h)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="font-mono text-body text-foreground">
                  {formatDate(h.startDate)}
                  {h.endDate !== h.startDate ? ` — ${formatDate(h.endDate)}` : ""}
                </div>
                <div className="text-caption text-muted-foreground">{branchNames(h.branchIds)}</div>
                <Badge tone={h.affectsLessons ? "warning" : "neutral"} className="self-start">
                  {h.affectsLessons ? uz.holidays.affects(n) : uz.holidays.notAffects}
                </Badge>
                {h.note ? <p className="line-clamp-2 text-caption text-muted-foreground">{h.note}</p> : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<CalendarOff />}
            title={uz.holidays.empty}
            description={q ? uz.holidays.emptySearch(query.trim()) : uz.holidays.emptyHint}
          />
        </Card>
      )}

      {canWrite ? (
        <HolidayForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          branches={branches}
          canAllBranches={canAllBranches}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={uz.holidays.deleteTitle}
        message={toDelete ? uz.holidays.deleteMessage(toDelete.name) : ""}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </div>
  );
}

function HolidayForm({
  open,
  onOpenChange,
  editing,
  branches,
  canAllBranches,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: HolidayRow | null;
  branches: PickerBranch[];
  canAllBranches: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState(todayLocal());
  const [days, setDays] = React.useState("1");
  const [affects, setAffects] = React.useState(true);
  const [all, setAll] = React.useState(true);
  const [branchIds, setBranchIds] = React.useState<string[]>([]);
  const [type, setType] = React.useState<(typeof TYPES)[number]>("official");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = open ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setName(editing?.name ?? "");
      setStartDate(editing?.startDate ?? todayLocal());
      setDays(String(editing ? dayCount(editing.startDate, editing.endDate) : 1));
      setAffects(editing?.affectsLessons ?? true);
      const scoped = editing ? editing.branchIds : canAllBranches ? null : branches.map((b) => b.id);
      setAll(scoped === null);
      setBranchIds(scoped ?? []);
      setType(editing?.type ?? "official");
      setNote(editing?.note ?? "");
      setError(null);
    }
  }

  const n = Math.max(1, Math.min(60, Number(days) || 1));

  function toggleBranch(id: string, on: boolean) {
    const next = on ? [...branchIds, id] : branchIds.filter((x) => x !== id);
    setBranchIds(next);
    // Hech biri tanlanmasa — barcha filiallar (faqat ruxsati borga)
    setAll(next.length === 0 && canAllBranches);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(uz.holidays.nameRequired);
    if (!all && !branchIds.length) return setError(uz.common.branchRequired);
    startTransition(async () => {
      const res = await saveHolidayAction({
        id: editing?.id,
        name,
        startDate,
        days: Number(days),
        type,
        affectsLessons: affects,
        branchIds: all ? [] : branchIds,
        note,
      });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? uz.holidays.updated : uz.holidays.created, description: name });
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? uz.holidays.formEdit : uz.holidays.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="holiday-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : uz.holidays.submitNew}
          </Button>
        </>
      }
    >
      <form id="holiday-form" onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="holiday-name">{uz.holidays.name} *</Label>
          <Input
            id="holiday-name"
            autoFocus
            placeholder={uz.holidays.namePlaceholder}
            value={name}
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="holiday-start">{uz.holidays.startDate} *</Label>
            <Input id="holiday-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="holiday-days">{uz.holidays.duration} *</Label>
            <Input
              id="holiday-days"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
            {n > 1 && startDate ? (
              <FieldHint>{uz.holidays.endHint(formatDate(addDays(startDate, n - 1)))}</FieldHint>
            ) : null}
          </div>
        </div>
        <div>
          <Label>{uz.holidays.affectsLabel} *</Label>
          <RadioGroup
            value={affects ? "yes" : "no"}
            onValueChange={(v) => setAffects(v === "yes")}
            className="grid-cols-2"
          >
            <RadioCard value="yes" title={uz.holidays.yes} />
            <RadioCard value="no" title={uz.holidays.no} />
          </RadioGroup>
          <Notice tone={affects ? "warning" : "info"} className="mt-2">
            {affects ? uz.holidays.yesNote(n) : uz.holidays.noNote(n)}
          </Notice>
        </div>
        {branches.length > 1 || !canAllBranches ? (
          <div>
            <Label>{uz.holidays.branches} *</Label>
            <div className="grid gap-2.5 rounded-control border border-border-soft p-3 sm:grid-cols-2">
              {canAllBranches ? (
                <ChoiceField
                  label={uz.holidays.allBranches}
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
        <div>
          <Label>{uz.holidays.type}</Label>
          <Select value={type} onValueChange={(v) => setType(v as (typeof TYPES)[number])}>
            <SelectTrigger className="w-full" aria-label={uz.holidays.type}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {uz.holidays.typeOptions[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="holiday-note">{uz.holidays.note}</Label>
          <Textarea
            id="holiday-note"
            rows={2}
            maxLength={500}
            placeholder={uz.holidays.notePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error ? (
          <FieldHint error>
            <TriangleAlert className="mr-1 inline size-3.5" />
            {error}
          </FieldHint>
        ) : null}
      </form>
    </Modal>
  );
}
