"use client";

import { Check, Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import type { CategoryRow, PersonOption } from "@/lib/server/expenses";
import { expenseInput, firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import type { MethodOption } from "../payments/payment-dialog";
import { saveExpenseAction } from "./actions";
import type { ExpenseRow } from "./data";

const t = uz.expenses;
const NONE = "none";

function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Toifa shu filialda tanlanadimi (server ham tekshiradi) */
export const categoryFits = (c: CategoryRow, branchId: string) =>
  !c.branchIds || !branchId || c.branchIds.includes(branchId);

/** Xodim tanlovi: "Ko'rsatilmagan" (ixtiyoriy bo'lsa), xodimlar, keyin o'qituvchilar */
export function PersonSelect({
  value,
  onChange,
  people,
  emptyLabel,
  extra,
}: {
  value: string;
  onChange: (v: string) => void;
  people: PersonOption[];
  emptyLabel: string;
  /** Ro'yxatda yo'q (bo'shatilgan) joriy qiymat */
  extra?: { value: string; name: string } | null;
}) {
  const list =
    extra && !people.some((p) => p.value === extra.value) ? [...people, { ...extra, kind: "user" as const }] : people;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label={t.person}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{emptyLabel}</SelectItem>
        {list.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.name}
            {p.kind === "teacher" ? <span className="text-muted-foreground"> · {t.teacherGroup}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ExpenseForm({
  open,
  onOpenChange,
  editing,
  defaultKind,
  categories,
  methods,
  people,
  branches,
  selectedBranch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ExpenseRow | null;
  defaultKind: "variable" | "fixed";
  categories: CategoryRow[];
  methods: MethodOption[];
  people: PersonOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  onSaved: () => void;
}) {
  const [branchId, setBranchId] = React.useState("");
  const [kind, setKind] = React.useState<"variable" | "fixed">(defaultKind);
  const [reason, setReason] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [methodId, setMethodId] = React.useState("");
  const [date, setDate] = React.useState(todayLocal());
  const [person, setPerson] = React.useState(NONE);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = open ? (editing?.id ?? `new-${defaultKind}`) : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      const b =
        editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : branches.length === 1 ? branches[0]!.id : "");
      setBranchId(b);
      setKind(editing?.kind ?? defaultKind);
      setReason(editing?.reason ?? "");
      setCategoryId(editing?.categoryId ?? "");
      setAmount(editing?.amount ?? null);
      setMethodId(editing?.methodId ?? methods.find((m) => m.active)?.id ?? "");
      setDate(editing?.date ?? todayLocal());
      setPerson(editing?.person ?? NONE);
      setError(null);
    }
  }

  const showBranch =
    branches.length > 1 && (selectedBranch === "all" || (!!editing && editing.branchId !== selectedBranch));
  const categoryOptions = categories.filter(
    (c) => c.kind === "expense" && ((c.active && categoryFits(c, branchId)) || c.id === editing?.categoryId),
  );
  const methodOptions = methods.filter((m) => m.active || m.id === editing?.methodId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = expenseInput.safeParse({
      id: editing?.id,
      branchId: branchId || null,
      kind,
      categoryId,
      reason,
      amount: amount ?? Number.NaN,
      date,
      methodId,
      person: person === NONE ? null : person,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    if (showBranch && !branchId) return setError(uz.common.branchRequired);
    startTransition(async () => {
      const res = await saveExpenseAction(parsed.data);
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? t.updated : t.created, description: parsed.data.reason });
      onOpenChange(false);
      onSaved();
    });
  }

  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setError(null);
    };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t.formEdit : t.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="expense-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : t.submitNew}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} className="space-y-5">
        {showBranch ? (
          <div>
            <Label>{uz.common.branch} *</Label>
            <Select
              value={branchId}
              onValueChange={(v) => {
                touch(setBranchId)(v);
                const c = categories.find((x) => x.id === categoryId);
                if (c && !categoryFits(c, v)) setCategoryId("");
              }}
            >
              <SelectTrigger className="w-full" aria-label={uz.common.branch}>
                <SelectValue placeholder={uz.common.chooseBranch} />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t.kind} *</Label>
            <Select value={kind} onValueChange={(v) => touch(setKind)(v as "variable" | "fixed")}>
              <SelectTrigger className="w-full" aria-label={t.kind}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variable">{t.kinds.variable}</SelectItem>
                <SelectItem value="fixed">{t.kinds.fixed}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.category} *</Label>
            <Select value={categoryId} onValueChange={touch(setCategoryId)}>
              <SelectTrigger className="w-full" aria-label={t.category}>
                <SelectValue placeholder={t.categoryRequired} />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="expense-reason">{t.reason} *</Label>
          <Input
            id="expense-reason"
            autoFocus
            maxLength={300}
            placeholder={t.reasonPlaceholder}
            value={reason}
            onChange={(e) => touch(setReason)(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="expense-amount">{t.amount} *</Label>
            <MoneyInput
              id="expense-amount"
              value={amount}
              onValueChange={touch(setAmount)}
              suffix={uz.common.som}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="expense-date">{t.date} *</Label>
            <Input
              id="expense-date"
              type="date"
              max={todayLocal()}
              value={date}
              onChange={(e) => touch(setDate)(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t.method} *</Label>
            <Select value={methodId} onValueChange={touch(setMethodId)}>
              <SelectTrigger className="w-full" aria-label={t.method}>
                <SelectValue placeholder={t.methodRequired} />
              </SelectTrigger>
              <SelectContent>
                {methodOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.person}</Label>
            <PersonSelect
              value={person}
              onChange={touch(setPerson)}
              people={people}
              emptyLabel={t.personNone}
              extra={editing?.person && editing.personName ? { value: editing.person, name: editing.personName } : null}
            />
            <FieldHint>{t.personHint}</FieldHint>
          </div>
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
