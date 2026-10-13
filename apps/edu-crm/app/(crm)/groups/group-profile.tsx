"use client";

import {
  ArrowLeft,
  CalendarDays,
  CalendarCheck,
  Clock,
  DoorOpen,
  LogOut,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  UserPlus,
  UserRound,
  Users,
  Banknote,
  CircleDollarSign,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { EmptyState } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import { formatDate, formatMonth, money } from "@/lib/format";
import type { SearchSelectOption } from "@ventura/ui/search-select";
import type { FormField } from "@/lib/form-fields";
import { uz } from "@/lib/uz";
import type { GroupFinance } from "../payments/data";
import type { GroupAttendance } from "@/lib/server/attendance";
import type { PickerBranch } from "../branch-picker";
import { StudentForm } from "../students/student-form";
import { enrollStudentAction, pauseMembershipAction } from "./actions";
import { AttendanceTab } from "./attendance-tab";
import type { GroupRow, MemberRow } from "./data";
import { type CourseOption, GroupForm, type RoomOption, type TeacherOption } from "./group-form";
import { daysLabel, type GroupPerms } from "./groups-view";
import { ActivateDialog, EnrollDialog, LeaveDialog, type MembershipTarget, phoneLabel } from "./membership-dialogs";

type Tab = "students" | "left" | "attendance";

const TONE = { trial: "info", active: "success", paused: "warning", left: "neutral" } as const;

export function MembershipBadge({ status, activatedAt }: { status: MemberRow["status"]; activatedAt: string | null }) {
  return (
    <Badge tone={TONE[status]} dot>
      {status === "active" && activatedAt
        ? uz.groups.activeSince(formatDate(activatedAt))
        : uz.groups.membership[status]}
    </Badge>
  );
}

const minutesBetween = (a: string, b: string) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(b) - m(a);
};

