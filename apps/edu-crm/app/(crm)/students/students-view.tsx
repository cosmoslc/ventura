"use client";

import { GraduationCap, Plus, RotateCcw, Search, Snowflake, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { displayPhone } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import type { StudentRow } from "./data";
import { STATUSES, StatusBadge, StudentMenu, type StudentPerms } from "./student-dialogs";
import { StudentForm } from "./student-form";

const PAGE_SIZES = [25, 50, 100, 200] as const;
const PAGE_SIZE_KEY = "edu.students.pageSize";

function storedPageSize(): number {
  try {
    const v = Number(window.localStorage.getItem(PAGE_SIZE_KEY));
    return (PAGE_SIZES as readonly number[]).includes(v) ? v : 50;
  } catch {
    return 50;
  }
}

// Sahifa hajmi brauzerda eslab qolinadi; serverda (va saqlab bo'lmasa) — 50
const pageSizeListeners = new Set<() => void>();
function subscribePageSize(cb: () => void) {
  pageSizeListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    pageSizeListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function storePageSize(n: number) {
  try {
    window.localStorage.setItem(PAGE_SIZE_KEY, String(n));
  } catch {
    /* saqlab bo'lmasa — standart qiymat qoladi */
  }
  pageSizeListeners.forEach((cb) => cb());
}

export function StudentsView({
  rows,
  branches,
  selectedBranch,
  courses,
  perms,
}: {
  rows: StudentRow[];
  branches: PickerBranch[];
  selectedBranch: string;
  courses: { id: string; name: string }[];
  perms: StudentPerms;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const pageSize = React.useSyncExternalStore(subscribePageSize, storedPageSize, () => 50);
  const [editing, setEditing] = React.useState<StudentRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);

  function changePageSize(n: number) {
    storePageSize(n);
    setPage(1);
  }

  const count = (s: StudentRow["status"]) => rows.filter((r) => r.status === s).length;
  const withGroups = rows.filter((r) => r.groups.length > 0).length;

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (!!digits && (r.phone.includes(digits) || (r.parentPhone ?? "").includes(digits))) ||
      r.groups.some((g) => g.name.toLowerCase().includes(q))
    );
  });
  const active = !!q || status !== "all";
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  function openForm(row: StudentRow | null) {
    setEditing(row);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={uz.students.title}
        actions={
          perms.create ? (
            <Button onClick={() => openForm(null)}>
              <Plus /> {uz.students.add}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          tone={1}
          icon={<Users />}
          label={uz.students.statTotal}
          value={uz.common.count(rows.length)}
          hint={
            <div>
              {uz.students.withGroups(withGroups)} • {uz.students.withoutGroups(rows.length - withGroups)}
            </div>
          }
        />
        <StatCard
          tone={2}
          icon={<UserCheck />}
          label={uz.students.statActive}
          value={uz.common.count(count("active"))}
          hint={<div>{uz.students.trialCount(count("trial"))}</div>}
        />
        <StatCard
          tone={4}
          icon={<Snowflake />}
          label={uz.students.statPaused}
          value={uz.common.count(count("paused"))}
          hint={<div>{uz.students.leftCount(count("left"))}</div>}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border-soft p-3">
          <div className="min-w-0 flex-1 sm:max-w-sm sm:min-w-64">
            <Input
              icon={<Search />}
              placeholder={uz.students.search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label={uz.students.colStatus}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{uz.students.statusFilter}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {uz.students.status[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {active ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setPage(1);
              }}
            >
              <RotateCcw /> {uz.teachers.clear}
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-2 text-caption text-muted-foreground">
            {uz.students.perPage}
            <Select value={String(pageSize)} onValueChange={(v) => changePageSize(Number(v))}>
              <SelectTrigger className="w-24" aria-label={uz.students.perPage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {uz.students.perPageOption(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length ? (
          <>
            <TableWrap>
              <Table className="min-w-[860px]">
                <THead>
                  <tr>
                    <Th>{uz.students.colName}</Th>
                    <Th>{uz.students.colPhone}</Th>
                    <Th>{uz.students.colGroups}</Th>
                    <Th>{uz.students.colBalance}</Th>
                    <Th>{uz.students.colStatus}</Th>
                    <Th className="text-right">{uz.common.actions}</Th>
                  </tr>
                </THead>
                <TBody>
                  {visible.map((r) => (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`/students/${r.id}`} className="group flex items-center gap-2.5">
                          <Avatar name={r.name} size={34} />
                          <span className="min-w-0">
                            <span className="block truncate text-body font-bold text-foreground group-hover:text-primary">
                              {r.name}
                            </span>
                            <span className="block text-caption text-muted-foreground">{uz.students.viewProfile}</span>
                          </span>
                        </Link>
                      </Td>
                      <Td className="font-mono">{displayPhone(r.phone) ?? uz.students.phoneMissing}</Td>
                      <Td className="text-muted-foreground">{uz.students.noGroup}</Td>
                      <Td className="text-muted-foreground">{uz.students.noData}</Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
                      <Td className="text-right">
                        <StudentMenu student={r} perms={perms} onEdit={() => openForm(r)} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            <Pagination
              page={current}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<GraduationCap />}
            title={rows.length ? uz.students.empty : uz.students.emptyFirst}
            description={rows.length ? undefined : uz.students.emptyFirstHint}
          />
        )}
      </Card>

      {perms.create || perms.edit ? (
        <StudentForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          branches={branches}
          selectedBranch={selectedBranch}
          courses={courses}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
