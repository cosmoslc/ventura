"use client";

import { CalendarRange, Check, Gauge, Pencil, Plus, Target, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Meter } from "@ventura/ui/meter";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { EmptyState } from "@ventura/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { type PlanState, plansTotal } from "@/lib/expense-plans";
import type { CategoryRow, PersonOption } from "@/lib/server/expenses";
import { formatMonth, money } from "@/lib/format";
import { firstError, planInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import type { MethodOption } from "../payments/payment-dialog";
import { deletePlanAction, savePlanAction } from "./actions";
import type { PlanRow } from "./data";
import { PersonSelect, categoryFits } from "./expense-form";

const t = uz.expenses;
const ALL = "all";
const NONE = "none";
const METER_STATE = { ok: "ok", near: "warn", over: "danger" } as const satisfies Record<PlanState, string>;

export function PlansTab({
  month,
  plans,
  categories,
  methods,
  people,
  branches,
  selectedBranch,
  canEdit,
  onMonth,
}: {
  month: string;
  plans: PlanRow[];
  categories: CategoryRow[];
  methods: MethodOption[];
  people: PersonOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  canEdit: boolean;
  onMonth: (month: string) => void;
}) {
  const router = useRouter();
  const [category, setCategory] = React.useState(ALL);
  const [person, setPerson] = React.useState(ALL);
  const [method, setMethod] = React.useState(ALL);
  const [form, setForm] = React.useState<{ editing: PlanRow | null } | null>(null);
  const [toDelete, setToDelete] = React.useState<PlanRow | null>(null);
  const [, startTransition] = React.useTransition();

  const visible = plans.filter(
    (p) =>
      (category === ALL || p.categoryId === category) &&
      (person === ALL || p.person === person) &&
      (method === ALL || p.methodId === method),
  );
  const sum = plansTotal(visible);
  const showBranch = branches.length > 1 && selectedBranch === "all";
  const personOptions = [
    ...new Map(plans.filter((p) => p.person).map((p) => [p.person!, p.personName ?? ""])).entries(),
  ];

  function remove(p: PlanRow) {
    startTransition(async () => {
      const res = await deletePlanAction(p.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.planDeleted, description: p.categoryName });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Target />}
          tone={1}
          label={t.kpiPlanned}
          value={`${money(sum.planned)} ${uz.common.som}`}
          hint={t.kpiPlannedHint(visible.length)}
        />
        <StatCard
          icon={<Wallet />}
          tone={4}
          label={t.kpiSpent}
          value={`${money(sum.spent)} ${uz.common.som}`}
          hint={t.kpiSpentHint}
        />
        <Card className="flex flex-col justify-center gap-2 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Gauge className="size-4" /> {t.kpiProgress}
          </div>
          <Meter
            label={formatMonth(month)}
            value={sum.planned ? sum.spent / sum.planned : 0}
            state={METER_STATE[sum.state]}
            overflow
          />
        </Card>
      </div>

      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="plan-month">{t.planMonth}</Label>
          <Input
            id="plan-month"
            type="month"
            icon={<CalendarRange />}
            value={month}
            onChange={(e) => e.target.value && onMonth(e.target.value)}
          />
        </div>
        <div>
          <Label>{t.category}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full" aria-label={t.category}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.allCategories}</SelectItem>
              {categories
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.person}</Label>
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger className="w-full" aria-label={t.person}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.allPeople}</SelectItem>
              {personOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.method}</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-full" aria-label={t.method}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.allMethods}</SelectItem>
              {methods.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="type-heading text-base">{formatMonth(month)}</h2>
          {canEdit ? (
            <Button onClick={() => setForm({ editing: null })}>
              <Plus /> {t.addPlan}
            </Button>
          ) : null}
        </div>
        {visible.length ? (
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <Tr>
                  <Th>{t.colCategory}</Th>
                  {showBranch ? <Th>{t.colBranch}</Th> : null}
                  <Th>{t.colPerson}</Th>
                  <Th>{t.colMethod}</Th>
                  <Th className="text-right">{t.colLimit}</Th>
                  <Th className="min-w-52">{t.colSpent}</Th>
                  <Th className="text-right">{t.colRemaining}</Th>
                  {canEdit ? <Th className="text-right">{uz.common.actions}</Th> : null}
                </Tr>
              </THead>
              <TBody>
                {visible.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <div className="font-medium text-foreground">{p.categoryName}</div>
                      {p.note ? <div className="text-caption text-muted-foreground">{p.note}</div> : null}
                    </Td>
                    {showBranch ? <Td className="text-muted-foreground">{p.branchName}</Td> : null}
                    <Td className="text-muted-foreground">{p.personName ?? t.planAllPeople}</Td>
                    <Td className="text-muted-foreground">{p.methodName ?? t.planAllMethods}</Td>
                    <Td className="text-right font-semibold whitespace-nowrap">{money(p.amount)}</Td>
                    <Td>
                      <Meter
                        label={`${money(p.usage.spent)} ${uz.common.som}`}
                        detail={t.spentOf(p.usage.count)}
                        value={p.amount ? p.usage.spent / p.amount : 0}
                        state={METER_STATE[p.usage.state]}
                        overflow
                      />
                    </Td>
                    <Td
                      className={cn(
                        "text-right font-semibold whitespace-nowrap",
                        p.usage.remaining < 0 ? "text-(--danger-fg)" : "text-(--success-fg)",
                      )}
                    >
                      {p.usage.remaining < 0 ? "−" : "+"}
                      {money(Math.abs(p.usage.remaining))}
                    </Td>
                    {canEdit ? (
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="icon"
                            size="icon"
                            aria-label={uz.common.edit}
                            title={uz.common.edit}
                            onClick={() => setForm({ editing: p })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="icon"
                            size="icon"
                            className="text-destructive-text"
                            aria-label={uz.common.delete}
                            title={uz.common.delete}
                            onClick={() => setToDelete(p)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<Target />} title={t.plansEmpty} description={t.plansEmptyHint} />
        )}
      </Card>

      {canEdit ? (
        <PlanForm
          state={form}
          month={month}
          onClose={() => setForm(null)}
          categories={categories}
          methods={methods}
          people={people}
          branches={branches}
          selectedBranch={selectedBranch}
          onSaved={() => router.refresh()}
        />
      ) : null}
      <ConfirmModal
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t.planDeleteTitle}
        message={toDelete ? t.planDeleteMessage(toDelete.categoryName, formatMonth(toDelete.month)) : ""}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toDelete && remove(toDelete)}
      />
    </div>
  );
}

function PlanForm({
  state,
  month: defaultMonth,
  onClose,
  categories,
  methods,
  people,
  branches,
  selectedBranch,
  onSaved,
}: {
  state: { editing: PlanRow | null } | null;
  month: string;
  onClose: () => void;
  categories: CategoryRow[];
  methods: MethodOption[];
  people: PersonOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  onSaved: () => void;
}) {
  const [branchId, setBranchId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [month, setMonth] = React.useState(defaultMonth);
  const [amount, setAmount] = React.useState<number | null>(null);
  const [methodId, setMethodId] = React.useState(NONE);
  const [person, setPerson] = React.useState(NONE);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const editing = state?.editing ?? null;
  const key = state ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (state) {
      setBranchId(
        editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : branches.length === 1 ? branches[0]!.id : ""),
      );
      setCategoryId(editing?.categoryId ?? "");
      setMonth(editing?.month ?? defaultMonth);
      setAmount(editing?.amount ?? null);
      setMethodId(editing?.methodId ?? NONE);
      setPerson(editing?.person ?? NONE);
      setNote(editing?.note ?? "");
      setError(null);
    }
  }

  const showBranch = branches.length > 1 && selectedBranch === "all";
  const categoryOptions = categories.filter(
    (c) => c.kind === "expense" && ((c.active && categoryFits(c, branchId)) || c.id === editing?.categoryId),
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
    const parsed = planInput.safeParse({
      id: editing?.id,
      branchId: branchId || null,
      categoryId,
      month,
      amount: amount ?? Number.NaN,
      methodId: methodId === NONE ? null : methodId,
      person: person === NONE ? null : person,
      note,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    if (showBranch && !branchId) return setError(uz.common.branchRequired);
    startTransition(async () => {
      const res = await savePlanAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.planSaved });
      onClose();
      onSaved();
    });
  }

  return (
    <Modal
      open={!!state}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? t.planFormEdit : t.planFormNew}
      description={t.planHint}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="plan-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : t.addPlan}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="space-y-5">
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
          <div>
            <Label htmlFor="plan-form-month">{t.planMonth} *</Label>
            <Input id="plan-form-month" type="month" value={month} onChange={(e) => touch(setMonth)(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="plan-amount">{t.planLimit} *</Label>
          <MoneyInput
            id="plan-amount"
            value={amount}
            onValueChange={touch(setAmount)}
            suffix={uz.common.som}
            placeholder="0"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t.method}</Label>
            <Select value={methodId} onValueChange={touch(setMethodId)}>
              <SelectTrigger className="w-full" aria-label={t.method}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.planAllMethods}</SelectItem>
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
              emptyLabel={t.planAllPeople}
              extra={editing?.person && editing.personName ? { value: editing.person, name: editing.personName } : null}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="plan-note">{t.planNote}</Label>
          <Textarea
            id="plan-note"
            rows={2}
            maxLength={300}
            placeholder={t.planNotePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
