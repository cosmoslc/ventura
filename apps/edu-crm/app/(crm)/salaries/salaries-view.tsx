"use client";

import {
  Banknote,
  Briefcase,
  Coins,
  Hash,
  MoreHorizontal,
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
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ventura/ui/dropdown-menu";
import { FilterBar, FilterDates, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { StatCard } from "@ventura/ui/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import type { PersonOption } from "@/lib/server/expenses";
import type { Payroll, PayrollRow } from "@/lib/server/payroll";
import { displayPhone, formatDate, formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { VoidRecordDialog } from "../expenses/void-dialog";
import type { MethodOption } from "../payments/payment-dialog";
import { NUM, type PeopleColumn, PeopleTable } from "../people-table";
import { restoreSalaryEntryAction, voidSalaryEntryAction } from "./actions";
import type { SalaryEntryRow } from "./data";
import { type ProfileLinks, personHref, remainingState, signedAmount, sumBalances } from "./helpers";
import { type SalaryFormState, SalaryForm, type SalaryPerms } from "./salary-form";

const t = uz.salaries;
const ALL = "all";
const PAGE_SIZE = 50;
const KINDS = ["salary", "advance", "bonus", "penalty"] as const;
const som = (n: number) => `${money(n)} ${uz.common.som}`;
const dash = <span className="text-muted-foreground">—</span>;
const REMAINING_CLASS = {
  due: "text-(--danger-fg)",
  over: "text-(--warning-fg)",
  settled: "text-(--success-fg)",
} as const;

/** Ism ostidagi qator: lavozim · telefon (telefon mono) */
function personSub(role: string, phone: string) {
  const shown = displayPhone(phone);
  return (
    <>
      {role}
      {shown ? (
        <>
          {" · "}
          <span className="font-mono">{shown}</span>
        </>
      ) : null}
    </>
  );
}
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
  links,
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
  /** Qaysi profillarni ochish mumkin (o'qituvchilar / xodimlar sahifasi ruxsati) */
  links: ProfileLinks;
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
    <div className="space-y-4">
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
          <TabsTrigger value="list">
            {t.tabs.list} <Badge tone="neutral">{entries.filter((e) => !e.voided).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="calc">
            {t.tabs.calc} <Badge tone="neutral">{payroll.rows.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "list" ? (
        <ListTab
          entries={entries}
          from={from}
          to={to}
          rangeInvalid={rangeInvalid}
          perms={perms}
          links={links}
          onRange={navigate}
          onEdit={(e) => setForm({ editing: e, person: e.person, month: e.month, amount: e.amount })}
        />
      ) : (
        <CalcTab
          payroll={payroll}
          months={months}
          canPay={canWrite}
          links={links}
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
  links,
  onRange,
  onEdit,
}: {
  entries: SalaryEntryRow[];
  from: string;
  to: string;
  rangeInvalid: boolean;
  perms: SalaryPerms;
  links: ProfileLinks;
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

  const menu = (e: SalaryEntryRow) =>
    can(e.kind) ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="subtle"
            size="icon-sm"
            title={uz.common.actions}
            aria-label={`${e.personName} — ${uz.common.actions}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {e.voided ? (
            <DropdownMenuItem onSelect={() => restore(e)}>
              <RotateCcw /> {t.restore}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => onEdit(e)}>
                <Pencil /> {uz.common.edit}
              </DropdownMenuItem>
              <DropdownMenuItem danger onSelect={() => setVoiding(e)}>
                <Trash2 /> {t.void}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;
  const columns: PeopleColumn<SalaryEntryRow>[] = [
    {
      key: "date",
      header: t.colDate,
      className: "whitespace-nowrap tabular-nums",
      cell: (e) => formatDate(e.date),
    },
    {
      key: "kind",
      header: t.colKind,
      cell: (e) => (
        <>
          <div className="font-semibold text-foreground">{t.kinds[e.kind]}</div>
          <div className="text-caption text-muted-foreground">{formatMonth(e.month)}</div>
          {e.voided ? (
            <div className="text-caption text-(--danger-fg)">
              {t.voided}
              {e.voided.reason ? `: ${e.voided.reason}` : ""}
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: "amount",
      header: t.colAmount,
      align: "right",
      className: cn(NUM, "text-body font-bold"),
      cell: (e) => (
        <span
          className={cn(e.kind === "penalty" ? "text-(--danger-fg)" : "text-foreground", e.voided && "line-through")}
        >
          {e.kind === "penalty" ? "−" : ""}
          {money(e.amount)}
        </span>
      ),
    },
    {
      key: "method",
      header: t.colMethod,
      cell: (e) => (
        <>
          <div className="text-foreground">{e.methodName ?? dash}</div>
          {e.createdByName ? (
            <div className="text-caption text-muted-foreground" title={t.colCreatedBy}>
              {e.createdByName}
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: "note",
      header: t.colNote,
      className: "max-w-56 truncate text-muted-foreground",
      cell: (e) => <span title={e.note ?? undefined}>{e.note ?? "—"}</span>,
    },
    { key: "actions", header: uz.common.actions, align: "right", cell: menu },
  ];

  return (
    <div className="space-y-4">
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

      <PeopleTable
        rows={shown}
        rowKey={(e) => e.id}
        person={(e) => ({
          name: e.personName,
          href: personHref(e.person, links),
          sub: personSub(roleLabel(e.role), e.personPhone),
        })}
        personHeader={t.colPerson}
        columns={columns}
        rowClassName={(e) => (e.voided ? "opacity-60" : undefined)}
        minWidth={1000}
        footer={
          pageCount > 1 ? (
            <Pagination
              page={current}
              pageCount={pageCount}
              total={visible.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          ) : null
        }
        empty={<EmptyState icon={<Wallet />} title={t.empty} description={t.emptyHint} />}
      />

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
  links,
  onMonth,
  onPay,
}: {
  payroll: Payroll;
  months: string[];
  canPay: boolean;
  links: ProfileLinks;
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

  const sums = sumBalances(rows.map((r) => r.balance));
  const adjusted = (n: number) => {
    const text = signedAmount(n, money);
    return text ? <span className={n > 0 ? "text-(--success-fg)" : "text-(--danger-fg)"}>{text}</span> : dash;
  };
  const remaining = (n: number) => (
    <span className={REMAINING_CLASS[remainingState(n)]} title={n < 0 ? t.overpaid : undefined}>
      {n < 0 ? "−" : ""}
      {money(Math.abs(n))}
    </span>
  );
  const columns: PeopleColumn<PayrollRow>[] = [
    {
      key: "type",
      header: t.colType,
      className: "whitespace-nowrap",
      cell: (r) => (
        <>
          <div className="font-semibold text-foreground">{typeLabel(r)}</div>
          {r.kind === "user" && r.salaryType === "kpi" ? (
            <div className="text-caption text-muted-foreground">
              {t.kpiDetail(r.accrual.newStudents, r.accrual.oneMonthStudents)}
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: "accrued",
      header: t.colAccrued,
      align: "right",
      className: cn(NUM, "font-semibold text-foreground"),
      cell: (r) => money(r.balance.accrued),
    },
    {
      key: "adjust",
      header: t.colBonus,
      align: "right",
      className: NUM,
      cell: (r) => adjusted(r.balance.bonus - r.balance.penalty),
    },
    {
      key: "advance",
      header: t.colAdvance,
      align: "right",
      className: NUM,
      cell: (r) => (r.balance.advance ? money(r.balance.advance) : dash),
    },
    {
      key: "paid",
      header: t.colPaid,
      align: "right",
      className: NUM,
      cell: (r) => (r.balance.paid ? money(r.balance.paid) : dash),
    },
    {
      key: "remaining",
      header: t.colRemaining,
      align: "right",
      className: cn(NUM, "font-bold"),
      cell: (r) => remaining(r.balance.remaining),
    },
    ...(canPay
      ? [
          {
            key: "pay",
            header: uz.common.actions,
            align: "right" as const,
            cell: (r: PayrollRow) => (
              <Button size="sm" variant="ghost" onClick={() => onPay(r)}>
                {t.pay}
              </Button>
            ),
          },
        ]
      : []),
  ];
  const totalCells = {
    accrued: money(sums.accrued),
    adjust: adjusted(sums.adjust),
    advance: sums.advance ? money(sums.advance) : dash,
    paid: sums.paid ? money(sums.paid) : dash,
    remaining: remaining(sums.remaining),
  };

  return (
    <div className="space-y-4">
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

      <PeopleTable
        rows={rows}
        rowKey={(r) => `${r.kind}:${r.id}`}
        person={(r) => ({
          name: r.name,
          href: personHref(`${r.kind === "teacher" ? "teacher" : "user"}:${r.id}`, links, payroll.month),
          sub: personSub(roleLabel(r.kind === "teacher" ? r.role : "staff"), r.phone),
        })}
        personHeader={t.colPerson}
        columns={columns}
        total={rows.length > 1 ? { label: t.totalRow, cells: totalCells } : undefined}
        minWidth={980}
        empty={<EmptyState icon={<Wallet />} title={t.calcEmpty} />}
      />
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
