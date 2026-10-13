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
import type { CategoryRow } from "@/lib/server/expenses";
import { firstError, incomeInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { categoryFits } from "../expenses/expense-form";
import type { MethodOption } from "../payments/payment-dialog";
import { saveIncomeAction } from "./actions";
import type { IncomeRow } from "./data";

const t = uz.incomes;

function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function IncomeForm({
  open,
  onOpenChange,
  editing,
  categories,
  methods,
  branches,
  selectedBranch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: IncomeRow | null;
  categories: CategoryRow[];
  methods: MethodOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  onSaved: () => void;
}) {
  const [branchId, setBranchId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [methodId, setMethodId] = React.useState("");
  const [payer, setPayer] = React.useState("");
  const [date, setDate] = React.useState(todayLocal());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = open ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setBranchId(
        editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : branches.length === 1 ? branches[0]!.id : ""),
      );
      setTitle(editing?.title ?? "");
      setCategoryId(editing?.categoryId ?? "");
      setAmount(editing?.amount ?? null);
      setMethodId(editing?.methodId ?? methods.find((m) => m.active)?.id ?? "");
      setPayer(editing?.payer ?? "");
      setDate(editing?.date ?? todayLocal());
      setError(null);
    }
  }

  const showBranch =
    branches.length > 1 && (selectedBranch === "all" || (!!editing && editing.branchId !== selectedBranch));
  const categoryOptions = categories.filter(
    (c) => (c.active && categoryFits(c, branchId)) || c.id === editing?.categoryId,
  );
  const methodOptions = methods.filter((m) => m.active || m.id === editing?.methodId);
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setError(null);
    };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = incomeInput.safeParse({
      id: editing?.id,
      branchId: branchId || null,
      categoryId,
      title,
      amount: amount ?? Number.NaN,
      date,
      methodId,
      payer,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    if (showBranch && !branchId) return setError(uz.common.branchRequired);
    startTransition(async () => {
      const res = await saveIncomeAction(parsed.data);
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? t.updated : t.created, description: parsed.data.title });
      onOpenChange(false);
      onSaved();
    });
  }

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
          <Button type="submit" form="income-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : t.submitNew}
          </Button>
        </>
      }
    >
      <form id="income-form" onSubmit={submit} className="space-y-5">
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
        <div>
          <Label htmlFor="income-title">{t.titleField} *</Label>
          <Input
            id="income-title"
            autoFocus
            maxLength={120}
            placeholder={t.titlePlaceholder}
            value={title}
            onChange={(e) => touch(setTitle)(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{uz.expenses.category} *</Label>
            <Select value={categoryId} onValueChange={touch(setCategoryId)}>
              <SelectTrigger className="w-full" aria-label={uz.expenses.category}>
                <SelectValue placeholder={uz.expenses.categoryRequired} />
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
          <div>
            <Label>{t.method} *</Label>
            <Select value={methodId} onValueChange={touch(setMethodId)}>
              <SelectTrigger className="w-full" aria-label={t.method}>
                <SelectValue placeholder={uz.expenses.methodRequired} />
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="income-amount">{uz.expenses.amount} *</Label>
            <MoneyInput
              id="income-amount"
              value={amount}
              onValueChange={touch(setAmount)}
              suffix={uz.common.som}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="income-date">{uz.expenses.date} *</Label>
            <Input
              id="income-date"
              type="date"
              max={todayLocal()}
              value={date}
              onChange={(e) => touch(setDate)(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="income-payer">{t.payer}</Label>
          <Input
            id="income-payer"
            maxLength={120}
            placeholder={t.payerPlaceholder}
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          />
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
