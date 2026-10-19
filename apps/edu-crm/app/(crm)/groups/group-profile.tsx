"use client";

import {
  CalendarCheck,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { initials } from "@ventura/ui/avatar";
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
import { cn } from "@ventura/ui/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import type { SearchSelectOption } from "@ventura/ui/search-select";
import { formatDate, money } from "@/lib/format";
import type { FormField } from "@/lib/form-fields";
import { groupEndDate, lessonMinutes } from "@/lib/group-profile";
import { uz } from "@/lib/uz";
import type { GroupAttendance } from "@/lib/server/attendance";
import type { PickerBranch } from "../branch-picker";
import { type MethodOption, PaymentDialog } from "../payments/payment-dialog";
import { StudentForm } from "../students/student-form";
import { enrollStudentAction } from "./actions";
import { ArchiveGroupModal } from "./archive-group-modal";
import { AttendanceTab } from "./attendance-tab";
import { type GroupGrades, GradesTab } from "./grades-tab";
import type { GroupProfileStats, GroupRow, MemberRow } from "./data";
import { type CourseOption, GroupForm, type RoomOption, type TeacherOption } from "./group-form";
import { LeftTab, MembersTab } from "./group-members";
import { daysLabel, type GroupPerms } from "./groups-view";
import { ActivateDialog, EnrollDialog, LeaveDialog, type MembershipTarget, phoneLabel } from "./membership-dialogs";
import { SendSmsModal } from "../sms/send-sms-modal";

type Tab = "students" | "left" | "attendance" | "grades";

const TONE = { trial: "info", active: "success", paused: "warning", left: "neutral" } as const;

/** O'quvchi profilidagi "Guruhlar" tabida ishlatiladi */
export function MembershipBadge({
  status,
  activatedAt,
  leavePendingAt,
}: {
  status: MemberRow["status"];
  activatedAt: string | null;
  /** Qarz bilan chiqarish kutilmoqda (ADR 0050) */
  leavePendingAt?: string | null;
}) {
  return (
    <Badge tone={TONE[status]} dot>
      {leavePendingAt
        ? uz.groups.pendingLeave
        : status === "active" && activatedAt
          ? uz.groups.activeSince(formatDate(activatedAt))
          : uz.groups.membership[status]}
    </Badge>
  );
}

/** Chap kartadagi bitta ma'lumot: yorliq, qiymat va ixtiyoriy xira qator */
function Fact({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[0.9375rem] font-semibold break-words text-foreground">{children}</dd>
      {hint ? <div className="text-body text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/** Yuqoridagi ko'rsatkich kartasi: yorliq, katta qiymat, izoh; ikonka o'ng tepada */
function Kpi({
  icon,
  hue,
  label,
  value,
  danger,
  children,
}: {
  icon: React.ReactNode;
  /** Ikonka rangi; fon — shu rangning och (yarim shaffof) tusi */
  hue: string;
  label: string;
  value: string;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0">
        <div className="text-body text-muted-foreground">{label}</div>
        <div className={cn("mt-1 type-stat leading-tight font-bold text-foreground", danger && "text-(--danger-fg)")}>
          {value}
        </div>
        {children ? <div className="mt-1.5 text-body text-muted-foreground">{children}</div> : null}
      </div>
      <div
        className="grid size-10 shrink-0 place-items-center rounded-stat-icon [&_svg]:size-[18px]"
        style={{ background: `color-mix(in oklab, ${hue} 14%, transparent)`, color: hue }}
      >
        {icon}
      </div>
    </Card>
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
  grades,
  canGradeToday,
  canGradePast,
  today,
  canMarkToday,
  canEditPast,
  initialTab,
  payment,
  showBranch = false,
  sms = null,
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
  /** null — Baholash bo'limi o'chirilgan (ADR 0061) */
  grades: GroupGrades | null;
  canGradeToday: boolean;
  canGradePast: boolean;
  today: string;
  canMarkToday: boolean;
  canEditPast: boolean;
  initialTab: Tab;
  /** To'lov qabul qilish oynasi uchun; null — to'lov yozish ruxsati yoki bo'limi yo'q */
  payment: { methods: MethodOption[]; maxDiscountPercent: number } | null;
  /** Filial qatori: tepadagi tanlovda "Barcha filiallar" bo'lsa */
  showBranch?: boolean;
  /** Guruhga SMS (bo'lim yoqilgan va ruxsat bor) */
  sms?: { centerName: string } | null;
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
  const [smsOpen, setSmsOpen] = React.useState(false);

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

  const branchName = branches.find((b) => b.id === g.branchId)?.name ?? null;
  const canEdit = perms.edit || perms.changeTeacher;
  const smsReady = !!sms && count > 0;
  const hasMenu = canEdit || canArchive || payment !== null || smsReady;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      {/* Chap ustun: guruh kartasi */}
      <Card className="p-5 xl:sticky xl:top-[calc(var(--topbar-h)+1.5rem)]">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" asChild title={uz.groups.back} aria-label={uz.groups.back}>
            <Link href="/groups">
              <ChevronLeft />
            </Link>
          </Button>
          {hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" title={uz.common.actions} aria-label={uz.common.actions}>
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {payment ? (
                  <DropdownMenuItem onSelect={() => setPay({ open: true })}>
                    <Wallet /> {t.payTitle}
                  </DropdownMenuItem>
                ) : null}
                {smsReady ? (
                  <DropdownMenuItem onSelect={() => setSmsOpen(true)}>
                    <MessageSquareText /> {uz.smsSend.title}
                  </DropdownMenuItem>
                ) : null}
                {canEdit ? (
                  <DropdownMenuItem onSelect={() => setFormOpen(true)}>
                    <Pencil /> {uz.groups.formEdit}
                  </DropdownMenuItem>
                ) : null}
                {canArchive ? (
                  <>
                    {payment || canEdit || smsReady ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem danger onSelect={() => setArchiveOpen(true)}>
                      <Trash2 /> {t.archiveTooltip}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="mt-2 flex flex-col items-center text-center">
          <div className="grid size-22 place-items-center rounded-full bg-primary-soft text-2xl font-bold text-(--primary-text)">
            {initials(g.name)}
          </div>
          <h1 className="mt-4 type-heading text-lg leading-tight break-words text-foreground">{g.name}</h1>
          <div className="mt-1 text-body text-muted-foreground">{g.courseName}</div>
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-3.5 border-t border-border-soft pt-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
          <Fact label={uz.groups.teacherCard}>
            <Link
              href={`/teachers/${g.teacherId}`}
              className="text-(--primary-text) hover:underline"
              title={g.teacherName}
            >
              {g.teacherName}
            </Link>
          </Fact>
          <Fact label={t.schedule} hint={uz.groups.minutes(lessonMinutes(g.startTime, g.endTime))}>
            {daysLabel(g.days)} · {g.startTime}–{g.endTime}
          </Fact>
          <Fact label={uz.groups.roomCard}>{g.roomName ?? uz.groups.noRoom}</Fact>
          <Fact label={t.period} hint={t.months(g.durationMonths)}>
            {t.periodValue(formatDate(g.startDate), formatDate(groupEndDate(g.startDate, g.durationMonths)))}
          </Fact>
          <Fact label={t.price}>{t.priceValue(money(g.price))}</Fact>
          {showBranch && branchName ? <Fact label={t.branch}>{branchName}</Fact> : null}
          {g.note ? (
            <Fact label={t.note}>
              <span className="whitespace-pre-line">{g.note}</span>
            </Fact>
          ) : null}
        </dl>

        {attendance ? (
          <Button className="mt-5 w-full" onClick={() => setTab("attendance")}>
            <ClipboardCheck /> {t.takeAttendance}
          </Button>
        ) : null}
      </Card>

      {/* O'ng ustun: ko'rsatkichlar va bo'limlar */}
      <div className="min-w-0 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi
            icon={<Users />}
            hue="var(--nav-hue-violet)"
            label={t.kpiStudents}
            value={cap !== null ? `${count} / ${cap}` : String(count)}
          >
            {fill !== null ? (
              <div
                role="meter"
                aria-label={t.kpiStudents}
                aria-valuemin={0}
                aria-valuemax={cap ?? 0}
                aria-valuenow={count}
                className="mb-1 h-1.5 overflow-hidden rounded-full"
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
            {t.breakdown(g.members.active, g.members.trial, g.members.paused)}
          </Kpi>
          {attendance ? (
            <Kpi
              icon={<CalendarCheck />}
              hue="var(--nav-hue-emerald)"
              label={t.kpiAttendance}
              value={groupRate !== null ? uz.attendance.rate(groupRate) : "—"}
            >
              {t.kpiAttendanceHint(30)}
            </Kpi>
          ) : null}
          {finance ? (
            <Kpi
              icon={<CircleDollarSign />}
              hue="var(--nav-hue-orange)"
              label={t.kpiDue}
              value={`${money(finance.due)} ${uz.common.som}`}
              danger={finance.due > 0}
            >
              {t.debtorsCount(debtors, count)}
            </Kpi>
          ) : null}
        </div>

        <Card className="space-y-5 p-4 sm:p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="students">
                {t.tabMembers} <TabCount n={count} />
              </TabsTrigger>
              <TabsTrigger value="left">
                {t.tabLeft} <TabCount n={members.left.length} />
              </TabsTrigger>
              {attendance ? <TabsTrigger value="attendance">{t.tabAttendance}</TabsTrigger> : null}
              {grades ? <TabsTrigger value="grades">{uz.grades.tab}</TabsTrigger> : null}
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
              onAdd={() => setAddOpen(true)}
              onNew={() => setNewOpen(true)}
              onActivate={setActivate}
              onLeave={setLeave}
            />
          ) : null}

          {tab === "left" ? <LeftTab members={members.left} /> : null}

          {tab === "attendance" && attendance ? (
            <AttendanceTab
              groupId={g.id}
              data={attendance}
              today={today}
              canMarkToday={canMarkToday}
              canEditPast={canEditPast}
            />
          ) : null}

          {tab === "grades" && grades ? (
            <GradesTab
              groupId={g.id}
              data={grades}
              today={today}
              canMarkToday={canGradeToday}
              canEditPast={canGradePast}
            />
          ) : null}
        </Card>
      </div>

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
      {sms ? (
        <SendSmsModal
          open={smsOpen}
          onOpenChange={setSmsOpen}
          source="group"
          studentIds={members.open.map((m) => m.studentId)}
          groupId={g.id}
          title={uz.smsSend.titleGroup(g.name)}
          centerName={sms.centerName}
        />
      ) : null}
    </div>
  );
}

/** Tab yorlig'idagi son: nol bo'lsa ko'rsatilmaydi */
function TabCount({ n }: { n: number }) {
  return n ? <span className="font-mono text-caption text-muted-foreground">{n}</span> : null;
}
