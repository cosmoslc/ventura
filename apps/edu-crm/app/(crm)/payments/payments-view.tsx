"use client";

import {
  Banknote,
  CalendarCheck,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate, formatMonth, money, signedMoney } from "@/lib/format";
import { uz } from "@/lib/uz";
import { restoreEntryAction } from "./actions";
import type { PaymentRow, StudentGroupOption } from "./data";
import { EditEntryDialog, VoidDialog } from "./finance-dialogs";
import { GroupChip, MoreRows, StudentsTable } from "../student-table";
import { useQuickOpen } from "../use-quick-open";
import { type MethodOption, PaymentDialog, type PickStudent } from "./payment-dialog";
import type { FinancePerms } from "./perms";

const t = uz.payments;
const ALL = "all";
const KIND_TONE = {
  payment: "success",
  refund: "danger",
  discount: "info",
  correction: "neutral",
  writeoff: "neutral",
} as const;
/** Jadvalda dastlab (va har "yana" bosilganda) ko'rinadigan qatorlar */
const PAGE_ROWS = 30;
const SORTS = ["new", "old", "high", "low"] as const;
type Sort = (typeof SORTS)[number];
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
  const [sort, setSort] = React.useState<Sort>("new");
  const [limit, setLimit] = React.useState(PAGE_ROWS);
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

  const sorted = [...visible].sort((a, b) => {
    if (sort === "high") return effect(b) - effect(a);
    if (sort === "low") return effect(a) - effect(b);
    const byDate = a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
    return sort === "old" ? byDate : -byDate;
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
    <div className="space-y-4">
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
        <StatCard icon={<Banknote />} tone={2} label={t.kpiIncome} value={`${money(incomeSum)} ${uz.common.som}`} />
        <StatCard icon={<Undo2 />} tone={4} label={t.kpiRefunds} value={`${money(refundSum)} ${uz.common.som}`} />
        <StatCard
          icon={<Wallet />}
          tone={1}
          label={t.kpiNet}
          value={`${money(incomeSum - refundSum)} ${uz.common.som}`}
        />
        <StatCard
          icon={<CalendarCheck />}
          tone={3}
          label={`${t.kpiToday} (${formatDate(today)})`}
          value={`${money(todayIncome.sum)} ${uz.common.som}`}
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
        <FilterSelect
          label={t.sort}
          value={sort}
          onValueChange={(v) => {
            setSort(v as Sort);
            setLimit(PAGE_ROWS);
          }}
          className="sm:w-56"
          options={SORTS.map((s) => ({ value: s, label: t.sorts[s] }))}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{t.count(visible.length)}</span>
        </FilterEnd>
      </FilterBar>

      {sorted.length ? (
        <StudentsTable
          rows={sorted.slice(0, limit)}
          rowKey={(r) => r.id}
          numbered
          student={(r) => ({
            name: r.studentName,
            href: `/students/${r.studentId}`,
            sub: displayPhone(r.studentPhone),
          })}
          studentHeader={t.colStudent}
          minWidth={1000}
          rowClassName={(r) => (r.voided ? "opacity-60" : undefined)}
          columns={[
            {
              key: "group",
              headClassName: "w-48",
              header: t.colGroup,
              cell: (r) =>
                r.groupId ? (
                  <GroupChip id={r.groupId} name={r.groupName ?? ""} />
                ) : (
                  <span className="text-muted-foreground">{t.noGroup}</span>
                ),
            },
            {
              key: "date",
              headClassName: "w-28",
              header: t.colDate,
              className: "whitespace-nowrap",
              cell: (r) => formatDate(r.date),
            },
            {
              key: "month",
              headClassName: "w-36",
              header: t.colMonth,
              className: "whitespace-nowrap",
              cell: (r) => (r.month ? formatMonth(r.month) : <span className="text-muted-foreground">—</span>),
            },
            {
              key: "method",
              headClassName: "w-36",
              header: t.colMethod,
              cell: (r) => (
                <>
                  <Badge tone={KIND_TONE[r.kind]}>{t.kinds[r.kind]}</Badge>
                  {r.methodName ? <div className="mt-1 text-caption text-muted-foreground">{r.methodName}</div> : null}
                  {r.voided ? (
                    <div className="mt-1 text-caption text-(--danger-fg)">
                      {t.voided}: {r.voided.reason}
                    </div>
                  ) : null}
                </>
              ),
            },
            {
              key: "amount",
              headClassName: "w-32",
              header: t.colAmount,
              align: "right",
              className: "font-semibold whitespace-nowrap",
              cell: (r) => (
                <span
                  className={cn(
                    r.cash > 0 ? "text-(--success-fg)" : r.cash < 0 ? "text-(--danger-fg)" : "text-muted-foreground",
                    r.voided && "line-through",
                  )}
                >
                  {signedMoney(effect(r))}
                </span>
              ),
            },
            {
              key: "staff",
              headClassName: "w-32",
              header: t.colStaff,
              className: "text-caption text-muted-foreground",
              cell: (r) => r.createdByName ?? "—",
            },
            {
              key: "actions",
              headClassName: "w-14",
              header: "",
              align: "right",
              cell: (r) => {
                const canPrint = r.kind === "payment" && perms.receipt && !r.voided;
                const canEdit = !r.voided && r.kind !== "correction" && r.kind !== "writeoff" && perms.edit;
                const canVoid =
                  !r.voided && (r.kind === "correction" || r.kind === "writeoff" ? perms.correct : perms.void);
                const canRestore = !!r.voided && perms.restore;
                if (!canPrint && !canEdit && !canVoid && !canRestore) return null;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="subtle"
                        size="icon-sm"
                        title={uz.common.actions}
                        aria-label={`${r.studentName} — ${uz.common.actions}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {canPrint ? (
                        <DropdownMenuItem
                          onSelect={() => window.open(`/payments/${r.id}/receipt`, "_blank", "noopener,noreferrer")}
                        >
                          <Printer /> {t.receiptPrint}
                        </DropdownMenuItem>
                      ) : null}
                      {canEdit ? (
                        <DropdownMenuItem onSelect={() => setEditing(r)}>
                          <Pencil /> {uz.common.edit}
                        </DropdownMenuItem>
                      ) : null}
                      {canRestore ? (
                        <DropdownMenuItem onSelect={() => restore(r)}>
                          <RotateCcw /> {t.restore}
                        </DropdownMenuItem>
                      ) : null}
                      {canVoid ? (
                        <>
                          {canPrint || canEdit ? <DropdownMenuSeparator /> : null}
                          <DropdownMenuItem danger onSelect={() => setVoiding(r)}>
                            <Trash2 /> {t.void}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              },
            },
          ]}
          footer={
            sorted.length > limit ? (
              <MoreRows onClick={() => setLimit((l) => l + PAGE_ROWS)}>
                {t.showMore(Math.min(PAGE_ROWS, sorted.length - limit))}
              </MoreRows>
            ) : null
          }
          empty={null}
        />
      ) : (
        <Card className="overflow-hidden">
          <EmptyState icon={<Wallet />} title={t.empty} description={t.emptyHint} />
        </Card>
      )}

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
