"use client";

import {
  Clock,
  GraduationCap,
  Layers,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Presentation,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar } from "@ventura/ui/filter-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { Input } from "@ventura/ui/input";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { displayPhone, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { ExcelMenu } from "../excel/excel-menu";
import { archiveTeacherAction } from "./actions";
import type { TeacherRef, TeacherRow } from "./data";
import { TeacherForm } from "./teacher-form";

type Tab = "teachers" | "support";
const PAGE_SIZE = 20;

export interface TeacherPerms {
  create: boolean;
  edit: boolean;
  delete: boolean;
}

/** "40% ulush", "3 000 000 so'm (Fix)", "100 000 so'm / o'quvchi" */
export function salaryLabel(
  t: Pick<TeacherRow, "salaryType" | "revenueSharePercent" | "perStudentSalary" | "fixedSalary">,
) {
  if (t.salaryType === "percent") return uz.teachers.salaryLabel.percent(t.revenueSharePercent);
  if (t.salaryType === "per_student") return uz.teachers.salaryLabel.per_student(money(t.perStudentSalary));
  return uz.teachers.salaryLabel.fixed(money(t.fixedSalary));
}

export function periodLabel(d = new Date()) {
  return `${uz.months[d.getMonth()]} ${d.getFullYear()}`;
}

export function hoursLabel(t: Pick<TeacherRow, "startTime" | "endTime">) {
  return t.startTime && t.endTime ? `${t.startTime} - ${t.endTime}` : null;
}