export function GroupProfile({
  group: g,
  members,
  candidates,
  courses,
  teachers,
  rooms,
  studentFields,
  studentGroups,
  branches,
  perms,
  canCreateStudent,
  attendance,
  today,
  canMarkToday,
  canEditPast,
  initialTab,
  finance,
}: {
  group: GroupRow;
  members: { open: MemberRow[]; left: MemberRow[] };
  candidates: { id: string; name: string; phone: string; branchId: string }[];
  courses: CourseOption[];
  teachers: TeacherOption[];
  rooms: RoomOption[];
  /** "O'quvchi formasi"dagi qo'shimcha maydonlar va guruh tanlash variantlari */
  studentFields: FormField[];
  studentGroups: SearchSelectOption[];
  branches: PickerBranch[];
  perms: GroupPerms;
  canCreateStudent: boolean;
  /** null — Davomat bo'limi o'chirilgan */
  /** Shu oy moliyasi; null — moliya bo'limi o'chiq yoki ruxsat yo'q */
  finance: GroupFinance | null;
  attendance: GroupAttendance | null;
  today: string;
  canMarkToday: boolean;
  canEditPast: boolean;
  initialTab: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [query, setQuery] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [activate, setActivate] = React.useState<MembershipTarget | null>(null);
  const [leave, setLeave] = React.useState<MembershipTarget | null>(null);
  const [pending, startTransition] = React.useTransition();

  const count = members.open.length;
  const cap = g.roomCapacity;
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = members.open.filter(
    (m) => !q || m.name.toLowerCase().includes(q) || (!!digits && m.phone.includes(digits)),
  );
  const memberIds = new Set(members.open.map((m) => m.studentId));
  const options = candidates
    .filter((c) => c.branchId === g.branchId && !memberIds.has(c.id))
    .map((c) => ({ id: c.id, title: c.name, subtitle: phoneLabel(c.phone) }));
  const target = (m: MemberRow): MembershipTarget => ({
    id: m.id,
    studentName: m.name,
    groupName: g.name,
    enrolledAt: m.enrolledAt,
  });

  function pause(m: MemberRow, on: boolean) {
    startTransition(async () => {
      const res = await pauseMembershipAction({ id: m.id, pause: on });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: on ? uz.groups.frozen : uz.groups.unfrozen, description: m.name });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="icon" size="icon" asChild title={uz.groups.back} aria-label={uz.groups.back}>
            <Link href="/groups">
              <ArrowLeft />
            </Link>
          </Button>
          <span className="size-3 shrink-0 rounded-full" style={{ background: g.color }} aria-hidden />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="type-heading text-title text-foreground">{g.name}</h1>
              <Badge tone="neutral">{g.courseName}</Badge>
            </div>
            <div className="text-caption text-muted-foreground">{uz.groups.subtitle}</div>
          </div>
        </div>
        {perms.edit || perms.changeTeacher ? (
          <Button variant="ghost" onClick={() => setFormOpen(true)}>
            <Pencil /> {uz.groups.formEdit}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link href={`/teachers/${g.teacherId}`} className="block">
          <StatCard tone={1} icon={<UserRound />} label={uz.groups.teacherCard} value={g.teacherName} />
        </Link>
        <StatCard
          tone={2}
          icon={<DoorOpen />}
          label={uz.groups.roomCard}
          value={g.roomName ?? uz.groups.noRoom}
          hint={<div>{cap !== null ? uz.groups.capacity(cap) : uz.groups.noCapacity}</div>}
        />
        <StatCard
          tone={3}
          icon={<Clock />}
          label={uz.groups.timeCard}
          value={`${g.startTime} - ${g.endTime}`}
          hint={<div>{uz.groups.minutes(minutesBetween(g.startTime, g.endTime))}</div>}
        />
        <StatCard
          tone={4}
          icon={<CalendarDays />}
          label={uz.groups.daysCard}
          value={daysLabel(g.days)}
          hint={<div>{uz.groups.perWeek(g.days.length)}</div>}
        />
        <StatCard
          tone={1}
          icon={<Users />}
          label={uz.groups.studentsCard}
          value={cap !== null ? `${count} / ${cap}` : String(count)}
          hint={<div>{uz.groups.membersHint(g.members.active, g.members.paused)}</div>}
        />
        <StatCard tone={2} icon={<CalendarCheck />} label={uz.groups.startedCard} value={formatDate(g.startDate)} />
        {finance ? (
          <>
            <StatCard
              tone={3}
              icon={<Scale />}
              label={uz.groups.financeCharged(formatMonth(finance.month))}
              value={`${money(finance.charged)} ${uz.common.som}`}
            />
            <StatCard
              tone={2}
              icon={<Banknote />}
              label={uz.groups.financeCollected(formatMonth(finance.month))}
              value={`${money(finance.collected)} ${uz.common.som}`}
            />
            <StatCard
              tone={4}
              icon={<CircleDollarSign />}
              label={uz.groups.financeDue}
              value={`${money(finance.due)} ${uz.common.som}`}
            />
          </>
        ) : null}
      </div>

      <Card className="space-y-4 p-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="students">{uz.groups.tabStudents(count)}</TabsTrigger>
            <TabsTrigger value="left">
              {uz.groups.tabHistory} {members.left.length ? <Badge tone="neutral">{members.left.length}</Badge> : null}
            </TabsTrigger>
            {attendance ? (
              <TabsTrigger value="attendance">{uz.attendance.tab(attendance.dates.length)}</TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>

        {tab === "students" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <Input
                  icon={<Search />}
                  placeholder={uz.groups.studentSearch}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {perms.addStudent ? (
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" onClick={() => setAddOpen(true)}>
                    <UserPlus /> {uz.groups.addExisting}
                  </Button>
                  {canCreateStudent ? (
                    <Button onClick={() => setNewOpen(true)}>
                      <Plus /> {uz.groups.addNew}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {visible.length ? (
              <TableWrap>
                <Table className="min-w-[820px]">
                  <THead>
                    <tr>
                      <Th>{uz.groups.colStudent}</Th>
                      <Th>{uz.groups.colPhone}</Th>
                      <Th>{uz.groups.colGender}</Th>
                      <Th>{uz.groups.colSince}</Th>
                      <Th className="text-right">{uz.groups.colAction}</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {visible.map((m) => (
                      <Tr key={m.id}>
                        <Td>
                          <Link
                            href={`/students/${m.studentId}`}
                            className="text-body font-bold text-foreground hover:text-primary"
                          >
                            {m.name}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <MembershipBadge status={m.status} activatedAt={m.activatedAt} />
                            {m.parentName ? (
                              <span className="text-caption text-muted-foreground">· {m.parentName}</span>
                            ) : null}
                          </div>
                        </Td>
                        <Td className="font-mono">{phoneLabel(m.phone)}</Td>
                        <Td>
                          {m.gender === "female"
                            ? uz.students.female
                            : m.gender === "male"
                              ? uz.students.male
                              : uz.students.noData}
                        </Td>
                        <Td className="font-mono">{formatDate(m.enrolledAt)}</Td>
                        <Td>
                          <div className="flex justify-end gap-1.5">
                            {m.status === "trial" && perms.addStudent ? (
                              <Button size="sm" onClick={() => setActivate(target(m))}>
                                <Play /> {uz.groups.activate}
                              </Button>
                            ) : null}
                            {perms.freeze && m.status !== "trial" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => pause(m, m.status !== "paused")}
                              >
                                {m.status === "paused" ? <Play /> : <Pause />}
                                {m.status === "paused" ? uz.groups.unfreeze : uz.groups.freeze}
                              </Button>
                            ) : null}
                            {perms.removeStudent ? (
                              <Button
                                variant="icon"
                                size="icon-sm"
                                className="text-destructive-text"
                                title={uz.groups.remove}
                                aria-label={`${m.name} — ${uz.groups.remove}`}
                                onClick={() => setLeave(target(m))}
                              >
                                <LogOut />
                              </Button>
                            ) : null}
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState icon={<Users />} title={uz.groups.noStudents} description={uz.groups.noStudentsHint} />
            )}
          </>
        ) : null}

        {tab === "left" ? (
          members.left.length ? (
            <TableWrap>
              <Table className="min-w-[720px]">
                <THead>
                  <tr>
                    <Th>{uz.groups.colStudent}</Th>
                    <Th>{uz.groups.colSince}</Th>
                    <Th>{uz.groups.colLeft}</Th>
                    <Th>{uz.groups.colReason}</Th>
                  </tr>
                </THead>
                <TBody>
                  {members.left.map((m) => (
                    <Tr key={m.id}>
                      <Td>
                        <Link
                          href={`/students/${m.studentId}`}
                          className="text-body font-bold text-foreground hover:text-primary"
                        >
                          {m.name}
                        </Link>
                      </Td>
                      <Td className="font-mono">{formatDate(m.enrolledAt)}</Td>
                      <Td className="font-mono">{m.leftAt ? formatDate(m.leftAt) : "—"}</Td>
                      <Td className="text-muted-foreground">{m.leftReason ?? "—"}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState icon={<LogOut />} title={uz.groups.noLeft} />
          )
        ) : null}

        {tab === "attendance" && attendance ? (
          <AttendanceTab
            groupId={g.id}
            data={attendance}
            today={today}
            canMarkToday={canMarkToday}
            canEditPast={canEditPast}
          />
        ) : null}
      </Card>

      {perms.edit || perms.changeTeacher ? (
        <GroupForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={g}
          courses={courses}
          teachers={teachers}
          rooms={rooms}
          branches={branches}
          selectedBranch={g.branchId}
          canChangeTeacher={perms.changeTeacher}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {perms.addStudent ? (
        <EnrollDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          title={uz.groups.addTitle}
          searchPlaceholder={uz.groups.addSearch}
          emptyText={uz.groups.addEmpty}
          options={options}
          pair={(studentId) => ({ groupId: g.id, studentId })}
        />
      ) : null}

      {perms.addStudent && canCreateStudent ? (
        <StudentForm
          open={newOpen}
          onOpenChange={setNewOpen}
          editing={null}
          branches={branches.filter((b) => b.id === g.branchId)}
          selectedBranch={g.branchId}
          fields={studentFields}
          groups={studentGroups}
          onSaved={async (studentId) => {
            // Yaratilgan o'quvchi darhol shu guruhga (sinovda) qo'shiladi
            const res = await enrollStudentAction({ groupId: g.id, studentId });
            if (!res.ok) toast({ tone: "danger", title: res.error });
            else toast({ tone: "success", title: uz.groups.added });
            router.refresh();
          }}
        />
      ) : null}

      <ActivateDialog target={activate} onOpenChange={(o) => !o && setActivate(null)} />
      <LeaveDialog target={leave} onOpenChange={(o) => !o && setLeave(null)} />
    </div>
  );
}
