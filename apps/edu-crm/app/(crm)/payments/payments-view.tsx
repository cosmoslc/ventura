"use client";

import { Banknote, CalendarCheck, Pencil, Plus, Printer, RotateCcw, Search, Trash2, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate, formatMonth, money, signedMoney } from "@/lib/format";
import { uz } from "@/lib/uz";
import { restoreEntryAction } from "./actions";
import type { PaymentRow, StudentGroupOption } from "./data";
import { EditEntryDialog, VoidDialog } from "./finance-dialogs";
import { type MethodOption, PaymentDialog, type PickStudent } from "./payment-dialog";
import type { FinancePerms } from "./perms";

const t = uz.payments;
const ALL = "all";
const KINDS = ["payment", "refund", "discount", "correction"] as const;
const KIND_TONE = { payment: "success", refund: "danger", discount: "info", correction: "neutral" } as const;
const effect = (e: PaymentRow) => (e.kind === "refund" ? -e.amount : e.amount);

export function PaymentsView({
  rows,
  today,
  todayIncome,
  from,
  to,
  rangeInvalid,
  methods,
  students,
  groups,
  perms,
  maxDiscountPercent,
}: {
  rows: PaymentRow[];
  today: string;
  todayIncome: { sum: number; count: number };
  from: string;
  to: string;
  rangeInvalid: boolean;
  methods: MethodOption[];
  students: PickStudent[];
  groups: StudentGroupOption[];
  perms: FinancePerms;
  maxDiscountPercent: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [kind, setKind] = React.useState(ALL);
  const [method, setMethod] = React.useState(ALL);
  const [group, setGroup] = React.useState(ALL);
  const [query, setQuery] = React.useState("");
  const [showVoided, setShowVoided] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [voiding, setVoiding] = React.useState<PaymentRow | null>(null);
  const [editing, setEditing] = React.useState<PaymentRow | null>(null);
  const [, startTransition] = React.useTransition();

  const live = rows.filter((r) => !r.voided);
  const income = live.filter((r) => r.kind === "payment");
  const refunds = live.filter((r) => r.kind === "refund");
  const incomeSum = income.reduce((s, r) => s + r.amount, 0);
  const refundSum = refunds.reduce((s, r) => s + r.amount, 0);
  const byMethod = methods
    .map((m) => ({ ...m, sum: live.filter((r) => r.methodId === m.id).reduce((s, r) => s + r.cash, 0) }))
    .filter((m) => m.sum !== 0);

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = rows.filter((r) => {
    if (!showVoided && r.voided) return false;
    if (kind !== ALL && r.kind !== kind) return false;
    if (method !== ALL && r.methodId !== method) return false;
    if (group !== ALL && r.groupId !== group) return false;
    if (!q) return true;
    return (
      r.studentName.toLowerCase().includes(q) ||
      (r.groupName ?? "").toLowerCase().includes(q) ||
      (!!digits && (r.studentPhone.includes(digits) || String(r.receiptNo ?? "").includes(digits)))
    );
  });

  function setRange(next: { from?: string; to?: string }) {
    const f = next.from ?? from;
    const tt = next.to ?? to;
    if (f && tt) router.push(`${pathname}?from=${f}&to=${tt}`, { scroll: false });
  }

  function restore(e: PaymentRow) {
    startTransition(async () => {
      const res = await restoreEntryAction(e.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.restoredOk });
      router.refresh();
    });
  }

  const groupNames = [
    ...new Map(rows.filter((r) => r.groupId).map((r) => [r.groupId!, r.groupName ?? ""])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          perms.create ? (
            <Button onClick={() => setPayOpen(true)}>
              <Plus /> {t.add}
            </Button>
          ) : null
        }
      />

      {rangeInvalid ? <Notice tone="warning">{t.rangeInvalid}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Banknote />}
          tone={2}
          label={t.kpiIncome}
          value={`${money(incomeSum)} ${uz.common.som}`}
          hint={t.kpiIncomeHint(income.length)}
        />
        <StatCard
          icon={<Undo2 />}
          tone={4}
          label={t.kpiRefunds}
          value={`${money(refundSum)} ${uz.common.som}`}
          hint={t.kpiRefundsHint(refunds.length)}
        />
        <StatCard
          icon={<Wallet />}
          tone={1}
          label={t.kpiNet}
          value={`${money(incomeSum - refundSum)} ${uz.common.som}`}
          hint={t.kpiNetHint}
        />
        <StatCard
          icon={<CalendarCheck />}
          tone={3}
          label={`${t.kpiToday} (${formatDate(today)})`}
          value={`${money(todayIncome.sum)} ${uz.common.som}`}
          hint={t.kpiTodayHint(todayIncome.count)}
        />
      </div>

      {byMethod.length ? (
        <div className="flex flex-wrap gap-2">
          {byMethod.map((m) => (
            <Badge key={m.id} tone="neutral">
              {m.name}: {money(m.sum)} {uz.common.som}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="pay-from">{t.from}</Label>
          <Input id="pay-from" type="date" value={from} max={to} onChange={(e) => setRange({ from: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="pay-to">{t.to}</Label>
          <Input id="pay-to" type="date" value={to} min={from} onChange={(e) => setRange({ to: e.target.value })} />
        </div>
        <div>
          <Label>{t.kind}</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-full" aria-label={t.kind}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.allKinds}</SelectItem>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t.kinds[k]}
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
        <div>
          <Label>{t.group}</Label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="w-full" aria-label={t.group}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{uz.debtors.allGroups}</SelectItem>
              {groupNames.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <ChoiceField
            control={<Checkbox checked={showVoided} onCheckedChange={(v) => setShowVoided(v === true)} />}
            label={t.showVoided}
          />
          <span className="text-caption text-muted-foreground">{t.count(visible.length)}</span>
        </div>
        {visible.length ? (
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <Tr>
                  <Th>{t.colReceipt}</Th>
                  <Th>{t.colDate}</Th>
                  <Th>{t.colStudent}</Th>
                  <Th>{t.colGroup}</Th>
                  <Th>{t.colMethod}</Th>
                  <Th className="text-right">{t.colAmount}</Th>
                  <Th>{t.colStaff}</Th>
                  <Th className="text-right">{uz.common.actions}</Th>
                </Tr>
              </THead>
              <TBody>
                {visible.map((r) => (
                  <Tr key={r.id} className={cn(r.voided && "opacity-60")}>
                    <Td className="font-mono text-caption">{r.receiptNo ?? "—"}</Td>
                    <Td className="whitespace-nowrap">{formatDate(r.date)}</Td>
                    <Td>
                      <Link
                        href={`/students/${r.studentId}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {r.studentName}
                      </Link>
                      <div className="text-caption text-muted-foreground">{displayPhone(r.studentPhone)}</div>
                    </Td>
                    <Td>
                      {r.groupName ?? t.noGroup}
                      {r.month ? (
                        <div className="text-caption text-muted-foreground">{formatMonth(r.month)}</div>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={KIND_TONE[r.kind]}>{t.kinds[r.kind]}</Badge>
                      {r.methodName ? (
                        <div className="mt-1 text-caption text-muted-foreground">{r.methodName}</div>
                      ) : null}
                      {r.voided ? (
                        <div className="mt-1 text-caption text-(--danger-fg)">
                          {t.voided}: {r.voided.reason}
                        </div>
                      ) : null}
                    </Td>
                    <Td
                      className={cn(
                        "text-right font-semibold whitespace-nowrap",
                        r.cash > 0
                          ? "text-(--success-fg)"
                          : r.cash < 0
                            ? "text-(--danger-fg)"
                            : "text-muted-foreground",
                        r.voided && "line-through",
                      )}
                    >
                      {signedMoney(effect(r))}
                    </Td>
                    <Td className="text-caption text-muted-foreground">{r.createdByName ?? "—"}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {r.kind === "payment" && perms.receipt && !r.voided ? (
                          <Button variant="icon" size="icon" aria-label={t.receipt} asChild>
                            <a href={`/payments/${r.id}/receipt`} target="_blank" rel="noreferrer">
                              <Printer />
                            </a>
                          </Button>
                        ) : null}
                        {!r.voided && r.kind !== "correction" && perms.edit ? (
                          <Button variant="icon" size="icon" aria-label={uz.common.edit} onClick={() => setEditing(r)}>
                            <Pencil />
                          </Button>
                        ) : null}
                        {!r.voided && (r.kind === "correction" ? perms.correct : perms.void) ? (
                          <Button variant="icon" size="icon" aria-label={t.void} onClick={() => setVoiding(r)}>
                            <Trash2 />
                          </Button>
                        ) : null}
                        {r.voided && perms.restore ? (
                          <Button variant="icon" size="icon" aria-label={t.restore} onClick={() => restore(r)}>
                            <RotateCcw />
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<Wallet />} title={t.empty} description={t.emptyHint} />
        )}
      </Card>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        students={students}
        methods={methods}
        maxDiscountPercent={maxDiscountPercent}
      />
      <VoidDialog entry={voiding} onClose={() => setVoiding(null)} />
      <EditEntryDialog entry={editing} onClose={() => setEditing(null)} groups={groups} methods={methods} />
    </div>
  );
}