export function TeachersView({
  rows,
  refs,
  branches,
  selectedBranch,
  perms,
  initialTab,
}: {
  rows: TeacherRow[];
  /** Biriktirilgan ustozlar nomi (bo'shatilganlari ham) */
  refs: TeacherRef[];
  branches: PickerBranch[];
  selectedBranch: string;
  perms: TeacherPerms;
  initialTab: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [query, setQuery] = React.useState("");
  const [branchFilter, setBranchFilter] = React.useState(selectedBranch);
  const [salaryFilter, setSalaryFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [form, setForm] = React.useState<{ open: boolean; kind: Tab; editing: TeacherRow | null }>({
    open: false,
    kind: "teachers",
    editing: null,
  });
  const [toArchive, setToArchive] = React.useState<TeacherRow | null>(null);

  const [syncedWith, setSyncedWith] = React.useState(selectedBranch);
  if (syncedWith !== selectedBranch) {
    setSyncedWith(selectedBranch);
    setBranchFilter(selectedBranch);
  }

  const mains = rows.filter((t) => t.kind === "teacher");
  const supports = rows.filter((t) => t.kind === "support");
  const list = tab === "teachers" ? mains : supports;
  const branchOf = (id: string) => branches.find((b) => b.id === id);
  const refName = (id: string | null) => {
    if (!id) return null;
    const r = refs.find((x) => x.id === id);
    return r ? (r.archived ? `${r.name} ${uz.teachers.archivedSuffix}` : r.name) : null;
  };

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const filtered = list.filter((t) => {
    if (q && !t.name.toLowerCase().includes(q) && !(digits && t.phone.includes(digits))) return false;
    if (branchFilter !== "all" && t.branchId !== branchFilter) return false;
    if (tab === "teachers" && salaryFilter !== "all" && t.salaryType !== salaryFilter) return false;
    return true;
  });
  const active = !!q || branchFilter !== selectedBranch || salaryFilter !== "all";
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Guruhlar (E1d) va to'lovlar (E3) hali yo'q: ko'rsatkichlar faqat haqiqiy ma'lumotdan
  const withGroups = mains.filter((t) => t.groups > 0).length;
  const totalStudents = mains.reduce((s, t) => s + t.students, 0);
  const totalGroups = mains.reduce((s, t) => s + t.groups, 0);
  const period = periodLabel();

  function openForm(kind: Tab, editing: TeacherRow | null) {
    setForm({ open: true, kind, editing });
  }

  async function archive(t: TeacherRow) {
    const res = await archiveTeacherAction(t.id);
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: uz.teachers.archived, description: t.name });
    router.refresh();
  }

  function resetFilters() {
    setQuery("");
    setBranchFilter(selectedBranch);
    setSalaryFilter("all");
    setPage(1);
  }

  const menu = (t: TeacherRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          title={uz.common.actions}
          aria-label={`${t.name} — ${uz.common.actions}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => router.push(`/teachers/${t.id}`)}>
          <UserCheck /> {uz.teachers.profile}
        </DropdownMenuItem>
        {perms.edit ? (
          <DropdownMenuItem onSelect={() => openForm(t.kind === "teacher" ? "teachers" : "support", t)}>
            <Pencil /> {uz.teachers.edit}
          </DropdownMenuItem>
        ) : null}
        {perms.delete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => setToArchive(t)}>
              <Trash2 /> {uz.teachers.archive}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const nameCell = (t: TeacherRow) => {
    const b = branchOf(t.branchId);
    return (
      <div className="flex items-center gap-2.5">
        <Avatar name={t.name} size={34} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/teachers/${t.id}`}
              className="truncate text-body font-bold text-foreground transition-colors hover:text-primary"
            >
              {t.name}
            </Link>
            {b && branches.length > 1 ? <Badge tone="neutral">{b.name}</Badge> : null}
          </div>
          <div className="flex items-center gap-1 font-mono text-caption text-muted-foreground">
            <Phone className="size-3" /> {displayPhone(t.phone)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={uz.teachers.title}
        actions={
          <>
            <ExcelMenu table="teachers" branches={branches} selectedBranch={selectedBranch} canImport={perms.create} />
            {perms.create ? (
              <Button onClick={() => openForm(tab, null)}>
                <Plus /> {tab === "teachers" ? uz.teachers.add : uz.teachers.addSupport}
              </Button>
            ) : null}
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="teachers">
            <Presentation /> {uz.teachers.tabTeachers} <Badge tone="neutral">{mains.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="support">
            <UserCheck /> {uz.teachers.tabSupport} <Badge tone="neutral">{supports.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "teachers" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            tone={1}
            icon={<GraduationCap />}
            label={uz.teachers.statTeachers}
            value={uz.common.count(mains.length)}
            hint={
              <>
                <div>{uz.teachers.withGroups(withGroups)}</div>
                <div>{uz.teachers.withoutGroups(mains.length - withGroups)}</div>
              </>
            }
          />
          <StatCard
            tone={2}
            icon={<Wallet />}
            label={uz.teachers.statShare}
            value={`${money(0)} ${uz.common.som}`}
            hint={<div>{uz.teachers.shareFor(period)}</div>}
          />
          <StatCard
            tone={3}
            icon={<Users />}
            label={uz.teachers.statStudents}
            value={uz.teachers.studentsUnit(totalStudents)}
            hint={<div>{uz.teachers.acrossGroups(totalGroups)}</div>}
          />
          <StatCard
            tone={4}
            icon={<TrendingUp />}
            label={uz.teachers.statRetention}
            value={uz.teachers.noData}
            hint={<div>{uz.teachers.retentionFor(period)}</div>}
          />
        </div>
      ) : null}

      <FilterBar standalone>
        <div className="min-w-0 flex-1 sm:max-w-sm sm:min-w-64">
          <Input
            icon={<Search />}
            placeholder={uz.teachers.search}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {branches.length > 1 ? (
          <Select
            value={branchFilter}
            onValueChange={(v) => {
              setBranchFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label={uz.common.branch}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{uz.common.allBranches}</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {tab === "teachers" ? (
          <Select
            value={salaryFilter}
            onValueChange={(v) => {
              setSalaryFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label={uz.teachers.salaryFilter}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{uz.teachers.salaryFilter}</SelectItem>
              {(["percent", "per_student", "fixed"] as const).map((t) => (
                <SelectItem key={t} value={t}>
                  {uz.teachers.salaryFilterOptions[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {active ? (
          <Button variant="ghost" size="sm" title={uz.teachers.clearHint} onClick={resetFilters}>
            <RotateCcw /> {uz.teachers.clear}
          </Button>
        ) : null}
      </FilterBar>

      <Card className="overflow-hidden">
        {visible.length ? (
          <>
            <TableWrap>
              {tab === "teachers" ? (
                <Table className="min-w-[900px]">
                  <THead>
                    <tr>
                      <Th>{uz.teachers.colName}</Th>
                      <Th>{uz.teachers.colGroups}</Th>
                      <Th>{uz.teachers.colStudents}</Th>
                      <Th>{uz.teachers.colSalary}</Th>
                      <Th>{uz.teachers.colRetention}</Th>
                      <Th>{uz.teachers.colRating}</Th>
                      <Th className="text-right">{uz.common.actions}</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {visible.map((t) => (
                      <Tr key={t.id}>
                        <Td>{nameCell(t)}</Td>
                        <Td>
                          <Badge tone="info">
                            <Layers className="size-3" /> {uz.common.count(t.groups)}
                          </Badge>
                        </Td>
                        <Td>
                          <Badge tone="neutral">
                            <Users className="size-3" /> {uz.common.count(t.students)}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="font-semibold text-foreground">{salaryLabel(t)}</div>
                          <div className="text-caption text-muted-foreground">
                            {uz.teachers.salaryTypeName[t.salaryType]}
                          </div>
                        </Td>
                        <Td className="text-muted-foreground">{uz.teachers.noData}</Td>
                        <Td className="text-muted-foreground">{uz.teachers.noData}</Td>
                        <Td className="text-right">{menu(t)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <Table className="min-w-[900px]">
                  <THead>
                    <tr>
                      <Th>{uz.teachers.colSupport}</Th>
                      <Th>{uz.teachers.colAssigned}</Th>
                      <Th>{uz.teachers.colDays}</Th>
                      <Th>{uz.teachers.colHours}</Th>
                      <Th>{uz.teachers.colSalary}</Th>
                      <Th>{uz.teachers.colRating}</Th>
                      <Th className="text-right">{uz.common.actions}</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {visible.map((t) => (
                      <Tr key={t.id}>
                        <Td>{nameCell(t)}</Td>
                        <Td>
                          {refName(t.assignedTeacherId) ?? (
                            <span className="text-muted-foreground">{uz.teachers.notAssigned}</span>
                          )}
                        </Td>
                        <Td>
                          {t.workingDays.length ? (
                            <div className="flex flex-wrap gap-1">
                              {t.workingDays.map((d) => (
                                <Badge key={d} tone="info" title={uz.weekdays.full[d]}>
                                  {uz.weekdays.short[d]}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{uz.teachers.notSet}</span>
                          )}
                        </Td>
                        <Td>
                          {hoursLabel(t) ? (
                            <Badge tone="neutral">
                              <Clock className="size-3" /> {hoursLabel(t)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{uz.teachers.notSet}</span>
                          )}
                        </Td>
                        <Td className="font-semibold text-foreground">{salaryLabel(t)}</Td>
                        <Td className="text-muted-foreground">{uz.teachers.noData}</Td>
                        <Td className="text-right">{menu(t)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </TableWrap>
            {filtered.length > PAGE_SIZE ? (
              <Pagination
                page={current}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={<GraduationCap />}
            title={
              active ? uz.teachers.emptyFiltered : tab === "support" ? uz.teachers.emptySupport : uz.teachers.empty
            }
            description={active ? uz.teachers.emptyFilteredHint : uz.teachers.emptyHint}
          />
        )}
      </Card>

      {perms.create || perms.edit ? (
        <TeacherForm
          open={form.open}
          onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
          kind={form.kind === "teachers" ? "teacher" : "support"}
          editing={form.editing}
          mentors={mains.map((t) => ({ id: t.id, name: t.name }))}
          branches={branches}
          selectedBranch={selectedBranch}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={toArchive !== null}
        onOpenChange={(o) => !o && setToArchive(null)}
        title={uz.teachers.archiveTitle}
        message={toArchive ? uz.teachers.archiveMessage(toArchive.name) : ""}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toArchive && void archive(toArchive)}
      />
    </div>
  );
}
