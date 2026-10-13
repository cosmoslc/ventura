"use client";

import { Check, Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { Notice } from "@ventura/ui/notice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import type { PersonOption } from "@/lib/server/expenses";
import type { Payroll } from "@/lib/server/payroll";
import { formatMonth, money } from "@/lib/format";
import { firstError, salaryEntryInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { MethodOption } from "../payments/payment-dialog";
import { saveSalaryEntryAction } from "./actions";
import type { SalaryEntryRow } from "./data";

const t = uz.salaries;
type Kind = SalaryEntryRow["kind"];
const KINDS: readonly Kind[] = ["salary", "advance", "bonus", "penalty"];

export interface SalaryPerms {
  salary: boolean;
  advance: boolean;
  /** Bonus va jarima */
  adjust: boolean;
}

export interface SalaryFormState {
  editing: SalaryEntryRow | null;
  /** Oldindan tanlangan xodim ("user:<id>" / "teacher:<id>") */
  person: string | null;
  month: string;
  amount: number | null;
}

function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function SalaryForm({
  state,
  onClose,
  people,
  methods,
  months,
  perms,
  payroll,
  onSaved,
}: {
  state: SalaryFormState | null;
  onClose: () => void;
  people: PersonOption[];
  methods: MethodOption[];
  months: string[];
  perms: SalaryPerms;
  payroll: Payroll;
  onSaved: () => void;
}) {
  const allowedKinds = KINDS.filter((k) =>
    k === "salary" ? perms.salary : k === "advance" ? perms.advance : perms.adjust,
  );
  const [person, setPerson] = React.useState("");
  const [kind, setKind] = React.useState<Kind>("salary");
  const [month, setMonth] = React.useState("");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [methodId, setMethodId] = React.useState("");
  const [date, setDate] = React.useState(todayLocal());
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const editing = state?.editing ?? null;
  const key = state ? (editing?.id ?? `new:${state.person ?? ""}:${state.month}`) : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (state) {
      setPerson(state.person ?? "");
      setKind(editing?.kind ?? allowedKinds[0] ?? "salary");
      setMonth(state.month);
      setAmount(state.amount);
      setMethodId(editing?.methodId ?? methods.find((m) => m.active)?.id ?? "");
      setDate(editing?.date ?? todayLocal());
      setNote(editing?.note ?? "");
      setError(null);
    }
  }

  const cash = kind === "salary" || kind === "advance";
  const methodOptions = methods.filter((m) => m.active || m.id === editing?.methodId);
  // Ro'yxatda yo'q (bo'shatilgan) xodimning yozuvini tahrirlash
  const list =
    editing && !people.some((p) => p.value === editing.person)
      ? [
          ...people,
          {
            value: editing.person,
            name: editing.personName,
            kind: editing.role === "staff" ? ("user" as const) : ("teacher" as const),
          },
        ]
      : people;
  const row = payroll.month === month ? payroll.rows.find((r) => `${r.kind}:${r.id}` === person) : undefined;
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setError(null);
    };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = salaryEntryInput.safeParse({
      id: editing?.id,
      person,
      kind,
      amount: amount ?? Number.NaN,
      month,
      date,
      methodId: cash ? methodId || null : null,
      note,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    if (cash && !methodId) return setError(t.methodRequired);
    startTransition(async () => {
      const res = await saveSalaryEntryAction(parsed.data);
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onClose();
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? t.updated : t.saved });
      onClose();
      onSaved();
    });
  }

  return (
    <Modal
      open={!!state}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? t.formEdit : t.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="salary-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : t.add}
          </Button>
        </>
      }
    >
      <form id="salary-form" onSubmit={submit} className="space-y-5">
        <div>
          <Label>{t.person} *</Label>
          <Select value={person} onValueChange={touch(setPerson)}>
            <SelectTrigger className="w-full" aria-label={t.person}>
              <SelectValue placeholder={t.personPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {list.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.name}
                  <span className="text-muted-foreground"> · {p.kind === "teacher" ? t.roleTeacher : t.roleStaff}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t.kind} *</Label>
            <Select value={kind} onValueChange={(v) => touch(setKind)(v as Kind)}>
              <SelectTrigger className="w-full" aria-label={t.kind}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(editing && !allowedKinds.includes(editing.kind) ? [...allowedKinds, editing.kind] : allowedKinds).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {t.kinds[k]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <FieldHint>{t.kindHints[kind]}</FieldHint>
          </div>
          <div>
            <Label>{t.formMonth} *</Label>
            <Select value={month} onValueChange={touch(setMonth)}>
              <SelectTrigger className="w-full" aria-label={t.formMonth}>
                <SelectValue placeholder={t.monthRequired} />
              </SelectTrigger>
              <SelectContent>
                {(months.includes(month) || !month ? months : [month, ...months]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {row ? (
          <Notice tone="info">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {t.balanceLine(
                  `${money(row.balance.accrued + row.balance.bonus - row.balance.penalty)} ${uz.common.som}`,
                  `${money(row.balance.paid)} ${uz.common.som}`,
                  `${money(row.balance.remaining)} ${uz.common.som}`,
                )}
              </span>
              {row.balance.remaining > 0 && cash ? (
                <Button size="sm" variant="ghost" onClick={() => touch(setAmount)(row.balance.remaining)}>
                  {t.fillRemaining}
                </Button>
              ) : null}
            </div>
          </Notice>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="salary-amount">{t.amount} *</Label>
            <MoneyInput
              id="salary-amount"
              value={amount}
              onValueChange={touch(setAmount)}
              suffix={uz.common.som}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="salary-date">{t.date} *</Label>
            <Input
              id="salary-date"
              type="date"
              max={todayLocal()}
              value={date}
              onChange={(e) => touch(setDate)(e.target.value)}
            />
          </div>
        </div>
        {cash ? (
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
        ) : null}
        <div>
          <Label htmlFor="salary-note">{t.note}</Label>
          <Textarea
            id="salary-note"
            rows={2}
            maxLength={500}
            placeholder={t.notePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
