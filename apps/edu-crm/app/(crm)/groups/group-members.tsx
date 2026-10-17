"use client";

import {
  Eye,
  LogOut,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { EmptyState } from "@ventura/ui/page-header";
import { SelectionBar, SelectionBarAction } from "@ventura/ui/selection-bar";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate, money } from "@/lib/format";
import {
  type MemberFilter,
  type MemberSort,
  type MonthState,
  compareMembers,
  matchesFilter,
  monthState,
} from "@/lib/group-profile";
import { uz } from "@/lib/uz";
import { StudentsTable } from "../student-table";
import { pauseMembershipAction } from "./actions";
import type { GroupProfileStats, GroupRow, MemberRow } from "./data";
import type { GroupPerms } from "./groups-view";
import { BulkLeaveDialog, type MembershipTarget } from "./membership-dialogs";

const t = uz.groupProfile;

const TONE = { trial: "info", active: "success", paused: "warning", left: "neutral" } as const;

/** Qatorga a'zolik + shu guruh bo'yicha pul va davomat */
type Row = MemberRow & {
  due: number;
  rate: number | null;
};

const PAY_TEXT: Record<Exclude<MonthState, "none">, string> = {
  paid: "text-(--success-fg)",
  partial: "text-(--warning-fg)",
  unpaid: "text-(--danger-fg)",
};

const rateTone = (rate: number) => (rate < 60 ? "text-(--danger-fg)" : rate < 80 ? "text-(--warning-fg)" : "");

