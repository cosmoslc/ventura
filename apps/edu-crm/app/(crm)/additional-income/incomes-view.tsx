"use client";

import { Coins, Hash, Pencil, PiggyBank, Plus, RotateCcw, Trash2, Trophy } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { FilterBar, FilterDates, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import type { CategoryRow } from "@/lib/server/expenses";
import { formatDate, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { VoidRecordDialog } from "../expenses/void-dialog";
import type { MethodOption } from "../payments/payment-dialog";
import { restoreIncomeAction, voidIncomeAction } from "./actions";
import type { IncomeRow } from "./data";
import { IncomeForm } from "./income-form";

const t = uz.incomes;
const ALL = "all";
const PAGE_SIZE = 20;

export function IncomesView({
  rows,
  from,
  to,
  rangeInvalid,
  categories,
  methods,
  branches,
  selectedBranch,
  canWrite,
}: {
  rows: IncomeRow[];
  from: string;
  to: string;
  rangeInvalid: boolean;
  categories: CategoryRow[];
  methods: MethodOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(ALL);
  const [method, setMethod] = React.useState(ALL);
  const [showVoided, setShowVoided] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<IncomeRow | null>(null);
  const [voiding, setVoiding] = React.useState<IncomeRow | null>(null);
  const [, startTransition] = React.useTransition();

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (!showVoided && r.voided) return false;
    if (category !== ALL && r.categoryId !== category) return false;
    if (method !== ALL && r.methodId !== method) return false;
    return !q || r.title.toLowerCase().includes(q) || (r.payer ?? "").toLowerCase().includes(q);
  });
  const live = visible.filter((r) => !r.voided);
  const total = live.reduce((s, r) => s + r.amount, 0);
  const byCategory = new Map<string, number>();
  for (const r of live) byCategory.set(r.categoryName, (byCategory.get(r.categoryName) ?? 0) + r.amount);
  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const showBranch = branches.length > 1 && selectedBranch === "all";
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  function setRange(next: { from?: string; to?: string }) {
    const f = next.from ?? from;
    const tt = next.to ?? to;
    if (f && tt) router.push(`${pathname}?from=${f}&to=${tt}`, { scroll: false });
  }

  function restore(r: IncomeRow) {
    startTransition(async () => {
      const res = await restoreIncomeAction(r.id);
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.restoredOk });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> {t.add}
            </Button>
          ) : null
        }
      />

      {rangeInvalid ? <Notice tone="warning">{uz.expenses.rangeInvalid}</Notice> : null}
      {canWrite && !categories.some((c) => c.active) ? <Notice tone="warning">{t.noCategories}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<PiggyBank />}
          tone={2}
          label={t.kpiTotal}
          value={`${money(total)} ${uz.common.som}`}
          hint={t.kpiTotalHint(live.length)}
        />
        <StatCard icon={<Hash />} tone={1} label={t.kpiCount} value={String(live.length)} hint={t.kpiCountHint} />
        <StatCard
          icon={<Trophy />}
          tone={3}
          label={t.kpiTop}
          value={top ? top[0] : t.kpiTopNone}
          hint={top ? `${money(top[1])} ${uz.common.som}` : undefined}
        />
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => filter(setQuery)(e.target.value)} />
        <FilterDates from={from} to={to} onChange={setRange} fromLabel={uz.expenses.from} toLabel={uz.expenses.to} />
        <FilterSelect
          label={uz.expenses.category}
          value={category}
          onValueChange={filter(setCategory)}
          options={[
            { value: ALL, label: uz.expenses.allCategories },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterSelect
          label={t.method}
          value={method}
          onValueChange={filter(setMethod)}
          options={[{ value: ALL, label: t.allMethods }, ...methods.map((m) => ({ value: m.id, label: m.name }))]}
        />
        <ChoiceField
          control={<Checkbox checked={showVoided} onCheckedChange={(v) => filter(setShowVoided)(v === true)} />}
          label={uz.expenses.showVoided}
        />
      </FilterBar>

      <Card className="overflow-hidden">
        {shown.length ? (
          <>
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <Tr>
                    <Th>{t.colDate}</Th>
                    <Th>{t.colTitle}</Th>
                    <Th>{t.colCategory}</Th>
                    <Th>{t.colPayer}</Th>
                    <Th>{t.colMethod}</Th>
                    <Th className="text-right">{t.colAmount}</Th>
                    <Th>{t.colCreatedBy}</Th>
                    {canWrite ? <Th className="text-right">{uz.common.actions}</Th> : null}
                  </Tr>
                </THead>
                <TBody>
                  {shown.map((r) => (
                    <Tr key={r.id} className={cn(r.voided && "opacity-60")}>
                      <Td className="whitespace-nowrap">
                        {formatDate(r.date)}
                        {showBranch ? <div className="text-caption text-muted-foreground">{r.branchName}</div> : null}
                      </Td>
                      <Td className="max-w-72">
                        <div className="truncate font-medium text-foreground" title={r.title}>
                          {r.title}
                        </div>
                        {r.voided ? (
                          <div className="mt-1 text-caption text-(--danger-fg)">
                            {uz.expenses.voided}: {r.voided.reason}
                          </div>
                        ) : null}
                      </Td>
                      <Td>{r.categoryName}</Td>
                      <Td className="text-muted-foreground">{r.payer ?? "—"}</Td>
                      <Td className="text-muted-foreground">{r.methodName}</Td>
                      <Td
                        className={cn(
                          "text-right font-semibold whitespace-nowrap text-(--success-fg)",
                          r.voided && "line-through",
                        )}
                      >
                        +{money(r.amount)}
                      </Td>
                      <Td className="text-caption text-muted-foreground">{r.createdByName ?? "—"}</Td>
                      {canWrite ? (
                        <Td>
                          <div className="flex justify-end gap-1">
                            {r.voided ? (
                              <Button
                                variant="icon"
                                size="icon"
                                aria-label={uz.expenses.restore}
                                title={uz.expenses.restore}
                                onClick={() => restore(r)}
                              >
                                <RotateCcw />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="icon"
                                  size="icon"
                                  aria-label={uz.common.edit}
                                  title={uz.common.edit}
                                  onClick={() => {
                                    setEditing(r);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="icon"
                                  size="icon"
                                  className="text-destructive-text"
                                  aria-label={uz.expenses.void}
                                  title={uz.expenses.void}
                                  onClick={() => setVoiding(r)}
                                >
                                  <Trash2 />
                                </Button>
                              </>
                            )}
                          </div>
                        </Td>
                      ) : null}
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            {pageCount > 1 ? (
              <Pagination
                page={current}
                pageCount={pageCount}
                total={visible.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null}
          </>
        ) : (
          <EmptyState icon={<Coins />} title={t.empty} description={t.emptyHint} />
        )}
      </Card>

      {canWrite ? (
        <IncomeForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          categories={categories}
          methods={methods}
          branches={branches}
          selectedBranch={selectedBranch}
          onSaved={() => router.refresh()}
        />
      ) : null}
      <VoidRecordDialog
        target={
          voiding ? { id: voiding.id, summary: `${voiding.title} · ${money(voiding.amount)} ${uz.common.som}` } : null
        }
        title={t.voidTitle}
        successTitle={t.voidedOk}
        onClose={() => setVoiding(null)}
        onVoid={voidIncomeAction}
      />
    </div>
  );
}
