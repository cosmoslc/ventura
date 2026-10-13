"use client";

import { Check, Printer, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { Notice } from "@ventura/ui/notice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { type AccountPreview, accountPreviewAction } from "./account-actions";
import { recordPaymentAction } from "./actions";

const t = uz.payments;
const NONE = "none";

export interface PickStudent {
  id: string;
  title: string;
  subtitle: string;
}

export interface MethodOption {
  id: string;
  name: string;
  active: boolean;
}

function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Balans satri: manfiy — qarz, musbat — ortiqcha */
export function BalanceText({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold",
        value < 0 ? "text-(--danger-fg)" : value > 0 ? "text-(--success-fg)" : "",
        className,
      )}
    >
      {money(Math.abs(value))} {uz.common.som}
      {value < 0 ? ` ${t.debtLabel}` : value > 0 ? ` ${t.creditLabel}` : ""}
    </span>
  );
}

export function PaymentDialog({
  open,
  onOpenChange,
  students,
  studentId: fixedStudent,
  studentName: fixedName,
  groupId: initialGroup,
  methods,
  maxDiscountPercent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tanlash ro'yxati (o'quvchi oldindan berilmagan bo'lsa) */
  students?: PickStudent[];
  studentId?: string;
  studentName?: string;
  groupId?: string;
  methods: MethodOption[];
  maxDiscountPercent: number;
}) {
  const router = useRouter();
  const active = methods.filter((m) => m.active);
  const [query, setQuery] = React.useState("");
  const [studentId, setStudentId] = React.useState<string | null>(fixedStudent ?? null);
  const [account, setAccount] = React.useState<AccountPreview | null>(null);
  const [groupId, setGroupId] = React.useState<string>(NONE);
  const [month, setMonth] = React.useState(todayLocal().slice(0, 7));
  const [amount, setAmount] = React.useState<number | null>(null);
  const [methodId, setMethodId] = React.useState(active[0]?.id ?? "");
  const [date, setDate] = React.useState(todayLocal());
  const [note, setNote] = React.useState("");
  const [withDiscount, setWithDiscount] = React.useState(false);
  const [discount, setDiscount] = React.useState<number | null>(null);
  const [discountReason, setDiscountReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ id: string; receiptNo: number } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [loading, startLoading] = React.useTransition();

  const pickGroup = React.useCallback((acc: AccountPreview, id: string) => {
    setGroupId(id);
    const g = acc.groups.find((x) => x.id === id);
    if (g) {
      setMonth(g.suggestedMonth);
      setAmount(g.due > 0 ? g.due : null);
    } else {
      setAmount(acc.debt > 0 ? acc.debt : null);
    }
  }, []);

  const fetchAccount = React.useCallback(
    (id: string) => {
      startLoading(async () => {
        const res = await accountPreviewAction(id);
        if (!res.ok) return setError(res.error);
        setAccount(res.account);
        const prefer =
          (initialGroup ? res.account.groups.find((g) => g.id === initialGroup) : undefined) ??
          res.account.groups.find((g) => g.due > 0 && !g.left) ??
          res.account.groups.find((g) => !g.left) ??
          res.account.groups[0];
        pickGroup(res.account, prefer?.id ?? NONE);
      });
    },
    [initialGroup, pickGroup],
  );

  function load(id: string) {
    setStudentId(id);
    setAccount(null);
    fetchAccount(id);
  }

  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setStudentId(fixedStudent ?? null);
      setAccount(null);
      setGroupId(NONE);
      setMonth(todayLocal().slice(0, 7));
      setAmount(null);
      setMethodId(active[0]?.id ?? "");
      setDate(todayLocal());
      setNote("");
      setWithDiscount(false);
      setDiscount(null);
      setDiscountReason("");
      setError(null);
      setDone(null);
    }
  }
  // O'quvchi oldindan berilgan bo'lsa — oyna ochilganda hisobi yuklanadi
  React.useEffect(() => {
    if (open && fixedStudent) fetchAccount(fixedStudent);
  }, [open, fixedStudent, fetchAccount]);

  const group = account?.groups.find((g) => g.id === groupId) ?? null;
  const discountValue = withDiscount ? (discount ?? 0) : 0;
  const discountPercent = group && group.monthPrice > 0 ? Math.round((discountValue / group.monthPrice) * 100) : 0;
  const after = account ? account.balance + (amount ?? 0) + discountValue : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) return setError(t.studentRequired);
    if (!amount || amount <= 0) return setError(t.amountRequired);
    if (withDiscount && (!discount || discount <= 0)) return setError(t.amountRequired);
    if (withDiscount && !discountReason.trim()) return setError(t.discountReasonRequired);
    startTransition(async () => {
      const res = await recordPaymentAction({
        studentId,
        groupId: groupId === NONE ? null : groupId,
        month: groupId === NONE ? null : month,
        amount,
        methodId,
        date,
        note,
        discount: withDiscount ? { amount: discount, reason: discountReason } : null,
      });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.saved(res.receiptNo) });
      setDone({ id: res.id, receiptNo: res.receiptNo });
      router.refresh();
    });
  }

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const list = (students ?? [])
    .filter(
      (o) => !q || o.title.toLowerCase().includes(q) || (!!digits && o.subtitle.replace(/\D/g, "").includes(digits)),
    )
    .slice(0, q ? 30 : 12);
  const studentName = fixedName ?? students?.find((s) => s.id === studentId)?.title;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.formTitle}
      description={studentName}
      footer={
        done ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {uz.common.cancel}
            </Button>
            <Button asChild>
              <a href={`/payments/${done.id}/receipt`} target="_blank" rel="noreferrer">
                <Printer /> {t.printReceipt}
              </a>
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {uz.common.cancel}
            </Button>
            <Button type="submit" form="payment-form" disabled={pending || !account}>
              <Check /> {t.add}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <Notice tone="success">{t.saved(done.receiptNo)}</Notice>
      ) : !studentId ? (
        <div className="space-y-3">
          <Input
            icon={<Search />}
            autoFocus
            placeholder={t.studentPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="max-h-96 space-y-1 overflow-y-auto" role="listbox" aria-label={t.student}>
            {list.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => load(o.id)}
                  className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <Avatar name={o.title} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-foreground">{o.title}</span>
                    <span className="block truncate text-caption text-muted-foreground">{o.subtitle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : !account ? (
        <p className="text-body text-muted-foreground">{loading ? "…" : error}</p>
      ) : (
        <form id="payment-form" onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 rounded-card border border-border bg-muted/40 p-4 sm:grid-cols-2">
            <div>
              <div className="text-caption text-muted-foreground">{t.balanceNow}</div>
              <BalanceText value={account.balance} />
            </div>
            <div>
              <div className="text-caption text-muted-foreground">{t.balanceAfter}</div>
              <BalanceText value={after} />
            </div>
          </div>

          <div>
            <Label>{t.group}</Label>
            <Select value={groupId} onValueChange={(v) => pickGroup(account, v)}>
              <SelectTrigger className="w-full" aria-label={t.group}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {account.groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                    {g.left ? ` (${t.groupLeft})` : ""}
                    {g.due > 0 ? ` — ${money(g.due)} ${uz.common.som}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>{t.groupNone}</SelectItem>
              </SelectContent>
            </Select>
            {group ? (
              group.unpaid.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-caption text-muted-foreground">{t.monthsDue}:</span>
                  {group.unpaid.map((u) => (
                    <Badge key={u.month} tone="danger">
                      {formatMonth(u.month)} · {money(u.due)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <FieldHint>{t.noDebt}</FieldHint>
              )
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {groupId !== NONE ? (
              <div>
                <Label htmlFor="pay-month">{t.month}</Label>
                <Input id="pay-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
            ) : null}
            <div>
              <Label htmlFor="pay-amount">{t.amount} *</Label>
              <MoneyInput id="pay-amount" autoFocus value={amount} onValueChange={setAmount} suffix={uz.common.som} />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {group && group.due > 0 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAmount(group.due)}>
                    {t.dueGroup(money(group.due))}
                  </Button>
                ) : null}
                {account.debt > 0 && account.debt !== group?.due ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAmount(account.debt)}>
                    {t.dueAll(money(account.debt))}
                  </Button>
                ) : null}
              </div>
            </div>
            <div>
              <Label>{t.method} *</Label>
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
              <Label htmlFor="pay-date">{t.date}</Label>
              <Input
                id="pay-date"
                type="date"
                value={date}
                max={todayLocal()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-card border border-border p-4">
            <ChoiceField
              control={<Checkbox checked={withDiscount} onCheckedChange={(v) => setWithDiscount(v === true)} />}
              label={t.oneOffDiscount}
            />
            {withDiscount ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pay-discount">{t.discountAmount}</Label>
                  <MoneyInput id="pay-discount" value={discount} onValueChange={setDiscount} suffix={uz.common.som} />
                </div>
                <div>
                  <Label htmlFor="pay-discount-reason">{t.discountReason}</Label>
                  <Input
                    id="pay-discount-reason"
                    value={discountReason}
                    maxLength={500}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
                {discountPercent > maxDiscountPercent ? (
                  <Notice tone="warning" className="sm:col-span-2">
                    {t.discountWarn(discountPercent, maxDiscountPercent)}
                  </Notice>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <Label htmlFor="pay-note">{t.note}</Label>
            <Textarea
              id="pay-note"
              rows={2}
              maxLength={500}
              placeholder={t.notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error ? <Notice tone="danger">{error}</Notice> : null}
        </form>
      )}
    </Modal>
  );
}
