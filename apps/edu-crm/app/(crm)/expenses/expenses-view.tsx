"use client";

import { Pencil, Plus, Receipt, RotateCcw, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { FilterBar, FilterDates, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import type { CategoryRow, PersonOption } from "@/lib/server/expenses";
import { formatDate, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import type { MethodOption } from "../payments/payment-dialog";
import { restoreExpenseAction, voidExpenseAction } from "./actions";
import { CategoriesTab } from "./categories-tab";
import type { ExpenseRow, PlanRow } from "./data";
import { ExpenseForm } from "./expense-form";
import { PlansTab } from "./plans-tab";
import { EXPENSE_TABS, type ExpenseTab } from "./tabs";
import { VoidRecordDialog } from "./void-dialog";

const t = uz.expenses;
const ALL = "all";
const PAGE_SIZE = 20;

export interface ExpensePerms {
  view: boolean;
  create: boolean;
  edit: boolean;
  categories: boolean;
}

export interface ExpensesViewProps {
  tab: ExpenseTab;
  from: string;
  to: string;
  month: string;
  rangeInvalid: boolean;
  rows: ExpenseRow[];
  plans: PlanRow[];
  categories: CategoryRow[];
  methods: MethodOption[];
  people: PersonOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  canAllBranches: boolean;
  perms: ExpensePerms;
}

export function ExpensesView(props: ExpensesViewProps) {
  const { perms } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = React.useState<ExpenseTab>(props.tab);
  const tabs = EXPENSE_TABS.filter((x) => (x === "categories" ? perms.categories || perms.view : perms.view));

  /** Tab o'zgarsa manzil yangilanadi (sahifa qayta yuklanmaydi), sana/oy o'zgarsa — server qayta o'qiydi */
  function query(next: Partial<Record<"tab" | "from" | "to" | "month", string>>) {
    const q = new URLSearchParams({ tab, from: props.from, to: props.to, month: props.month, ...next });
    return `${pathname}?${q.toString()}`;
  }
  function changeTab(v: string) {
    const next = v as ExpenseTab;
    setTab(next);
    window.history.replaceState(null, "", query({ tab: next }));
  }
  const navigate = (next: Partial<Record<"from" | "to" | "month", string>>) =>
    router.push(query(next), { scroll: false });
  /** Sarlavhadagi "qo'shish" tugmasi — tab ichidagi formani ochadi (har bosish yangi so'rov) */
  const [addRequest, setAddRequest] = React.useState(0);
  const listTab = tab === "variable" || tab === "fixed";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          perms.create && (listTab || tab === "plans") ? (
            <Button onClick={() => setAddRequest((n) => n + 1)}>
              <Plus /> {listTab ? t.add : t.addPlan}
            </Button>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          {tabs.map((x) => (
            <TabsTrigger key={x} value={x}>
              {t.tabs[x]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "variable" || tab === "fixed" ? (
        <ExpenseList key={tab} kind={tab} {...props} onRange={navigate} addRequest={addRequest} />
      ) : tab === "categories" ? (
        <CategoriesTab
          categories={props.categories}
          branches={props.branches}
          canAllBranches={props.canAllBranches}
          canEdit={perms.categories}
        />
      ) : (
        <PlansTab
          month={props.month}
          plans={props.plans}
          categories={props.categories}
          methods={props.methods}
          people={props.people}
          branches={props.branches}
          selectedBranch={props.selectedBranch}
          canEdit={perms.create}
          addRequest={addRequest}
          onMonth={(month) => navigate({ month })}
        />
      )}
    </div>
  );
}

function ExpenseList({
  kind,
  from,
  to,
  rangeInvalid,
  rows,
  categories,
  methods,
  people,
  branches,
  selectedBranch,
  perms,
  onRange,
  addRequest,
}: ExpensesViewProps & {
  kind: "variable" | "fixed";
  onRange: (next: { from?: string; to?: string }) => void;
  addRequest: number;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [person, setPerson] = React.useState(ALL);
  const [category, setCategory] = React.useState(ALL);
  const [method, setMethod] = React.useState(ALL);
  const [showVoided, setShowVoided] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseRow | null>(null);
  const [voiding, setVoiding] = React.useState<ExpenseRow | null>(null);
  const [, startTransition] = React.useTransition();
  const [seenAdd, setSeenAdd] = React.useState(addRequest);
  if (addRequest !== seenAdd) {
    setSeenAdd(addRequest);
    setEditing(null);
    setFormOpen(true);
  }

  const own = rows.filter((r) => r.kind === kind);
  const personOptions = [
    ...new Map(own.filter((r) => r.person).map((r) => [r.person!, r.personName ?? ""])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const q = query.trim().toLowerCase();
  const visible = own.filter((r) => {
    if (!showVoided && r.voided) return false;
    if (person !== ALL && r.person !== person) return false;
    if (category !== ALL && r.categoryId !== category) return false;
    if (method !== ALL && r.methodId !== method) return false;
    return !q || r.reason.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
  });
  const live = visible.filter((r) => !r.voided);
  const total = live.reduce((s, r) => s + r.amount, 0);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtered = !!q || person !== ALL || category !== ALL || method !== ALL || showVoided;
  const showBranch = branches.length > 1 && selectedBranch === "all";

  function clear() {
    setQuery("");
    setPerson(ALL);
    setCategory(ALL);
    setMethod(ALL);
    setShowVoided(false);
    setPage(1);
  }
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  function restore(r: ExpenseRow) {
    startTransition(async () => {
      const res = await restoreExpenseAction(r.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.restoredOk });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {rangeInvalid ? <Notice tone="warning">{t.rangeInvalid}</Notice> : null}

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => filter(setQuery)(e.target.value)} />
        <FilterDates from={from} to={to} onChange={onRange} fromLabel={t.from} toLabel={t.to} />
        <FilterSelect
          label={t.person}
          value={person}
          onValueChange={filter(setPerson)}
          options={[
            { value: ALL, label: t.allPeople },
            ...personOptions.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <FilterSelect
          label={t.category}
          value={category}
          onValueChange={filter(setCategory)}
          options={[
            { value: ALL, label: t.allCategories },
            ...categories.filter((c) => c.kind === "expense").map((c) => ({ value: c.id, label: c.name })),
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
          label={t.showVoided}
        />
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            <RotateCcw /> {t.clearFilters}
          </Button>
        ) : null}
        <FilterEnd>
          <span className="text-caption font-semibold text-foreground">
            {t.total(live.length, `${money(total)} ${uz.common.som}`)}
          </span>
        </FilterEnd>
      </FilterBar>

      <Card className="overflow-hidden">
        {shown.length ? (
          <>
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <Tr>
                    <Th>{t.colDate}</Th>
                    <Th>{t.colReason}</Th>
                    <Th>{t.colCategory}</Th>
                    <Th>{t.colPerson}</Th>
                    <Th>{t.colMethod}</Th>
                    <Th className="text-right">{t.colAmount}</Th>
                    <Th>{t.colCreatedBy}</Th>
                    {perms.edit ? <Th className="text-right">{uz.common.actions}</Th> : null}
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
                        <div className="truncate font-medium text-foreground" title={r.reason}>
                          {r.reason}
                        </div>
                        {r.voided ? (
                          <div className="mt-1 text-caption text-(--danger-fg)">
                            {t.voided}: {r.voided.reason}
                          </div>
                        ) : null}
                      </Td>
                      <Td>{r.categoryName}</Td>
                      <Td className="text-muted-foreground">{r.personName ?? "—"}</Td>
                      <Td className="text-muted-foreground">{r.methodName}</Td>
                      <Td
                        className={cn(
                          "text-right font-semibold whitespace-nowrap text-(--danger-fg)",
                          r.voided && "line-through",
                        )}
                      >
                        {money(r.amount)}
                      </Td>
                      <Td className="text-caption text-muted-foreground">{r.createdByName ?? "—"}</Td>
                      {perms.edit ? (
                        <Td>
                          <div className="flex justify-end gap-1">
                            {r.voided ? (
                              <Button
                                variant="icon"
                                size="icon"
                                aria-label={t.restore}
                                title={t.restore}
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
                                  aria-label={t.void}
                                  title={t.void}
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
          <EmptyState icon={<Receipt />} title={t.empty} description={t.emptyHint} />
        )}
      </Card>

      {perms.create || perms.edit ? (
        <ExpenseForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          defaultKind={kind}
          categories={categories}
          methods={methods}
          people={people}
          branches={branches}
          selectedBranch={selectedBranch}
          onSaved={() => router.refresh()}
        />
      ) : null}
      <VoidRecordDialog
        target={
          voiding ? { id: voiding.id, summary: `${voiding.reason} · ${money(voiding.amount)} ${uz.common.som}` } : null
        }
        title={t.voidTitle}
        successTitle={t.voidedOk}
        onClose={() => setVoiding(null)}
        onVoid={voidExpenseAction}
      />
    </div>
  );
}
