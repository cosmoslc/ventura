"use client";

import { Banknote, CalendarCheck, Pencil, Plus, Printer, RotateCcw, Trash2, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate, formatMonth, money, signedMoney } from "@/lib/format";
import { uz } from "@/lib/uz";
import { restoreEntryAction } from "./actions";
import type { PaymentRow, StudentGroupOption } from "./data";
import { EditEntryDialog, VoidDialog } from "./finance-dialogs";
import { useQuickOpen } from "../use-quick-open";
import { type MethodOption, PaymentDialog, type PickStudent } from "./payment-dialog";
import type { FinancePerms } from "./perms";

const t = uz.payments;
const ALL = "all";
const KIND_TONE = { payment: "success", refund: "danger", discount: "info", correction: "neutral" } as const;
const effect = (e: PaymentRow) => (e.kind === "refund" ? -e.amount : e.amount);

export function PaymentsView({
  rows,
  today,
  todayIncome,
  month,
  months,
  methods,
  students,
  groups,
  perms,
  maxDiscountPercent,
}: {
  rows: PaymentRow[];
  today: string;
  todayIncome: { sum: number; count: number };
  /** Tanlangan oy "YYYY-MM" */
  month: string;
  months: string[];
  methods: MethodOption[];
  students: PickStudent[];
  groups: StudentGroupOption[];
  perms: FinancePerms;
  maxDiscountPercent: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [group, setGroup] = React.useState(ALL);
  const [query, setQuery] = React.useState("");
  const [payOpen, setPayOpen] = React.useState(false);
  useQuickOpen(() => setPayOpen(true), perms.create);
  const [voiding, setVoiding] = React.useState<PaymentRow | null>(null);
  const [editing, setEditing] = React.useState<PaymentRow | null>(null);
  const [, startTransition] = React.useTransition();

  const live = rows.filter((r) => !r.voided);
  const income = live.filter((r) => r.kind === "payment");
  const refunds = live.filter((r) => r.kind === "refund");
  const incomeSum = income.reduce((s, r) => s + r.amount, 0);
  const refundSum = refunds.reduce((s, r) => s + r.amount, 0);

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = rows.filter((r) => {
    // Bekor qilinganlar ro'yxatda ko'rinmaydi (o'quvchi profilidagi "To'lovlar" tabida ko'rinadi va tiklanadi)
    if (r.voided) return false;
    if (group !== ALL && r.groupId !== group) return false;
    if (!q) return true;
    return (
      r.studentName.toLowerCase().includes(q) ||
      (r.groupName ?? "").toLowerCase().includes(q) ||
      (!!digits && (r.studentPhone.includes(digits) || String(r.receiptNo ?? "").includes(digits)))
    );
  });

  const setMonth = (m: string) => router.push(`${pathname}?month=${m}`, { scroll: false });

  function restore(e: PaymentRow) {
    startTransition(async () => {
      const res = await restoreEntryAction(e.id);
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
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

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={t.monthFilter}
          value={month}
          onValueChange={setMonth}
          className="sm:w-44"
          options={months.map((m) => ({ value: m, label: formatMonth(m) }))}
        />
        <FilterSelect
          label={t.group}
          value={group}
          onValueChange={setGroup}
          options={[
            { value: ALL, label: uz.debtors.allGroups },
            ...groupNames.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{t.count(visible.length)}</span>
        </FilterEnd>
      </FilterBar>

      <Card className="overflow-hidden">
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
