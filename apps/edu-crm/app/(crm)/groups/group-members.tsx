"use client";

import { Eye, LogOut, Play, Plus, RotateCcw, UserMinus, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { EmptyState } from "@ventura/ui/page-header";
import { SelectionBar, SelectionBarAction } from "@ventura/ui/selection-bar";
import { displayPhone, formatDate, money } from "@/lib/format";
import { type MemberFilter, type MemberSort, compareMembers, matchesFilter } from "@/lib/group-profile";
import { uz } from "@/lib/uz";
import { StudentsTable } from "../student-table";
import type { GroupProfileStats, GroupRow, MemberRow } from "./data";
import type { GroupPerms } from "./groups-view";
import { BulkLeaveDialog, type MembershipTarget } from "./membership-dialogs";

const t = uz.groupProfile;

/** Qatorga a'zolik + shu guruh bo'yicha pul va davomat */
type Row = MemberRow & {
  due: number;
  rate: number | null;
};

export function MembersTab({
  group: g,
  members,
  stats,
  attendanceOn,
  perms,
  canCreateStudent,
  onAdd,
  onNew,
  onActivate,
  onLeave,
}: {
  group: GroupRow;
  members: MemberRow[];
  stats: GroupProfileStats;
  attendanceOn: boolean;
  perms: GroupPerms;
  canCreateStudent: boolean;
  onAdd: () => void;
  onNew: () => void;
  onActivate: (t: MembershipTarget) => void;
  onLeave: (t: MembershipTarget) => void;
}) {
  const router = useRouter();
  const financeOn = stats.finance !== null;
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<MemberFilter>("all");
  const [sort, setSort] = React.useState<MemberSort>("name");
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);

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
    <div className="space-y-section">
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
          // Telefon alohida ustunda; ism ostida — holat (faol bo'lmasa) yoki ota-ona
          sub:
            (m.leavePendingAt
              ? uz.groups.pendingLeave
              : m.status !== "active"
                ? uz.groups.membership[m.status]
                : m.parentName) ?? "",
        })}
        studentHeader={uz.groups.colStudent}
        minWidth={600}
        numbered
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
            key: "phone",
            header: t.colPhone,
            className: "font-mono whitespace-nowrap",
            cell: (m) =>
              m.phone ? (
                <a href={`tel:+998${m.phone}`} className="text-(--primary-text) hover:underline">
                  {displayPhone(m.phone)}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          ...(financeOn
            ? [
                {
                  key: "balance",
                  header: t.colBalance,
                  className: "whitespace-nowrap",
                  cell: (m: Row) =>
                    m.due > 0 ? (
                      <span className="font-semibold text-(--danger-fg)">
                        −{money(m.due)} {uz.common.som}
                      </span>
                    ) : (
                      <span className="text-foreground">0 {uz.common.som}</span>
                    ),
                },
              ]
            : []),
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (m) => (
              <div className="flex items-center justify-end gap-1.5">
                {m.status === "trial" && perms.addStudent ? (
                  <Button
                    variant="subtle"
                    size="icon-sm"
                    title={uz.groups.activate}
                    aria-label={`${m.name} — ${uz.groups.activate}`}
                    onClick={() => onActivate(target(m))}
                  >
                    <Play />
                  </Button>
                ) : null}
                <Button
                  variant="subtle"
                  size="icon-sm"
                  title={t.rowProfile}
                  aria-label={`${m.name} — ${t.rowProfile}`}
                  onClick={() => router.push(`/students/${m.studentId}`)}
                >
                  <Eye />
                </Button>
                {perms.removeStudent ? (
                  <Button
                    variant="subtle"
                    size="icon-sm"
                    className="text-destructive-text"
                    title={m.leavePendingAt ? uz.groups.forgivePending : uz.groups.remove}
                    aria-label={`${m.name} — ${m.leavePendingAt ? uz.groups.forgivePending : uz.groups.remove}`}
                    onClick={() => onLeave(target(m))}
                  >
                    <UserMinus />
                  </Button>
                ) : null}
              </div>
            ),
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
