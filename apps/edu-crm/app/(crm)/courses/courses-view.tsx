"use client";

import { BookOpen, ChevronDown, Clock, Layers, Pencil, Plus, Trash2, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { toast } from "@ventura/ui/toast";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { archiveCourseAction } from "./actions";
import { CourseForm } from "./course-form";
import type { CourseRow } from "./data";

type Sort = "default" | "students" | "groups" | "revenue";

export function CoursesView({
  rows,
  branches,
  selectedBranch,
  canWrite,
}: {
  rows: CourseRow[];
  branches: PickerBranch[];
  selectedBranch: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [branchFilter, setBranchFilter] = React.useState(selectedBranch);
  const [sort, setSort] = React.useState<Sort>("default");
  const [editing, setEditing] = React.useState<CourseRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toArchive, setToArchive] = React.useState<CourseRow | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Tepadagi filial o'zgarsa, sahifadagi tanlov ham unga tenglashadi
  const [syncedWith, setSyncedWith] = React.useState(selectedBranch);
  if (syncedWith !== selectedBranch) {
    setSyncedWith(selectedBranch);
    setBranchFilter(selectedBranch);
  }

  const inBranch = rows.filter((c) => branchFilter === "all" || !c.branchId || c.branchId === branchFilter);
  const q = query.trim().toLowerCase();
  const visible = inBranch.filter((c) => !q || c.name.toLowerCase().includes(q));
  const sorted =
    sort === "default"
      ? visible
      : [...visible].sort((a, b) =>
          sort === "students"
            ? b.students - a.students
            : sort === "groups"
              ? b.groups.length - a.groups.length
              : b.revenue - a.revenue,
        );

  // Ko'rsatkichlar qidiruvdan oldingi (filial bo'yicha) kurslar ustidan
  const totals = inBranch.reduce(
    (t, c) => ({
      groups: t.groups + c.groups.length,
      students: t.students + c.students,
      revenue: t.revenue + c.revenue,
    }),
    { groups: 0, students: 0, revenue: 0 },
  );
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? null;

  function openForm(course: CourseRow | null) {
    setEditing(course);
    setFormOpen(true);
  }

  async function archive(course: CourseRow) {
    const res = await archiveCourseAction(course.id);
    if (res.ok) {
      toast({ tone: "success", title: uz.courses.archived, description: course.name });
      router.refresh();
    } else toast({ tone: "danger", title: res.error });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={uz.courses.title}
        actions={
          canWrite ? (
            <Button onClick={() => openForm(null)}>
              <Plus /> {uz.courses.add}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          tone={1}
          icon={<BookOpen />}
          label={uz.courses.total}
          value={`${inBranch.length} ${uz.courses.totalUnit}`}
        />
        <StatCard
          tone={2}
          icon={<Layers />}
          label={uz.courses.groups}
          value={`${totals.groups} ${uz.courses.groupsUnit}`}
        />
        <StatCard
          tone={3}
          icon={<Users />}
          label={uz.courses.students}
          value={`${totals.students} ${uz.courses.studentsUnit}`}
        />
        <StatCard
          tone={4}
          icon={<Wallet />}
          label={uz.courses.revenue}
          value={`${money(totals.revenue)} ${uz.courses.revenueUnit}`}
        />
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={uz.courses.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        {branches.length > 1 ? (
          <FilterSelect
            label={uz.common.branch}
            value={branchFilter}
            onValueChange={setBranchFilter}
            options={[
              { value: "all", label: uz.common.allBranches },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        ) : null}
        <FilterSelect
          label={uz.courses.sortDefault}
          value={sort}
          onValueChange={(v) => setSort(v as Sort)}
          className="sm:w-56"
          options={[
            { value: "default", label: uz.courses.sortDefault },
            { value: "students", label: uz.courses.sortStudents },
            { value: "groups", label: uz.courses.sortGroups },
            { value: "revenue", label: uz.courses.sortRevenue },
          ]}
        />
      </FilterBar>

      {sorted.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              branchName={branchName(c.branchId)}
              canWrite={canWrite}
              onEdit={() => openForm(c)}
              onArchive={() => {
                setToArchive(c);
                setConfirmOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title={q ? uz.courses.notFound : uz.courses.empty}
            description={q ? uz.courses.notFoundHint : uz.courses.emptyHint}
          />
        </Card>
      )}

      {canWrite ? (
        <CourseForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          branches={branches}
          selectedBranch={selectedBranch}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={uz.common.confirmTitle}
        message={toArchive ? uz.courses.archiveMessage(toArchive.name) : ""}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toArchive && void archive(toArchive)}
      />
    </div>
  );
}

function CourseCard({
  course,
  branchName,
  canWrite,
  onEdit,
  onArchive,
}: {
  course: CourseRow;
  branchName: string | null;
  canWrite: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card className="flex flex-col gap-4 border-l-4 p-5" style={{ borderLeftColor: course.color }}>
      <div className="flex items-start gap-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-stat-icon [&_svg]:size-5"
          style={{ background: `color-mix(in oklab, ${course.color} 16%, transparent)`, color: course.color }}
        >
          <BookOpen />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-bold text-foreground" title={course.name}>
            {course.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {branchName ? <Badge tone="neutral">{branchName}</Badge> : null}
            {course.durationMonths > 0 ? (
              <span className="flex items-center gap-1 text-caption text-muted-foreground">
                <Clock className="size-3" /> {uz.courses.months(course.durationMonths)}
              </span>
            ) : null}
          </div>
        </div>
        {canWrite ? (
          <div className="flex shrink-0 gap-1.5">
            <Button variant="icon" size="icon-sm" title={uz.common.edit} aria-label={uz.common.edit} onClick={onEdit}>
              <Pencil />
            </Button>
            <Button
              variant="icon"
              size="icon-sm"
              title={uz.common.delete}
              aria-label={uz.common.delete}
              onClick={onArchive}
              className="text-destructive-text"
            >
              <Trash2 />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 divide-x divide-border-soft rounded-control border border-border-soft">
        <Metric label={uz.courses.metricGroups} value={uz.common.count(course.groups.length)} />
        <Metric label={uz.courses.metricStudents} value={uz.common.count(course.students)} />
        <Metric label={uz.courses.metricPrice} value={course.price ? money(course.price) : uz.courses.noPrice} />
      </div>

      <div className="flex items-center justify-between gap-2 text-body">
        <span className="text-muted-foreground">{uz.courses.monthlyRevenue}</span>
        <span className="font-mono font-bold text-foreground">
          {money(course.revenue)} {uz.courses.revenueUnit}
        </span>
      </div>

      <div className="border-t border-border-soft pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between text-body font-semibold text-foreground"
        >
          {uz.courses.groupList(course.groups.length)}
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open ? (
          course.groups.length ? (
            <ul className="mt-3 space-y-2">
              {course.groups.map((g) => (
                <li key={g.id} className="flex items-center gap-2 rounded-control bg-muted px-3 py-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: g.color ?? course.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{g.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-body text-muted-foreground">{uz.courses.noGroups}</p>
          )
        ) : null}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <div className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-0.5 truncate text-body font-bold text-foreground">{value}</div>
    </div>
  );
}
