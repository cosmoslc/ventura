"use client";

import {
  Armchair,
  Clock,
  DoorOpen,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  Users,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
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
import { Meter } from "@ventura/ui/meter";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { ExcelMenu } from "../excel/excel-menu";
import { ArchiveGroupModal } from "./archive-group-modal";
import type { GroupRow } from "./data";
import { type CourseOption, GroupForm, type RoomOption, type TeacherOption } from "./group-form";

export interface GroupPerms {
  create: boolean;
  edit: boolean;
  delete: boolean;
  changeTeacher: boolean;
  addStudent: boolean;
  removeStudent: boolean;
  freeze: boolean;
}

const ODD = ["mon", "wed", "fri"];
const EVEN = ["tue", "thu", "sat"];

export const daysLabel = (days: readonly string[]) =>
  days.map((d) => uz.weekdays.short[d as keyof typeof uz.weekdays.short] ?? d).join(", ");

export function GroupsView({
  rows,
  courses,
  initialCourse,
  teachers,
  rooms,
  branches,
  selectedBranch,
  perms,
}: {
  rows: GroupRow[];
  courses: CourseOption[];
  /** Boshlang'ich kurs filtri (?kurs=), bo'lmasa "all" */
  initialCourse?: string;
  teachers: TeacherOption[];
  rooms: RoomOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  perms: GroupPerms;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [course, setCourse] = React.useState(initialCourse ?? "all");
  const [days, setDays] = React.useState("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GroupRow | null>(null);
  const [toArchive, setToArchive] = React.useState<GroupRow | null>(null);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((g) => {
    if (course !== "all" && g.courseId !== course) return false;
    if (days === "odd" && !g.days.some((d) => ODD.includes(d))) return false;
    if (days === "even" && !g.days.some((d) => EVEN.includes(d))) return false;
    return (
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.courseName.toLowerCase().includes(q) ||
      g.teacherName.toLowerCase().includes(q)
    );
  });
  const filtered = !!q || course !== "all" || days !== "all";

  // Statistika — faqat bazadagi a'zoliklardan (o'quvchi takrorsiz; daromad kartalari — E3)
  const distinct = new Set(rows.flatMap((g) => g.studentIds)).size;
  const trial = rows.reduce((s, g) => s + g.members.trial, 0);
  const withRoom = rows.filter((g) => g.roomCapacity !== null);
  const seats = withRoom.reduce((s, g) => s + Math.max(0, (g.roomCapacity ?? 0) - g.studentIds.length), 0);

  function openForm(g: GroupRow | null) {
    setEditing(g);
    setFormOpen(true);
  }

  const missing = !courses.length ? "courses" : !teachers.length ? "teachers" : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={uz.groups.title}
        actions={
          <>
            <ExcelMenu table="groups" branches={branches} selectedBranch={selectedBranch} canImport={perms.create} />
            {perms.create && !missing ? (
              <Button onClick={() => openForm(null)}>
                <Plus /> {uz.groups.add}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone={1} icon={<Layers />} label={uz.groups.statGroups} value={uz.groups.groupsUnit(rows.length)} />
        <StatCard tone={2} icon={<Users />} label={uz.groups.statStudents} value={uz.groups.studentsUnit(distinct)} />
        <StatCard tone={3} icon={<UserCheck />} label={uz.groups.statTrial} value={uz.groups.studentsUnit(trial)} />
        <StatCard tone={4} icon={<Armchair />} label={uz.groups.statSeats} value={uz.common.count(seats)} />
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={uz.groups.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={uz.groups.course}
          value={course}
          onValueChange={setCourse}
          options={[
            { value: "all", label: uz.groups.allCourses },
            ...courses.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterSelect
          label={uz.groups.days}
          value={days}
          onValueChange={setDays}
          className="sm:w-56"
          options={[
            { value: "all", label: uz.groups.allDays },
            { value: "odd", label: uz.groups.oddDays },
            { value: "even", label: uz.groups.evenDays },
          ]}
        />
      </FilterBar>

      {missing ? (
        <Card>
          <EmptyState
            icon={<Layers />}
            title={missing === "courses" ? uz.groups.noCourses : uz.groups.noTeachers}
            description={missing === "courses" ? uz.groups.noCoursesHint : uz.groups.noTeachersHint}
          />
        </Card>
      ) : visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((g) => {
            const count = g.studentIds.length;
            const cap = g.roomCapacity;
            return (
              <Card key={g.id} className="flex flex-col gap-3 border-l-4 p-4" style={{ borderLeftColor: g.color }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{g.courseName}</Badge>
                    {cap !== null && count >= cap ? (
                      <Badge tone="warning">{uz.groups.full}</Badge>
                    ) : count < 3 ? (
                      <Badge tone="info">{uz.groups.fewStudents}</Badge>
                    ) : null}
                  </div>
                  {perms.edit || perms.changeTeacher || perms.delete ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="subtle"
                          size="icon-sm"
                          className="-mt-1 -mr-1 shrink-0"
                          title={uz.common.actions}
                          aria-label={`${g.name} — ${uz.common.actions}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {perms.edit || perms.changeTeacher ? (
                          <DropdownMenuItem onSelect={() => openForm(g)}>
                            <Pencil /> {uz.groups.edit}
                          </DropdownMenuItem>
                        ) : null}
                        {perms.delete ? (
                          <>
                            {perms.edit || perms.changeTeacher ? <DropdownMenuSeparator /> : null}
                            <DropdownMenuItem danger onSelect={() => setToArchive(g)}>
                              <Trash2 /> {uz.groups.archive}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                <Link href={`/groups/${g.id}`} className="type-heading text-title text-foreground hover:text-primary">
                  {g.name}
                </Link>
                <ul className="space-y-1.5 text-body text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
                  <li className="flex items-center gap-2">
                    <UserRound /> <span className="truncate text-foreground">{g.teacherName}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <DoorOpen /> {g.roomName ?? uz.groups.noRoom}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock /> {daysLabel(g.days)} · {g.startTime} - {g.endTime}
                  </li>
                </ul>
                {cap ? (
                  // To'lish — yaxshi ko'rsatkich, ogohlantirish rangi kerak emas
                  <Meter
                    label={uz.groups.studentsLabel}
                    value={count / cap}
                    detail={`${count} / ${cap}`}
                    warnAt={2}
                    dangerAt={2}
                  />
                ) : (
                  <div className="flex items-center justify-between text-caption">
                    <span className="font-semibold text-muted-foreground">{uz.groups.studentsLabel}</span>
                    <span className="font-mono text-foreground">{count}</span>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between border-t border-border-soft pt-3 text-body">
                  <span className="text-muted-foreground">{uz.groups.priceLabel}</span>
                  <span className="font-mono font-bold text-foreground">
                    {money(g.price)}{" "}
                    <span className="text-caption font-normal text-muted-foreground">{uz.groups.perMonth}</span>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Layers />}
            title={uz.groups.empty}
            description={filtered ? uz.groups.emptyFiltered : uz.groups.emptyHint}
          />
        </Card>
      )}

      {perms.create || perms.edit || perms.changeTeacher ? (
        <GroupForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          courses={courses}
          teachers={teachers}
          rooms={rooms}
          branches={branches}
          selectedBranch={selectedBranch}
          canChangeTeacher={perms.changeTeacher}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ArchiveGroupModal group={toArchive} onClose={() => setToArchive(null)} onArchived={() => router.refresh()} />
    </div>
  );
}
