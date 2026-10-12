"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Checkbox, ChoiceField, RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { Notice } from "@ventura/ui/notice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { correctionAction, editEntryAction, refundAction, saveDiscountAction, voidEntryAction } from "./actions";
import type { DiscountRow, PaymentRow, StudentGroupOption } from "./data";
import type { MethodOption } from "./payment-dialog";

const t = uz.payments;
const f = uz.finance;
const NONE = "none";

function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Oyna ochilganda formani boshlang'ich holatga qaytarish */
function useReset(open: boolean, reset: () => void) {
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset();
  }
}

function Footer({
  form,
  pending,
  onCancel,
  label,
}: {
  form: string;
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        {uz.common.cancel}
      </Button>
      <Button type="submit" form={form} disabled={pending}>
        <Check /> {label}
      </Button>
    </>
  );
}

/* ---------- Qaytarish ---------- */

export function RefundDialog({
  open,
  onOpenChange,
  studentId,
  available,
  groups,
  methods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  /** Qaytarish mumkin bo'lgan summa (musbat balans) */
  available: number;
  groups: StudentGroupOption[];
  methods: MethodOption[];
}) {
  const router = useRouter();
  const active = methods.filter((m) => m.active);
  const [amount, setAmount] = React.useState<number | null>(null);
  const [groupId, setGroupId] = React.useState(NONE);
  const [methodId, setMethodId] = React.useState("");
  const [date, setDate] = React.useState(todayLocal());
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  useReset(open, () => {
    setAmount(available > 0 ? available : null);
    setGroupId(NONE);
    setMethodId(active[0]?.id ?? "");
    setDate(todayLocal());
    setReason("");
    setError(null);
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return setError(t.amountRequired);
    if (amount > available) return setError(t.refundTooBig(`${money(available)} ${uz.common.som}`));
    if (!reason.trim()) return setError(t.refundReasonRequired);
    startTransition(async () => {
      const res = await refundAction({
        studentId,
        groupId: groupId === NONE ? null : groupId,
        amount,
        methodId,
        date,
        reason,
      });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.refunded, description: `${money(amount)} ${uz.common.som}` });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={t.refundTitle}
      footer={
        <Footer
          form="refund-form"
          pending={pending || available <= 0}
          onCancel={() => onOpenChange(false)}
          label={t.refund}
        />
      }
    >
      <form id="refund-form" onSubmit={submit} className="space-y-4">
        {available > 0 ? (
          <Notice tone="info">{t.refundAvailable(`${money(available)} ${uz.common.som}`)}</Notice>
        ) : (
          <Notice tone="warning">{t.refundNone}</Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="refund-amount">{t.amount} *</Label>
            <MoneyInput id="refund-amount" value={amount} onValueChange={setAmount} suffix={uz.common.som} />
          </div>
          <div>
            <Label>{t.method}</Label>
            <Select value={methodId} onValueChange={setMethodId}>
              <SelectTrigger className="w-full" aria-label={t.method}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {active.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.group}</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-full" aria-label={t.group}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.groupNone}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="refund-date">{t.date}</Label>
            <Input
              id="refund-date"
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="refund-reason">{t.refundReason} *</Label>
          <Textarea
            id="refund-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Modal>
  );
}

/* ---------- Balansni tuzatish ---------- */

export function CorrectionDialog({
  open,
  onOpenChange,
  studentId,
  balance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  balance: number;
}) {
  const router = useRouter();
  const [direction, setDirection] = React.useState<"credit" | "debit">("credit");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  useReset(open, () => {
    setDirection("credit");
    setAmount(null);
    setReason("");
    setError(null);
  });
  const delta = (amount ?? 0) * (direction === "credit" ? 1 : -1);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return setError(t.amountRequired);
    if (!reason.trim()) return setError(t.correctionReasonRequired);
    startTransition(async () => {
      const res = await correctionAction({ studentId, amount: delta, reason });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.corrected });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={t.correctionTitle}
      footer={
        <Footer form="correction-form" pending={pending} onCancel={() => onOpenChange(false)} label={uz.common.save} />
      }
    >
      <form id="correction-form" onSubmit={submit} className="space-y-4">
        <Notice tone="warning">{t.correctionText}</Notice>
        <div>
          <Label>{t.correctionDirection}</Label>
          <RadioGroup
            value={direction}
            onValueChange={(v) => setDirection(v as "credit" | "debit")}
            className="grid-cols-2"
          >
            <RadioCard value="credit" title={t.correctionCredit} description={t.correctionCreditHint} />
            <RadioCard value="debit" title={t.correctionDebit} description={t.correctionDebitHint} />
          </RadioGroup>
        </div>
        <div>
          <Label htmlFor="correction-amount">{t.amount} *</Label>
          <MoneyInput id="correction-amount" value={amount} onValueChange={setAmount} suffix={uz.common.som} />
          <FieldHint>
            {t.balanceNow}: {money(balance)} → {t.balanceAfter}: {money(balance + delta)} {uz.common.som}
          </FieldHint>
        </div>
        <div>
          <Label htmlFor="correction-reason">{t.correctionReason} *</Label>
          <Textarea
            id="correction-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Modal>
  );
}

/* ---------- Bekor qilish ---------- */

export function VoidDialog({ entry, onClose }: { entry: PaymentRow | null; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  useReset(!!entry, () => {
    setReason("");
    setError(null);
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    if (!reason.trim()) return setError(t.voidReasonRequired);
    startTransition(async () => {
      const res = await voidEntryAction({ id: entry.id, reason });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.voidedOk });
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={!!entry}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={t.voidTitle}
      description={
        entry ? `${t.kinds[entry.kind]} · ${money(entry.amount)} ${uz.common.som} · ${entry.studentName}` : undefined
      }
      footer={<Footer form="void-form" pending={pending} onCancel={onClose} label={t.void} />}
    >
      <form id="void-form" onSubmit={submit} className="space-y-4">
        <Notice tone="warning">{t.voidText}</Notice>
        <div>
          <Label htmlFor="void-reason">{t.voidReason} *</Label>
          <Textarea
            id="void-reason"
            rows={2}
            autoFocus
            maxLength={500}
            placeholder={t.voidReasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Modal>
  );
}

/* ---------- Tahrirlash ---------- */

export function EditEntryDialog({
  entry,
  onClose,
  groups,
  methods,
}: {
  entry: PaymentRow | null;
  onClose: () => void;
  groups: StudentGroupOption[];
  methods: MethodOption[];
}) {
  const router = useRouter();
  const [groupId, setGroupId] = React.useState(NONE);
  const [month, setMonth] = React.useState("");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [methodId, setMethodId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  useReset(!!entry, () => {
    if (!entry) return;
    setGroupId(entry.groupId ?? NONE);
    setMonth(entry.month ?? todayLocal().slice(0, 7));
    setAmount(entry.amount);
    setMethodId(entry.methodId ?? "");
    setDate(entry.date);
    setNote(entry.note ?? "");
    setError(null);
  });
  const cashKind = entry?.kind === "payment" || entry?.kind === "refund";
  const methodList = methods.filter((m) => m.active || m.id === entry?.methodId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    if (!amount) return setError(t.amountRequired);
    startTransition(async () => {
      const res = await editEntryAction({
        id: entry.id,
        groupId: groupId === NONE ? null : groupId,
        month: groupId === NONE || entry.kind === "refund" ? null : month,
        amount,
        methodId: cashKind ? methodId : null,
        date,
        note,
      });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.updated });
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={!!entry}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={t.formEdit}
      description={
        entry ? `${t.kinds[entry.kind]}${entry.receiptNo ? ` · ${t.receiptNo(entry.receiptNo)}` : ""}` : undefined
      }
      footer={<Footer form="edit-entry-form" pending={pending} onCancel={onClose} label={uz.common.save} />}
    >
      <form id="edit-entry-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t.group}</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-full" aria-label={t.group}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.groupNone}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {groupId !== NONE && entry?.kind !== "refund" ? (
            <div>
              <Label htmlFor="edit-month">{t.month}</Label>
              <Input id="edit-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          ) : null}
          <div>
            <Label htmlFor="edit-amount">{t.amount} *</Label>
            <MoneyInput id="edit-amount" value={amount} onValueChange={setAmount} suffix={uz.common.som} />
          </div>
          {cashKind ? (
            <div>
              <Label>{t.method}</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger className="w-full" aria-label={t.method}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methodList.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div>
            <Label htmlFor="edit-date">{t.date}</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="edit-note">{entry?.kind === "payment" ? t.note : t.voidReason}</Label>
          <Textarea id="edit-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Modal>
  );
}

/* ---------- Doimiy chegirma ---------- */

export function DiscountDialog({
  open,
  onOpenChange,
  studentId,
  groups,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  groups: StudentGroupOption[];
  editing: DiscountRow | null;
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState<"fixed" | "percent">("percent");
  const [value, setValue] = React.useState<number | null>(null);
  const [groupId, setGroupId] = React.useState(NONE);
  const [fromMonth, setFromMonth] = React.useState(todayLocal().slice(0, 7));
  const [toMonth, setToMonth] = React.useState("");
  const [affectsTeacher, setAffectsTeacher] = React.useState(true);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  useReset(open, () => {
    setKind(editing?.kind ?? "percent");
    setValue(editing?.value ?? null);
    setGroupId(editing?.groupId ?? NONE);
    setFromMonth(editing?.fromMonth ?? todayLocal().slice(0, 7));
    setToMonth(editing?.toMonth ?? "");
    setAffectsTeacher(editing?.affectsTeacher ?? true);
    setReason(editing?.reason ?? "");
    setError(null);
  });
  const past = fromMonth < todayLocal().slice(0, 7);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value || (kind === "percent" && value > 100)) return setError(f.discountValueInvalid);
    if (toMonth && toMonth < fromMonth) return setError(f.discountMonthsInvalid);
    if (!reason.trim()) return setError(f.discountReasonRequired);
    startTransition(async () => {
      const res = await saveDiscountAction({
        ...(editing ? { id: editing.id } : {}),
        studentId,
        groupId: groupId === NONE ? null : groupId,
        kind,
        value,
        fromMonth,
        toMonth: toMonth || null,
        affectsTeacher,
        reason,
      });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: f.discountSaved });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={editing ? f.discountFormEdit : f.discountFormNew}
      footer={
        <Footer form="discount-form" pending={pending} onCancel={() => onOpenChange(false)} label={uz.common.save} />
      }
    >
      <form id="discount-form" onSubmit={submit} className="space-y-4">
        <div>
          <Label>{f.discountKind}</Label>
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as "fixed" | "percent")} className="grid-cols-2">
            <RadioCard value="percent" title={f.discountPercent} />
            <RadioCard value="fixed" title={f.discountFixed} />
          </RadioGroup>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="discount-value">{f.discountValue} *</Label>
            {kind === "percent" ? (
              <Input
                id="discount-value"
                inputMode="numeric"
                value={value ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, "").slice(0, 3));
                  setValue(n || null);
                }}
              />
            ) : (
              <MoneyInput id="discount-value" value={value} onValueChange={setValue} suffix={uz.common.som} />
            )}
          </div>
          <div>
            <Label>{f.discountGroup}</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-full" aria-label={f.discountGroup}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{f.discountAllGroups}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="discount-from">{f.discountFrom}</Label>
            <Input id="discount-from" type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="discount-to">{f.discountTo}</Label>
            <Input
              id="discount-to"
              type="month"
              value={toMonth}
              min={fromMonth}
              onChange={(e) => setToMonth(e.target.value)}
            />
            <FieldHint>{f.discountToHint}</FieldHint>
          </div>
        </div>
        <ChoiceField
          control={<Checkbox checked={affectsTeacher} onCheckedChange={(v) => setAffectsTeacher(v === true)} />}
          label={f.discountTeacher}
        />
        <div>
          <Label htmlFor="discount-reason">{f.discountReason} *</Label>
          <Textarea
            id="discount-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {past ? <Notice tone="warning">{f.discountPastWarn}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Modal>
  );
}
