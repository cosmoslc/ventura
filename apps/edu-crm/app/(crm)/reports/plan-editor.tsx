"use client";

import { Check, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { yearMonths } from "@/lib/reports";
import { FINANCE_PLAN_LINES, financePlanInput, firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { saveFinancePlansAction } from "./actions";

const t = uz.reports.plan;
type Line = (typeof FINANCE_PLAN_LINES)[number];

export interface PlanCellRow {
  branchId: string;
  month: string;
  line: Line;
  amount: number;
}

type Values = Record<string, number | null>;
const cellKey = (month: string, line: Line) => `${month}:${line}`;

function valuesOf(rows: readonly PlanCellRow[], branchId: string): Values {
  const out: Values = {};
  for (const r of rows) if (r.branchId === branchId) out[cellKey(r.month, r.line)] = r.amount;
  return out;
}

/**
 * Yillik pul oqimi rejasi (ADR 0030): oylar × to'lovlar, qo'shimcha daromad, ish haqi. Bitta filial uchun bir
 * martada saqlanadi; bo'sh katak — reja yo'q. Xarajatlar rejasi bu yerda emas — toifalar bo'yicha Xarajatlar sahifasida.
 */
export function PlanEditor({
  year,
  rows,
  branches,
  selectedBranch,
}: {
  year: number;
  rows: PlanCellRow[];
  branches: PickerBranch[];
  selectedBranch: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [branchId, setBranchId] = React.useState("");
  const [values, setValues] = React.useState<Values>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const showBranch = branches.length > 1 && selectedBranch === "all";
  const months = yearMonths(year);

  function start() {
    const b = selectedBranch !== "all" ? selectedBranch : branches.length === 1 ? branches[0]!.id : "";
    setBranchId(b);
    setValues(b ? valuesOf(rows, b) : {});
    setError(null);
    setOpen(true);
  }

  function pickBranch(b: string) {
    setBranchId(b);
    setValues(valuesOf(rows, b));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (showBranch && !branchId) return setError(uz.common.branchRequired);
    const parsed = financePlanInput.safeParse({
      branchId: branchId || null,
      year,
      cells: months.flatMap((m) =>
        FINANCE_PLAN_LINES.map((line) => ({ month: m, line, amount: values[cellKey(m, line)] || null })),
      ),
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    startTransition(async () => {
      const res = await saveFinancePlansAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({ tone: res.changed ? "success" : "info", title: res.changed ? t.saved : t.unchanged });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={start}>
        <Target /> {t.edit}
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => !o && setOpen(false)}
        title={t.editTitle(year)}
        description={t.editHint}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {uz.common.cancel}
            </Button>
            <Button type="submit" form="finance-plan-form" disabled={pending}>
              <Check /> {uz.common.save}
            </Button>
          </>
        }
      >
        <form id="finance-plan-form" onSubmit={submit} className="space-y-5">
          {showBranch ? (
            <div>
              <Label>{uz.common.branch} *</Label>
              <Select value={branchId} onValueChange={pickBranch}>
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

          <fieldset disabled={showBranch && !branchId} className="space-y-2 disabled:opacity-50">
            <div className="grid grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] gap-2 px-1 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              <span>{t.month}</span>
              {FINANCE_PLAN_LINES.map((line) => (
                <span key={line}>{t.lines[line]}</span>
              ))}
            </div>
            {months.map((m, i) => (
              <div key={m} className="grid grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] items-center gap-2">
                <span className="px-1 text-body font-semibold text-foreground">{uz.months[i]!.slice(0, 3)}</span>
                {FINANCE_PLAN_LINES.map((line) => (
                  <MoneyInput
                    key={line}
                    aria-label={`${uz.months[i]} — ${t.lines[line]}`}
                    value={values[cellKey(m, line)] ?? null}
                    onValueChange={(v) => {
                      setValues((prev) => ({ ...prev, [cellKey(m, line)]: v }));
                      setError(null);
                    }}
                    placeholder="—"
                    className="h-10 text-right"
                  />
                ))}
              </div>
            ))}
          </fieldset>

          <p className="text-caption text-muted-foreground">
            {t.expensesHint}{" "}
            <Link href="/expenses?tab=plans" className="font-semibold text-primary-text hover:underline">
              {t.expensesLink}
            </Link>
          </p>
          {error ? <FieldHint error>{error}</FieldHint> : null}
        </form>
      </Modal>
    </>
  );
}
