"use client";

import {
  ArrowRight,
  MoreHorizontal,
  BookOpen,
  GraduationCap,
  LayoutGrid,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { FilterBar, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { toast } from "@ventura/ui/toast";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../../branch-picker";
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
    <div className="space-y-section">
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
        <div className="grid gap-grid md:grid-cols-2 lg:grid-cols-3">
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
  const t = uz.courses;
  // Kursdagi o'qituvchilar (guruhlaridan, takrorsiz): birinchisi ko'rinadi, qolgani "+N"
  const teachers = [...new Set(course.groups.flatMap((g) => (g.teacher ? [g.teacher] : [])))];
  const meta = [branchName, course.durationMonths > 0 ? t.months(course.durationMonths) : null].filter(Boolean);
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-stat-icon [&_svg]:size-5"
          style={{ background: `color-mix(in oklab, ${course.color} 14%, transparent)`, color: course.color }}
        >
          <BookOpen />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-body leading-snug font-bold text-foreground" title={course.name}>
            {course.name}
          </div>
          {meta.length ? (
            <div className="mt-0.5 truncate text-caption text-muted-foreground">{meta.join(" · ")}</div>
          ) : null}
        </div>
        {canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="subtle"
                size="icon-sm"
                className="-mt-1 -mr-1 shrink-0"
                title={uz.common.actions}
                aria-label={`${course.name} — ${uz.common.actions}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> {uz.common.edit}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger onSelect={onArchive}>
                <Trash2 /> {uz.common.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <LayoutGrid className="size-4" aria-hidden />
          <b className="font-bold text-foreground">{course.groups.length}</b> {t.activeGroups}
        </span>
        <span className="flex items-center gap-1.5">
          <GraduationCap className="size-4" aria-hidden />
          <b className="font-bold text-foreground">{course.students}</b> {t.studentsWord}
        </span>
      </div>

      <div className="mt-3 flex min-h-8 items-center gap-2 text-body">
        {teachers.length ? (
          <>
            <Avatar name={teachers[0]!} size={28} variant="brand" />
            <span className="min-w-0 truncate text-foreground">{teachers[0]}</span>
            {teachers.length > 1 ? (
              <span className="shrink-0 text-caption text-muted-foreground" title={teachers.slice(1).join(", ")}>
                +{teachers.length - 1}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">{t.noTeacher}</span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border-soft pt-4">
        <div className="min-w-0">
          <div className="text-caption text-muted-foreground">{t.metricPrice}</div>
          <div className="truncate text-body leading-tight font-bold text-foreground">
            {course.price ? (
              <>
                {money(course.price)}{" "}
                <span className="text-caption font-medium text-muted-foreground">{uz.common.som}</span>
              </>
            ) : (
              <span className="text-body font-medium text-muted-foreground">{t.noPrice}</span>
            )}
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href={`/groups?kurs=${course.id}`}>
            {t.view} <ArrowRight />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