export function MembersTab({
  group: g,
  members,
  stats,
  attendanceOn,
  perms,
  canCreateStudent,
  canPay,
  onAdd,
  onNew,
  onActivate,
  onLeave,
  onPay,
}: {
  group: GroupRow;
  members: MemberRow[];
  stats: GroupProfileStats;
  attendanceOn: boolean;
  perms: GroupPerms;
  canCreateStudent: boolean;
  canPay: boolean;
  onAdd: () => void;
  onNew: () => void;
  onActivate: (t: MembershipTarget) => void;
  onLeave: (t: MembershipTarget) => void;
  onPay: (student: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const financeOn = stats.finance !== null;
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<MemberFilter>("all");
  const [sort, setSort] = React.useState<MemberSort>("name");
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const rows: Row[] = members.map((m) => {
    const s = stats.members[m.studentId];
    return { ...m, due: s?.money?.due ?? 0, rate: s?.attendance?.rate ?? null };
  });
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = rows
    .filter(
      (m) =>
        matchesFilter(m, filter) &&
        (!q ||
          m.name.toLowerCase().includes(q) ||
          (m.parentName ?? "").toLowerCase().includes(q) ||
          (!!digits && m.phone.includes(digits))),
    )
    .sort(compareMembers(sort));
  const filtering = !!q || filter !== "all";
  const selectable = perms.removeStudent;
  // Ro'yxatdan chiqib ketgan (filtrlangan, chiqarilgan) o'quvchilar tanlovdan tushadi
  const picked = visible.filter((m) => selected.has(m.studentId));

  const target = (m: Row): MembershipTarget => ({
    id: m.id,
    studentName: m.name,
    groupName: g.name,
    enrolledAt: m.enrolledAt,
    pendingLeave: m.leavePendingAt ? { date: m.leavePendingAt, reason: m.leftReason, note: m.leftNote } : null,
  });

  function pause(m: Row, on: boolean) {
    startTransition(async () => {
      const res = await pauseMembershipAction({ id: m.id, pause: on });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: on ? uz.groups.frozen : uz.groups.unfrozen, description: m.name });
      router.refresh();
    });
  }

  const filterOptions = [
    { value: "all", label: t.filterAll },
    { value: "active", label: t.filterActive },
    { value: "trial", label: t.filterTrial },
    { value: "paused", label: t.filterPaused },
    ...(financeOn ? [{ value: "debt", label: t.filterDebt }] : []),
  ];
  const sortOptions = [
    { value: "name", label: t.sortName },
    { value: "joined", label: t.sortJoined },
    ...(financeOn ? [{ value: "debt", label: t.sortDebt }] : []),
    ...(attendanceOn ? [{ value: "attendance", label: t.sortAttendance }] : []),
  ];

  return (
    <div className="space-y-4">
      <FilterBar standalone>
        <FilterSearch placeholder={uz.groups.studentSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={t.filterLabel}
          value={filter}
          onValueChange={(v) => setFilter(v as MemberFilter)}
          options={filterOptions}
        />
        <FilterSelect
          label={t.sortLabel}
          value={sort}
          onValueChange={(v) => setSort(v as MemberSort)}
          options={sortOptions}
        />
        {filtering ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            <RotateCcw /> {t.clearFilters}
          </Button>
        ) : null}
        <FilterEnd className="w-full sm:w-auto">
          <span className="text-caption text-muted-foreground max-sm:order-last max-sm:w-full max-sm:text-center">
            {t.count(visible.length, rows.length)}
          </span>
          {perms.addStudent ? (
            <>
              <Button variant="ghost" className="max-sm:w-full" onClick={onAdd}>
                <UserPlus /> {uz.groups.addExisting}
              </Button>
              {canCreateStudent ? (
                <Button className="max-sm:w-full" onClick={onNew}>
                  <Plus /> {uz.groups.addNew}
                </Button>
              ) : null}
            </>
          ) : null}
        </FilterEnd>
      </FilterBar>

      <StudentsTable
        rows={visible}
        rowKey={(m) => m.studentId}
        student={(m) => ({
          name: m.name,
          href: `/students/${m.studentId}`,
          sub: [displayPhone(m.phone), m.parentName].filter(Boolean).join(" · ") || uz.students.phoneMissing,
        })}
        studentHeader={uz.groups.colStudent}
        minWidth={financeOn ? 1060 : 800}
        selection={
          selectable
            ? {
                selected: new Set(picked.map((m) => m.studentId)),
                onToggle: (id, on) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(id);
                    else next.delete(id);
                    return next;
                  }),
                onTogglePage: (on) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    for (const m of visible) {
                      if (on) next.add(m.studentId);
                      else next.delete(m.studentId);
                    }
                    return next;
                  }),
                pageLabel: t.selectPage,
                rowLabel: t.selectRow,
              }
            : undefined
        }
        columns={[
          {
            key: "status",
            header: t.colStatus,
            cell: (m) => (
              <>
                <Badge tone={TONE[m.status]} dot>
                  {m.leavePendingAt ? uz.groups.pendingLeave : uz.groups.membership[m.status]}
                </Badge>
                {m.status === "active" && m.activatedAt ? (
                  <div className="mt-1 text-caption text-muted-foreground">
                    {t.sinceActive(formatDate(m.activatedAt))}
                  </div>
                ) : null}
                {m.status === "paused" && m.pausedAt ? (
                  <div className="mt-1 text-caption text-muted-foreground">{t.sincePaused(formatDate(m.pausedAt))}</div>
                ) : null}
              </>
            ),
          },
          {
            key: "since",
            header: uz.groups.colSince,
            className: "font-mono whitespace-nowrap",
            cell: (m) => formatDate(m.enrolledAt),
          },
          ...(financeOn
            ? [
                {
                  key: "month",
                  header: t.colMonth,
                  className: "whitespace-nowrap",
                  cell: (m: Row) => {
                    const money_ = stats.members[m.studentId]?.money;
                    const state = money_ && m.status !== "trial" ? monthState(money_) : "none";
                    if (!money_ || state === "none") return <span className="text-muted-foreground">—</span>;
                    return (
                      <>
                        <div className={`font-semibold ${PAY_TEXT[state]}`}>
                          {state === "paid" ? t.monthPaid : state === "partial" ? t.monthPartial : t.monthUnpaid}
                        </div>
                        <div className="text-caption text-muted-foreground">
                          {state === "partial"
                            ? t.monthLeft(money(money_.monthDue))
                            : t.monthAmount(money(money_.monthCharged))}
                        </div>
                      </>
                    );
                  },
                },
                {
                  key: "debt",
                  header: t.colDebt,
                  className: "whitespace-nowrap",
                  cell: (m: Row) => {
                    const money_ = stats.members[m.studentId]?.money;
                    if (!money_ || money_.due <= 0) return <span className="text-muted-foreground">—</span>;
                    return (
                      <>
                        <div className="font-semibold text-(--danger-fg)">
                          {money(money_.due)} {uz.common.som}
                        </div>
                        <div className="text-caption text-muted-foreground">{t.debtMonths(money_.dueMonths)}</div>
                      </>
                    );
                  },
                },
              ]
            : []),
          ...(attendanceOn
            ? [
                {
                  key: "attendance",
                  header: t.colAttendance,
                  className: "whitespace-nowrap",
                  cell: (m: Row) => {
                    const a = stats.members[m.studentId]?.attendance;
                    if (!a || a.rate === null) return <span className="text-muted-foreground">—</span>;
                    return (
                      <>
                        <div className={`font-semibold ${rateTone(a.rate)}`}>{uz.attendance.rate(a.rate)}</div>
                        <div className="text-caption text-muted-foreground">{t.attendanceHint(a.came, a.marked)}</div>
                      </>
                    );
                  },
                },
              ]
            : []),
          {
            key: "actions",
            header: uz.common.actions,
            align: "right",
            cell: (m) => {
              const owes = (stats.members[m.studentId]?.money?.due ?? 0) > 0;
              return (
                <div className="flex items-center justify-end gap-1.5">
                  {m.status === "trial" && perms.addStudent ? (
                    <Button size="sm" onClick={() => onActivate(target(m))}>
                      <Play /> {uz.groups.activate}
                    </Button>
                  ) : null}
                  {owes && canPay ? (
                    <Button size="sm" variant="ghost" onClick={() => onPay({ id: m.studentId, name: m.name })}>
                      <Wallet /> {t.pay}
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="subtle" size="icon-sm" title={t.rowMore} aria-label={`${m.name} — ${t.rowMore}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuItem onSelect={() => router.push(`/students/${m.studentId}`)}>
                        <Eye /> {t.rowProfile}
                      </DropdownMenuItem>
                      {canPay && financeOn && m.status !== "trial" && !owes ? (
                        <DropdownMenuItem onSelect={() => onPay({ id: m.studentId, name: m.name })}>
                          <Wallet /> {t.rowPay}
                        </DropdownMenuItem>
                      ) : null}
                      {perms.freeze && m.status !== "trial" ? (
                        <DropdownMenuItem disabled={pending} onSelect={() => pause(m, m.status !== "paused")}>
                          {m.status === "paused" ? <Play /> : <Pause />}
                          {m.status === "paused" ? uz.groups.unfreeze : uz.groups.freeze}
                        </DropdownMenuItem>
                      ) : null}
                      {perms.removeStudent ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem danger onSelect={() => onLeave(target(m))}>
                            <LogOut /> {m.leavePendingAt ? uz.groups.forgivePending : uz.groups.remove}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            },
          },
        ]}
        empty={
          filtering && rows.length ? (
            <EmptyState icon={<Users />} title={t.emptyFiltered} description={t.emptyFilteredHint} />
          ) : (
            <EmptyState icon={<Users />} title={uz.groups.noStudents} description={uz.groups.noStudentsHint} />
          )
        }
      />

      {selectable ? (
        <>
          <SelectionBar
            count={picked.length}
            label={t.selectedCount}
            onClear={() => setSelected(new Set())}
            clearLabel={t.clearSelection}
          >
            <SelectionBarAction icon={<UserMinus />} tone="danger" onClick={() => setBulkOpen(true)}>
              {t.bulkRemove}
            </SelectionBarAction>
          </SelectionBar>
          <BulkLeaveDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            groupId={g.id}
            studentIds={picked.map((m) => m.studentId)}
            onDone={() => setSelected(new Set())}
          />
        </>
      ) : null}
    </div>
  );
}

const DAY_MS = 86_400_000;
const stayedDays = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS));

/** Guruhdan chiqqanlar: qachon qo'shilgan, qachon va nega chiqqan (tarix o'chmaydi) */
export function LeftTab({ members }: { members: MemberRow[] }) {
  return (
    <StudentsTable
      rows={members}
      rowKey={(m) => m.id}
      student={(m) => ({
        name: m.name,
        href: `/students/${m.studentId}`,
        sub: displayPhone(m.phone) ?? uz.students.phoneMissing,
      })}
      studentHeader={uz.groups.colStudent}
      minWidth={760}
      columns={[
        { key: "since", header: uz.groups.colSince, className: "font-mono", cell: (m) => formatDate(m.enrolledAt) },
        {
          key: "left",
          header: uz.groups.colLeft,
          className: "font-mono",
          cell: (m) => (m.leftAt ? formatDate(m.leftAt) : "—"),
        },
        {
          key: "stayed",
          header: t.colStayed,
          className: "whitespace-nowrap",
          cell: (m) => (m.leftAt ? t.stayed(stayedDays(m.enrolledAt, m.leftAt)) : "—"),
        },
        {
          key: "reason",
          header: uz.groups.colReason,
          headClassName: "w-80",
          cell: (m) => (
            <div className="max-w-80 text-muted-foreground">
              <div className="truncate" title={m.leftReason ?? undefined}>
                {m.leftReason ?? "—"}
              </div>
              {m.leftNote ? (
                <div className="truncate text-caption" title={m.leftNote}>
                  {m.leftNote}
                </div>
              ) : null}
            </div>
          ),
        },
      ]}
      empty={<EmptyState icon={<LogOut />} title={t.leftEmpty} />}
    />
  );
}
