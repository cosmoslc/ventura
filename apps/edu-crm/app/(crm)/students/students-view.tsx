"use client";

import {
  ArchiveRestore,
  ClipboardList,
  GraduationCap,
  Plus,
  RotateCcw,
  Search,
  Snowflake,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox } from "@ventura/ui/checkbox";
import { FilterBar } from "@ventura/ui/filter-bar";
import { Input } from "@ventura/ui/input";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import type { SearchSelectOption } from "@ventura/ui/search-select";
import { toast } from "@ventura/ui/toast";
import { BalanceText } from "../payments/payment-dialog";
import { displayPhone, formatDate } from "@/lib/format";
import { DEFAULT_STUDENT_FIELDS, FIELD_TYPES, type FormField } from "@/lib/form-fields";
import { uz } from "@/lib/uz";
import { restoreArchivedAction } from "../archive/actions";
import type { PickerBranch } from "../branch-picker";
import { ExcelMenu } from "../excel/excel-menu";
import { FieldsModal } from "../fields-modal";
import { saveStudentFieldsAction } from "./actions";
import { type BulkPerms, StudentsBulkBar } from "./bulk-actions";
import type { StudentRow } from "./data";
import { StatusBadge, StudentMenu, type StudentPerms } from "./student-dialogs";
import { StudentForm } from "./student-form";

