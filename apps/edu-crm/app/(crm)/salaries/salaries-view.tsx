"use client";

import {
  Banknote,
  Briefcase,
  Coins,
  Hash,
  Pencil,
  PiggyBank,
  Plus,
  RotateCcw,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { FilterBar, FilterDates, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import type { PersonOption } from "@/lib/server/expenses";
import type { Payroll, PayrollRow } from "@/lib/server/payroll";
import { displayPhone, formatDate, formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { VoidRecordDialog } from "../expenses/void-dialog";
import type { MethodOption } from "../payments/payment-dialog";
import { restoreSalaryEntryAction, voidSalaryEntryAction } from "./actions";
import type { SalaryEntryRow } from "./data";
import { type SalaryFormState, SalaryForm, type SalaryPerms } from "./salary-form";

const t = uz.salaries;
const ALL = "all";
const PAGE_SIZE = 50;
const KINDS = ["salary", "advance", "bonus", "penalty"] as const;
const KIND_TONE = { salary: "success", advance: "info", bonus: "warning", penalty: "danger" } as const;
const som = (n: number) => `${money(n)} ${uz.common.som}`;
const roleLabel = (r: "teacher" | "support" | "staff") =>
  r === "teacher" ? t.roleTeacher : r === "support" ? t.roleSupport : t.roleStaff;

export function SalariesView({
  tab: initialTab,
  from,
  to,
  rangeInvalid,
  month,
  months,
  entries,
  payroll,
  people,
  methods,
  perms,
}: {
  tab: "list" | "calc";
  from: string;
  to: string;
  rangeInvalid: boolean;
  month: string;
  months: string[];
  entries: SalaryEntryRow[];
  payroll: Payroll;
  people: PersonOption[];
  methods: MethodOption[];
  perms: SalaryPerms;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = React.useState(initialTab);
  const [form, setForm] = React.useState<SalaryFormState | null>(null);
  const canWrite = perms.salary || perms.advance || perms.adjust;

  const query = (next: Partial<Record<"tab" | "from" | "to" | "month", string>>) =>
    `${pathname}?${new URLSearchParams({ tab, from, to, month, ...next }).toString()}`;
  function changeTab(v: string) {
    const next = v as "list" | "calc";
    setTab(next);
    window.history.replaceState(null, "", query({ tab: next }));
  }
  const navigate = (next: Partial<Record<"from" | "to" | "month", string>>) =>
    router.push(query(next), { scroll: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          canWrite ? (
            <Button onClick={() => setForm({ editing: null, person: null, month, amount: null })}>
              <Plus /> {t.add}
            </Button>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="list">{t.tabs.list}</TabsTrigger>
          <TabsTrigger value="calc">{t.tabs.calc}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "list" ? (
        <ListTab
          entries={entries}
          from={from}
          to={to}
          rangeInvalid={rangeInvalid}
          perms={perms}
          onRange={navigate}
          onEdit={(e) => setForm({ editing: e, person: e.person, month: e.month, amount: e.amount })}
        />
      ) : (
        <CalcTab
          payroll={payroll}
          months={months}
          canPay={canWrite}
          onMonth={(m) => navigate({ month: m })}
          onPay={(r) =>
            setForm({
              editing: null,
              person: `${r.kind}:${r.id}`,
              month: payroll.month,
              amount: r.balance.remaining > 0 ? r.balance.remaining : null,
            })
          }
        />
      )}

      {canWrite ? (
        <SalaryForm
          state={form}
          onClose={() => setForm(null)}
          people={people}
          methods={methods}
          months={months}
          perms={perms}
          payroll={payroll}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

/* ---------- Ish haqi ro'yxati ---------- */

function ListTab({
  entries,
  from,
  to,
  rangeInvalid,
  perms,
  onRange,
  onEdit,
}: {
  entries: SalaryEntryRow[];
  from: string;
  to: string;
  rangeInvalid: boolean;
  perms: SalaryPerms;
  onRange: (next: { from?: string; to?: string }) => void;
  onEdit: (e: SalaryEntryRow) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState(ALL);
  const [showVoided, setShowVoided] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [voiding, setVoiding] = React.useState<SalaryEntryRow | null>(null);
  const [, startTransition] = React.useTransition();
  const can = (k: SalaryEntryRow["kind"]) =>
    k === "salary" ? perms.salary : k === "advance" ? perms.advance : perms.adjust;

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = entries.filter((e) => {
    if (!showVoided && e.voided) return false;
    if (kind !== ALL && e.kind !== kind) return false;
    return !q || e.personName.toLowerCase().includes(q) || (!!digits && e.personPhone.includes(digits));
  });
  const cash = visible.filter((e) => !e.voided && (e.kind === "salary" || e.kind === "advance"));
  const paid = cash.reduce((s, e) => s + e.amount, 0);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  function restore(e: SalaryEntryRow) {
    startTransition(async () => {
      const res = await restoreSalaryEntryAction(e.id);
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.restoredOk });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {rangeInvalid ? <Notice tone="warning">{t.rangeInvalid}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Banknote />} tone={2} label={t.kpiPaid} value={som(paid)} hint={t.kpiPaidHint} />
        <StatCard icon={<Hash />} tone={1} label={t.kpiCount} value={String(cash.length)} />
        <StatCard
          icon={<TrendingUp />}
          tone={4}
          label={t.kpiAvg}
          value={som(cash.length ? Math.round(paid / cash.length) : 0)}
        />
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => filter(setQuery)(e.target.value)} />
        <FilterDates from={from} to={to} onChange={onRange} fromLabel={t.from} toLabel={t.to} />
        <FilterSelect
          label={t.kind}
          value={kind}
          onValueChange={filter(setKind)}
          options={[{ value: ALL, label: t.allKinds }, ...KINDS.map((k) => ({ value: k, label: t.kinds[k] }))]}
        />
        <ChoiceField
          control={<Checkbox checked={showVoided} onCheckedChange={(v) => filter(setShowVoided)(v === true)} />}
          label={t.showVoided}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{t.count(visible.length)}</span>
        </FilterEnd>
      </FilterBar>

      <Card className="overflow-hidden">
        {shown.length ? (
          <>
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <Tr>
                    <Th>{t.colPerson}</Th>
                    <Th>{t.colDate}</Th>
                    <Th>{t.colKind}</Th>
                    <Th>{t.colMonth}</Th>
                    <Th className="text-right">{t.colAmount}</Th>
                    <Th>{t.colMethod}</Th>
                    <Th>{t.colNote}</Th>
                    <Th>{t.colCreatedBy}</Th>
                    <Th className="text-right">{uz.common.actions}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {shown.map((e) => (
                    <Tr key={e.id} className={cn(e.voided && "opacity-60")}>
                      <Td>
                        <div className="font-medium text-foreground">{e.personName}</div>
                        <div className="text-caption text-muted-foreground">
                          {roleLabel(e.role)}
                          {e.personPhone ? ` · ${displayPhone(e.personPhone)}` : ""}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(e.date)}</Td>
                      <Td>
                        <Badge tone={KIND_TONE[e.kind]}>{t.kinds[e.kind]}</Badge>
                        {e.voided ? (
                          <div className="mt-1 text-caption text-(--danger-fg)">
                            {t.voided}: {e.voided.reason}
                          </div>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{formatMonth(e.month)}</Td>
                      <Td
                        className={cn(
                          "text-right font-semibold whitespace-nowrap",
                          e.kind === "penalty" ? "text-(--danger-fg)" : "text-foreground",
                          e.voided && "line-through",
                        )}
                      >
                        {e.kind === "penalty" ? "−" : ""}
                        {money(e.amount)}
                      </Td>
                      <Td className="text-muted-foreground">{e.methodName ?? "—"}</Td>
                      <Td className="max-w-56 truncate text-caption text-muted-foreground" title={e.note ?? undefined}>
                        {e.note ?? "—"}
                      </Td>
                      <Td className="text-caption text-muted-foreground">{e.createdByName ?? "—"}</Td>
                      <Td>
                        {can(e.kind) ? (
                          <div className="flex justify-end gap-1">
                            {e.voided ? (
                              <Button
                                variant="icon"
                                size="icon"
                                aria-label={t.restore}
                                title={t.restore}
                                onClick={() => restore(e)}
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
                                  onClick={() => onEdit(e)}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="icon"
                                  size="icon"
                                  className="text-destructive-text"
                                  aria-label={t.void}
                                  title={t.void}
                                  onClick={() => setVoiding(e)}
                                >
                                  <Trash2 />
                                </Button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </Td>
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
          <EmptyState icon={<Wallet />} title={t.empty} description={t.emptyHint} />
        )}
      </Card>

      <VoidRecordDialog
        target={
          voiding
            ? { id: voiding.id, summary: `${voiding.personName} · ${t.kinds[voiding.kind]} · ${som(voiding.amount)}` }
            : null
        }
        title={t.voidTitle}
        successTitle={t.voidedOk}
        onClose={() => setVoiding(null)}
        onVoid={voidSalaryEntryAction}
      />
    </div>
  );
}

/* ---------- Maosh hisob-kitobi ---------- */

function CalcTab({
  payroll,
  months,
  canPay,
  onMonth,
  onPay,
}: {
  payroll: Payroll;
  months: string[];
  canPay: boolean;
  onMonth: (m: string) => void;
  onPay: (r: PayrollRow) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState(ALL);
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const rows = payroll.rows.filter((r) => {
    if (role === "teachers" && r.kind !== "teacher") return false;
    if (role === "staff" && r.kind !== "user") return false;
    return !q || r.name.toLowerCase().includes(q) || (!!digits && r.phone.includes(digits));
  });
  const { revenue, share, center } = payroll.totals;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<PiggyBank />} tone={2} label={t.kpiRevenue} value={som(revenue)} hint={t.kpiRevenueHint} />
        <StatCard icon={<Coins />} tone={4} label={t.kpiShare} value={som(share)} hint={t.kpiShareHint} />
        <StatCard
          icon={<Briefcase />}
          tone={1}
          label={t.kpiCenter}
          value={`${center < 0 ? "−" : ""}${som(Math.abs(center))}`}
          hint={t.kpiCenterHint}
        />
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={t.month}
          value={payroll.month}
          onValueChange={onMonth}
          className="sm:w-44"
          options={months.map((m) => ({ value: m, label: formatMonth(m) }))}
        />
        <FilterSelect
          label={t.roleFilter}
          value={role}
          onValueChange={setRole}
          options={[
            { value: ALL, label: t.allRoles },
            { value: "teachers", label: t.teachersOnly },
            { value: "staff", label: t.staffOnly },
          ]}
        />
      </FilterBar>

      <Card className="overflow-hidden">
        {rows.length ? (
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <Tr>
                  <Th>{t.colPerson}</Th>
                  <Th>{t.colRole}</Th>
                  <Th>{t.colType}</Th>
                  <Th className="text-right">{t.colAccrued}</Th>
                  <Th className="text-right">{t.colBonus}</Th>
                  <Th className="text-right">{t.colAdvance}</Th>
                  <Th className="text-right">{t.colPaid}</Th>
                  <Th className="text-right">{t.colRemaining}</Th>
                  {canPay ? <Th className="text-right">{uz.common.actions}</Th> : null}
                </Tr>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const b = r.balance;
                  const adj = b.bonus - b.penalty;
                  return (
                    <Tr key={`${r.kind}:${r.id}`}>
                      <Td>
                        <div className="font-medium text-foreground">{r.name}</div>
                        {r.phone ? (
                          <div className="text-caption text-muted-foreground">{displayPhone(r.phone)}</div>
                        ) : null}
                      </Td>
                      <Td className="text-muted-foreground">{roleLabel(r.kind === "teacher" ? r.role : "staff")}</Td>
                      <Td>
                        <div className="text-caption text-foreground">{typeLabel(r)}</div>
                        {r.kind === "user" && r.salaryType === "kpi" ? (
                          <div className="text-caption text-muted-foreground">
                            {t.kpiDetail(r.accrual.newStudents, r.accrual.oneMonthStudents)}
                          </div>
                        ) : null}
                      </Td>
                      <Td className="text-right font-semibold whitespace-nowrap">{money(b.accrued)}</Td>
                      <Td
                        className={cn(
                          "text-right whitespace-nowrap",
                          adj > 0 ? "text-(--success-fg)" : adj < 0 ? "text-(--danger-fg)" : "text-muted-foreground",
                        )}
                      >
                        {adj ? `${adj > 0 ? "+" : "−"}${money(Math.abs(adj))}` : "—"}
                      </Td>
                      <Td className="text-right whitespace-nowrap text-muted-foreground">{money(b.advance)}</Td>
                      <Td className="text-right whitespace-nowrap">{money(b.paid)}</Td>
                      <Td
                        className={cn(
                          "text-right font-bold whitespace-nowrap",
                          b.remaining > 0
                            ? "text-(--danger-fg)"
                            : b.remaining < 0
                              ? "text-(--warning-fg)"
                              : "text-(--success-fg)",
                        )}
                        title={b.remaining < 0 ? t.overpaid : undefined}
                      >
                        {b.remaining < 0 ? "−" : ""}
                        {money(Math.abs(b.remaining))}
                      </Td>
                      {canPay ? (
                        <Td className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => onPay(r)}>
                            {t.pay}
                          </Button>
                        </Td>
                      ) : null}
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<Wallet />} title={t.calcEmpty} />
        )}
      </Card>
    </div>
  );
}

/** Hisoblash turi yozuvi: o'qituvchining o'z sozlamasi (guruhlarda o'zgacha bo'lsa — belgi bilan) */
function typeLabel(r: PayrollRow): string {
  if (r.kind === "user") return r.salaryType === "kpi" ? t.typeKpi : t.typeOklad;
  const rule = r.rule;
  const label =
    r.salaryType === "percent"
      ? t.typePercent(rule.percent)
      : r.salaryType === "per_student"
        ? t.typePerStudent(som(rule.perStudent))
        : t.typeFixed(som(rule.fixed));
  return r.mixed ? `${label} · ${t.typeMixed}` : label;
}
