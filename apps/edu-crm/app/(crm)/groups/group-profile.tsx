"use client";

import { ArrowLeft, Pencil, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { cn } from "@ventura/ui/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import type { SearchSelectOption } from "@ventura/ui/search-select";
import { formatDate, money } from "@/lib/format";
import type { FormField } from "@/lib/form-fields";
import { collectedPercent, groupEndDate, lessonMinutes } from "@/lib/group-profile";
import { uz } from "@/lib/uz";
import type { GroupAttendance } from "@/lib/server/attendance";
import type { PickerBranch } from "../branch-picker";
import { type MethodOption, PaymentDialog } from "../payments/payment-dialog";
import { StudentForm } from "../students/student-form";
import { enrollStudentAction } from "./actions";
import { ArchiveGroupModal } from "./archive-group-modal";
import { AttendanceTab } from "./attendance-tab";
import type { GroupProfileStats, GroupRow, MemberRow } from "./data";
import { type CourseOption, GroupForm, type RoomOption, type TeacherOption } from "./group-form";
import { LeftTab, MembersTab } from "./group-members";
import { daysLabel, type GroupPerms } from "./groups-view";
import { ActivateDialog, EnrollDialog, LeaveDialog, type MembershipTarget, phoneLabel } from "./membership-dialogs";

type Tab = "students" | "left" | "attendance";

const TONE = { trial: "info", active: "success", paused: "warning", left: "neutral" } as const;

/** O'quvchi profilidagi "Guruhlar" tabida ishlatiladi */
export function MembershipBadge({ status, activatedAt }: { status: MemberRow["status"]; activatedAt: string | null }) {
  return (
    <Badge tone={TONE[status]} dot>
      {status === "active" && activatedAt
        ? uz.groups.activeSince(formatDate(activatedAt))
        : uz.groups.membership[status]}
    </Badge>
  );
}

/** Yorliq + qiymat + bitta xira qator: sarlavha kartasidagi bitta ma'lumot */
function Fact({
  label,
  hint,
  tone,
  big,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  tone?: "danger";
  big?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="truncate text-caption font-semibold text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 truncate font-semibold text-foreground",
          big ? "type-stat leading-tight" : "text-body",
          tone === "danger" && "text-(--danger-fg)",
        )}
      >
        {children}
      </dd>
      {hint ? <div className="mt-0.5 text-caption break-words text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function GroupProfile({
  group: g,
  members,
  stats,
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
  payment,
}: {
  group: GroupRow;
  members: { open: MemberRow[]; left: MemberRow[] };
  /** A'zolar bo'yicha pul va davomat; `finance` null — moliya bo'limi o'chiq yoki ruxsat yo'q */
  stats: GroupProfileStats;
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
  attendance: GroupAttendance | null;
  today: string;
  canMarkToday: boolean;
  canEditPast: boolean;
  initialTab: Tab;
  /** To'lov qabul qilish oynasi uchun; null — to'lov yozish ruxsati yoki bo'limi yo'q */
  payment: { methods: MethodOption[]; maxDiscountPercent: number } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [formOpen, setFormOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [activate, setActivate] = React.useState<MembershipTarget | null>(null);
  const [leave, setLeave] = React.useState<MembershipTarget | null>(null);
  const [pay, setPay] = React.useState<{ open: boolean; student?: { id: string; name: string } }>({ open: false });

  const t = uz.groupProfile;
  const { finance } = stats;
  const count = members.open.length;
  const cap = g.roomCapacity;
  const memberIds = new Set(members.open.map((m) => m.studentId));
  const options = candidates
    .filter((c) => c.branchId === g.branchId && !memberIds.has(c.id))
    .map((c) => ({ id: c.id, title: c.name, subtitle: phoneLabel(c.phone) }));

  // Guruh davomati (so'nggi kunlar): a'zolar yig'indisidan, har belgilangan dars teng vaznda
  const attTotals = Object.values(stats.members).reduce(
    (s, m) => ({ came: s.came + (m.attendance?.came ?? 0), marked: s.marked + (m.attendance?.marked ?? 0) }),
    { came: 0, marked: 0 },
  );
  const groupRate = attTotals.marked ? Math.round((attTotals.came / attTotals.marked) * 100) : null;
  const debtors = Object.values(stats.members).filter((m) => (m.money?.due ?? 0) > 0).length;
  const fill = cap ? count / cap : null;
  const canArchive = perms.delete;

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="icon" size="icon" asChild title={uz.groups.back} aria-label={uz.groups.back}>
            <Link href="/groups">
              <ArrowLeft />
            </Link>
          </Button>
          <span className="size-3 shrink-0 rounded-full" style={{ background: g.color }} aria-hidden />
          <div className="min-w-0">
            <h1 className="type-heading text-title break-words text-foreground">{g.name}</h1>
            <div className="text-caption text-muted-foreground">{g.courseName}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {payment ? (
            <Button onClick={() => setPay({ open: true })}>
              <Wallet /> {t.payTitle}
            </Button>
          ) : null}
          {perms.edit || perms.changeTeacher ? (
            <Button variant="ghost" onClick={() => setFormOpen(true)}>
              <Pencil /> {uz.groups.formEdit}
            </Button>
          ) : null}
          {canArchive ? (
            <Button
              variant="icon"
              size="icon"
              className="text-destructive-text"
              title={t.archiveTooltip}
              aria-label={t.archiveTooltip}
              onClick={() => setArchiveOpen(true)}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Ma'lumot va ko'rsatkichlar — bitta karta */}
      <Card className="space-y-5 p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
          <Fact label={uz.groups.teacherCard}>
            <Link href={`/teachers/${g.teacherId}`} className="hover:text-primary" title={g.teacherName}>
              {g.teacherName}
            </Link>
          </Fact>
          <Fact label={uz.groups.roomCard}>{g.roomName ?? uz.groups.noRoom}</Fact>
          <Fact label={uz.groups.daysCard} hint={uz.groups.perWeek(g.days.length)}>
            {daysLabel(g.days)}
          </Fact>
          <Fact label={uz.groups.timeCard} hint={uz.groups.minutes(lessonMinutes(g.startTime, g.endTime))}>
            <span className="font-mono">
              {g.startTime} – {g.endTime}
            </span>
          </Fact>
          <Fact label={t.period} hint={t.months(g.durationMonths)} className="col-span-2 sm:col-span-1">
            <span className="font-mono">
              {t.periodValue(formatDate(g.startDate), formatDate(groupEndDate(g.startDate, g.durationMonths)))}
            </span>
          </Fact>
          <Fact label={t.price}>{t.priceValue(money(g.price))}</Fact>
        </dl>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border-soft pt-5 sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="truncate text-caption font-semibold text-muted-foreground">{t.kpiStudents}</dt>
            <dd className="type-stat mt-1 leading-tight font-semibold text-foreground">
              {cap !== null ? `${count} / ${cap}` : count}
            </dd>
            {fill !== null ? (
              <div
                role="meter"
                aria-label={t.kpiStudents}
                aria-valuemin={0}
                aria-valuemax={cap ?? 0}
                aria-valuenow={count}
                className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                style={{ background: "color-mix(in oklab, var(--primary) 16%, transparent)" }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-ios"
                  style={{
                    width: `${Math.min(100, Math.round(fill * 100))}%`,
                    background: fill > 1 ? "var(--danger-fg)" : fill >= 0.9 ? "var(--warning-fg)" : "var(--primary)",
                  }}
                />
              </div>
            ) : null}
            <div className="mt-1 text-caption break-words text-muted-foreground">
              {t.breakdown(g.members.active, g.members.trial, g.members.paused)}
            </div>
          </div>
          {finance ? (
            <>
              <Fact
                big
                label={t.kpiCollected}
                hint={t.kpiCollectedHint(money(finance.charged), collectedPercent(finance.charged, finance.collected))}
              >
                {money(finance.collected)}
                <span className="ml-1 text-caption font-normal text-muted-foreground">{uz.common.som}</span>
              </Fact>
              <Fact big label={t.kpiDue} tone={finance.due > 0 ? "danger" : undefined} hint={t.kpiDueHint(debtors)}>
                {money(finance.due)}
                <span className="ml-1 text-caption font-normal text-muted-foreground">{uz.common.som}</span>
              </Fact>
            </>
          ) : null}
          {attendance && groupRate !== null ? (
            <Fact big label={t.kpiAttendance} hint={t.kpiAttendanceHint(30)}>
              {uz.attendance.rate(groupRate)}
            </Fact>
          ) : null}
        </dl>

        {g.note ? (
          <div className="border-t border-border-soft pt-4">
            <div className="text-caption font-semibold text-muted-foreground">{t.note}</div>
            <p className="mt-1 text-body whitespace-pre-line text-foreground">{g.note}</p>
          </div>
        ) : null}
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="students">
            {t.tabMembers} <TabCount n={count} />
          </TabsTrigger>
          <TabsTrigger value="left">
            {t.tabLeft} <TabCount n={members.left.length} />
          </TabsTrigger>
          {attendance ? <TabsTrigger value="attendance">{t.tabAttendance}</TabsTrigger> : null}
        </TabsList>
      </Tabs>

      {tab === "students" ? (
        <MembersTab
          group={g}
          members={members.open}
          stats={stats}
          attendanceOn={attendance !== null}
          perms={perms}
          canCreateStudent={canCreateStudent}
          canPay={payment !== null}
          onAdd={() => setAddOpen(true)}
          onNew={() => setNewOpen(true)}
          onActivate={setActivate}
          onLeave={setLeave}
          onPay={(student) => setPay({ open: true, student })}
        />
      ) : null}

      {tab === "left" ? <LeftTab members={members.left} /> : null}

      {tab === "attendance" && attendance ? (
        <Card className="p-5">
          <AttendanceTab
            groupId={g.id}
            data={attendance}
            today={today}
            canMarkToday={canMarkToday}
            canEditPast={canEditPast}
          />
        </Card>
      ) : null}

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

      {canArchive ? (
        <ArchiveGroupModal
          group={archiveOpen ? { id: g.id, name: g.name } : null}
          onClose={() => setArchiveOpen(false)}
          onArchived={() => router.push("/groups")}
        />
      ) : null}

      {payment ? (
        <PaymentDialog
          open={pay.open}
          onOpenChange={(o) => setPay((p) => ({ ...p, open: o }))}
          students={members.open.map((m) => ({ id: m.studentId, title: m.name, subtitle: phoneLabel(m.phone) }))}
          studentId={pay.student?.id}
          studentName={pay.student?.name}
          groupId={g.id}
          methods={payment.methods}
          maxDiscountPercent={payment.maxDiscountPercent}
        />
      ) : null}

      <ActivateDialog target={activate} onOpenChange={(o) => !o && setActivate(null)} />
      <LeaveDialog target={leave} onOpenChange={(o) => !o && setLeave(null)} />
    </div>
  );
}

/** Tab yorlig'idagi son: nol bo'lsa ko'rsatilmaydi */
function TabCount({ n }: { n: number }) {
  return n ? <span className="font-mono text-caption text-muted-foreground">{n}</span> : null;
}