const PAGE_SIZES = [25, 50, 100, 200] as const;
/** Holat filtri (eski tizimdagidek qisqa ro'yxat); "archived" — o'chirilgan (arxivdagi) o'quvchilar */
const STATUS_FILTERS = ["active", "paused", "archived", "trial"] as const;
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
  archived,
  canRestore,
  branches,
  selectedBranch,
  fields,
  groupChoices,
  perms,
  bulk,
}: {
  rows: StudentRow[];
  /** null — xodim arxivni ko'ra olmaydi ("O'chirilganlar" filtri yo'q) */
  archived: StudentRow[] | null;
  canRestore: boolean;
  branches: PickerBranch[];
  selectedBranch: string;
  fields: FormField[];
  groupChoices: SearchSelectOption[];
  perms: StudentPerms;
  /** Tanlab birga bajariladigan amallar (ADR 0028) */
  bulk: BulkPerms;
}) {
  const router = useRouter();
  const [fieldsOpen, setFieldsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [teacherFilter, setTeacherFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const pageSize = React.useSyncExternalStore(subscribePageSize, storedPageSize, () => 50);
  const [editing, setEditing] = React.useState<StudentRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());

  function changePageSize(n: number) {
    storePageSize(n);
    setPage(1);
  }

  const count = (s: StudentRow["status"]) => rows.filter((r) => r.status === s).length;
  const withGroups = rows.filter((r) => r.groups.length > 0).length;

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const source = status === "archived" ? (archived ?? []) : rows;
  const groupOptions = [...new Map(source.flatMap((r) => r.groups.map((g) => [g.id, g] as const))).values()]
    .filter((g) => teacherFilter === "all" || g.teacher === teacherFilter)
    .sort((a, b) => a.name.localeCompare(b.name));
  const teacherOptions = [...new Set(rows.flatMap((r) => r.groups.map((g) => g.teacher ?? "")))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filtered = source.filter((r) => {
    if (status !== "all" && status !== "archived" && r.status !== status) return false;
    if (groupFilter !== "all" && !r.groups.some((g) => g.id === groupFilter)) return false;
    if (teacherFilter !== "all" && !r.groups.some((g) => g.teacher === teacherFilter)) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (!!digits && (r.phone.includes(digits) || (r.parentPhone ?? "").includes(digits))) ||
      r.groups.some((g) => g.name.toLowerCase().includes(q))
    );
  });
  const active = !!q || status !== "all" || groupFilter !== "all" || teacherFilter !== "all";
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  // Tanlov (ADR 0028): faqat arxivda bo'lmagan o'quvchilar, sahifalar orasida saqlanadi
  const selectable = (!!bulk.enroll || bulk.remove) && status !== "archived";
  const selectedRows = selectable ? rows.filter((r) => selected.has(r.id)) : [];
  const pageSelected = visible.filter((r) => selected.has(r.id)).length;
  const headerState: boolean | "indeterminate" =
    pageSelected === 0 ? false : pageSelected === visible.length ? true : "indeterminate";
  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function togglePage(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  function restore(r: StudentRow) {
    startTransition(async () => {
      const res = await restoreArchivedAction({ kind: "student", id: r.id });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: uz.students.restored, description: r.name });
      router.refresh();
    });
  }

  function openForm(row: StudentRow | null) {
    setEditing(row);
    setFormOpen(true);
  }

  return (
    <div className={selectedRows.length ? "space-y-6 pb-20" : "space-y-6"}>
      <PageHeader
        title={uz.students.title}
        actions={
          <>
            <ExcelMenu table="students" branches={branches} selectedBranch={selectedBranch} canImport={perms.create} />
            {perms.edit ? (
              <Button variant="ghost" onClick={() => setFieldsOpen(true)}>
                <ClipboardList /> {uz.students.formSettings}
              </Button>
            ) : null}
            {perms.create ? (
              <Button onClick={() => openForm(null)}>
                <Plus /> {uz.students.add}
              </Button>
            ) : null}
          </>
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

      <FilterBar standalone>
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
          value={groupFilter}
          onValueChange={(v) => {
            setGroupFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label={uz.students.colGroups}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uz.students.allGroups}</SelectItem>
            {groupOptions.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={teacherFilter}
          onValueChange={(v) => {
            setTeacherFilter(v);
            // Tanlangan guruh bu ustozniki bo'lmasa — tozalanadi
            if (v !== "all" && !rows.some((r) => r.groups.some((g) => g.id === groupFilter && g.teacher === v)))
              setGroupFilter("all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label={uz.teachers.teacherFilter}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uz.students.allTeachers}</SelectItem>
            {teacherOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {STATUS_FILTERS.filter((s) => s !== "archived" || archived).map((s) => (
              <SelectItem key={s} value={s}>
                {s === "archived" ? uz.students.archivedFilter : uz.students.status[s]}
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
              setGroupFilter("all");
              setTeacherFilter("all");
              setPage(1);
            }}
          >
            <RotateCcw /> {uz.teachers.clear}
          </Button>
        ) : null}
      </FilterBar>

      <Card className="overflow-hidden">
        {visible.length ? (
          <>
            <TableWrap>
              <Table className="min-w-[860px]">
                <THead>
                  <tr>
                    {selectable ? (
                      <Th className="w-10 pr-0">
                        <Checkbox
                          aria-label={uz.students.selectPage}
                          checked={headerState}
                          onCheckedChange={(v) => togglePage(v === true)}
                        />
                      </Th>
                    ) : null}
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
                    <Tr key={r.id} className={selectable && selected.has(r.id) ? "bg-primary-soft" : undefined}>
                      {selectable ? (
                        <Td className="w-10 pr-0">
                          <Checkbox
                            aria-label={uz.students.selectRow(r.name)}
                            checked={selected.has(r.id)}
                            onCheckedChange={(v) => toggle(r.id, v === true)}
                          />
                        </Td>
                      ) : null}
                      <Td>
                        {r.archivedAt ? (
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.name} size={34} />
                            <span className="min-w-0">
                              <span className="block truncate text-body font-bold text-foreground">{r.name}</span>
                              <span className="block text-caption text-muted-foreground">
                                {uz.students.archivedAt(formatDate(r.archivedAt.slice(0, 10)))}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <Link href={`/students/${r.id}`} className="group flex items-center gap-2.5">
                            <Avatar name={r.name} size={34} />
                            <span className="min-w-0">
                              <span className="block truncate text-body font-bold text-foreground group-hover:text-primary">
                                {r.name}
                              </span>
                              <span className="block text-caption text-muted-foreground">
                                {uz.students.viewProfile}
                              </span>
                            </span>
                          </Link>
                        )}
                      </Td>
                      <Td className="font-mono">{displayPhone(r.phone) ?? uz.students.phoneMissing}</Td>
                      <Td>
                        {r.groups.length ? (
                          <div className="flex max-w-72 flex-wrap gap-1">
                            {r.groups.map((g) => (
                              <Link
                                key={g.id}
                                href={`/groups/${g.id}`}
                                className="rounded-badge border border-border-soft bg-muted px-2 py-0.5 text-caption hover:border-(--ring-border)"
                              >
                                <span className="font-semibold text-foreground">{g.name}</span>
                                <span className="text-muted-foreground"> · {g.teacher ?? uz.students.noTeacher}</span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{uz.students.noGroup}</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {r.balance === null ? (
                          <span className="text-muted-foreground">{uz.students.noData}</span>
                        ) : (
                          <BalanceText value={r.balance} />
                        )}
                      </Td>
                      <Td>
                        {r.archivedAt ? (
                          <Badge tone="danger">{uz.students.archivedFilter}</Badge>
                        ) : (
                          <StatusBadge status={r.status} />
                        )}
                      </Td>
                      <Td className="text-right">
                        {!r.archivedAt ? (
                          <StudentMenu student={r} perms={perms} onEdit={() => openForm(r)} />
                        ) : canRestore ? (
                          <Button variant="ghost" size="sm" onClick={() => restore(r)}>
                            <ArchiveRestore /> {uz.students.restore}
                          </Button>
                        ) : null}
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
              start={
                <div className="flex items-center gap-2 text-caption text-muted-foreground">
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
              }
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
          fields={fields}
          groups={groupChoices}
          onSaved={() => router.refresh()}
        />
      ) : null}
      {selectable ? (
        <StudentsBulkBar selected={selectedRows} onClear={() => setSelected(new Set())} perms={bulk} />
      ) : null}
      {perms.edit ? (
        <FieldsModal
          open={fieldsOpen}
          onOpenChange={setFieldsOpen}
          fields={fields}
          canWrite
          defaults={DEFAULT_STUDENT_FIELDS}
          types={FIELD_TYPES}
          save={saveStudentFieldsAction}
          title={uz.students.fieldsTitle}
          description={uz.students.fieldsIntro}
        />
      ) : null}
    </div>
  );
}
