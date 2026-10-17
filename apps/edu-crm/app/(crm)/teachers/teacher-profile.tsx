"use client";

import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  Layers,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { MetricCard } from "@ventura/ui/metric-card";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import type { Payroll, ShareRow, TeacherPayrollRow } from "@/lib/server/payroll";
import { displayPhone, formatDate, formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import type { GroupRow } from "../groups/data";
import { daysLabel } from "../groups/groups-view";
import type { MethodOption } from "../payments/payment-dialog";
import type { SalaryEntryRow } from "../salaries/data";
import { SalaryForm, type SalaryFormState, type SalaryPerms } from "../salaries/salary-form";
import { archiveTeacherAction } from "./actions";
import type { TeacherOverview, TeacherRef, TeacherRow } from "./data";
import { TeacherForm } from "./teacher-form";
import { TeacherShares, TeacherTransactions } from "./teacher-salary";
import { type TeacherPerms, hoursLabel, salaryLabel } from "./teachers-view";

const tt = uz.teachers;
const som = (n: number) => `${money(n)} ${uz.common.som}`;
const MEMBER_TONE = { trial: "info", active: "success", paused: "warning", left: "neutral" } as const;

/** Maosh ma'lumoti — Ish haqi bo'limi yoqilgan va ruxsat bo'lsa (ADR 0018) */
export interface TeacherSalaryData {
  row: TeacherPayrollRow;
  groupNames: Record<string, string>;
  shares: ShareRow[];
  entries: SalaryEntryRow[];
  methods: MethodOption[];
  perms: SalaryPerms;
}

export type TeacherGroup = Pick<
  GroupRow,
  "id" | "name" | "courseName" | "days" | "startTime" | "endTime" | "price" | "members" | "color"
>;

type Tab = "transactions" | "shares" | "groups" | "students" | "supports";

/**
 * O'qituvchi profili (ADR 0021): sarlavhada oy tanlovi va "Maosh / Avans berish"; tepada oltita ko'rsatkich (balans,
 * retention, davomat, guruhlar, faol va sinovdagi o'quvchilar); chapda shaxsiy ma'lumotlar va ish shartlari; o'ngda
 * tablar — tranzaksiyalar, to'lovlardan hisoblangan ulush, faol guruhlar, o'quvchilar, yordamchi ustozlar.
 */
export function TeacherProfile({
  teacher: t,
  supports,
  mentor,
  mentors,
  branches,
  selectedBranch,
  perms,
  month,
  months,
  overview,
  groups,
  salary,
}: {
  teacher: TeacherRow;
  supports: { id: string; name: string }[];
  mentor: TeacherRef | null;
  mentors: { id: string; name: string }[];
  branches: PickerBranch[];
  selectedBranch: string;
  perms: TeacherPerms;
  month: string;
  months: string[];
  overview: TeacherOverview;
  groups: TeacherGroup[];
  salary: TeacherSalaryData | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [formOpen, setFormOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [salaryForm, setSalaryForm] = React.useState<SalaryFormState | null>(null);
  const [tab, setTab] = React.useState<Tab>(salary ? "transactions" : "groups");
  const support = t.kind === "support";
  const branch = branches.find((b) => b.id === t.branchId);
  const back = support ? "/teachers?tab=support" : "/teachers";

  const distinct = (pred: (s: TeacherOverview["students"][number]) => boolean) =>
    new Set(overview.students.filter(pred).map((s) => s.studentId)).size;
  const activeCount = distinct((s) => s.status === "active");
  const trialCount = distinct((s) => s.status === "trial");
  const totalCount = distinct(() => true);

  const person = `teacher:${t.id}`;
  const sp = salary?.perms;
  const canPay = !!sp && (sp.salary || sp.advance || sp.adjust);
  const b = salary?.row.balance;
  const income = b ? b.accrued + b.bonus - b.penalty : 0;
  const payroll: Payroll | null = salary
    ? {
        month,
        rows: [salary.row],
        totals: { revenue: salary.row.accrual.revenue, share: salary.row.accrual.total, center: 0 },
      }
    : null;
  const visibleEntries = salary?.entries.filter((e) => !e.voided).length ?? 0;
  const shareCount = salary?.shares.length ?? 0;

  async function archive() {
    const res = await archiveTeacherAction(t.id);
    if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
    toast({ tone: "success", title: tt.archived, description: t.name });
    router.push(back);
  }

  const pct = (v: number | null) => (v === null ? tt.noData : `${v}%`);
  const days =
    t.workingDays.length === 7
      ? tt.allWeek
      : t.workingDays.length
        ? t.workingDays.map((d) => uz.weekdays.short[d]).join(", ")
        : tt.notSet;

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="icon" size="icon" asChild title={tt.back} aria-label={tt.back}>
            <Link href={back}>
              <ArrowLeft />
            </Link>
          </Button>
          <Avatar name={t.name} size={48} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="type-heading text-title text-foreground">{t.name}</h1>
              <Badge tone={support ? "info" : "success"}>{support ? tt.kindSupport : tt.kindTeacher}</Badge>
            </div>
            <div className="mt-0.5 font-mono text-caption text-muted-foreground">{displayPhone(t.phone)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label={uz.salaries.month}
            value={month}
            onValueChange={(m) => router.push(`${pathname}?oy=${m}`, { scroll: false })}
            className="sm:w-44"
            options={months.map((m) => ({ value: m, label: formatMonth(m) }))}
          />
          {perms.edit ? (
            <Button variant="ghost" onClick={() => setFormOpen(true)}>
              <Pencil /> {tt.edit}
            </Button>
          ) : null}
          {perms.delete ? (
            <Button
              variant="icon"
              size="icon"
              className="text-destructive-text"
              title={tt.archive}
              aria-label={tt.archive}
              onClick={() => setConfirm(true)}
            >
              <Trash2 />
            </Button>
          ) : null}
          {canPay && b ? (
            <Button
              onClick={() =>
                setSalaryForm({ editing: null, person, month, amount: b.remaining > 0 ? b.remaining : null })
              }
            >
              <Plus /> {tt.payAction}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {b ? (
          <MetricCard
            label={tt.cardBalance}
            value={`${b.remaining > 0 ? "+" : b.remaining < 0 ? "−" : ""}${money(Math.abs(b.remaining))}`}
            unit={uz.common.som}
            badge={b.remaining > 0 ? tt.badgeRemaining : b.remaining < 0 ? tt.badgeDebt : tt.badgeEven}
            tone={b.remaining > 0 ? "success" : b.remaining < 0 ? "danger" : "neutral"}
            colorValue
            highlight={b.remaining !== 0}
            foot={tt.balanceFoot(money(income), money(b.paid))}
          />
        ) : null}
        <MetricCard
          label={tt.cardRetention}
          value={pct(overview.retention)}
          icon={<TrendingUp />}
          tone="primary"
          colorValue={overview.retention !== null}
          foot={tt.retentionFoot}
        />
        <MetricCard
          label={tt.cardAttendance}
          value={pct(overview.attendance)}
          icon={<UserCheck />}
          tone="info"
          colorValue={overview.attendance !== null}
          foot={tt.attendanceFoot(formatMonth(month))}
        />
        <MetricCard
          label={tt.cardGroups}
          value={String(groups.length)}
          unit={tt.unitGroups}
          icon={<Users />}
          tone="primary"
          foot={salary ? tt.groupsRevenue(som(salary.row.accrual.revenue)) : tt.groupsFoot}
        />
        <MetricCard
          label={tt.cardActive}
          value={String(activeCount)}
          unit={tt.unitStudents}
          icon={<GraduationCap />}
          tone="success"
          colorValue
          foot={tt.activeFoot(totalCount)}
        />
        <MetricCard
          label={tt.cardTrial}
          value={String(trialCount)}
          unit={tt.unitPeople}
          icon={<Sparkles />}
          tone="warning"
          colorValue
          foot={tt.trialFoot}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        {/* Shaxsiy ma'lumotlar (rasm va ism sarlavhada) */}
        <Card className="space-y-5 p-5 lg:col-span-4">
          <section>
            <h2 className="mb-1 text-caption font-bold tracking-wide text-muted-foreground uppercase">
              {tt.personalInfo}
            </h2>
            <dl className="divide-y divide-border-soft text-body">
              <Row icon={<Phone />} label={tt.phone}>
                <a href={`tel:+998${t.phone}`} className="font-mono text-primary-text hover:underline">
                  {displayPhone(t.phone)}
                </a>
              </Row>
              <Row icon={<User />} label={tt.gender}>
                {t.gender === "female" ? tt.female : t.gender === "male" ? tt.male : tt.notSet}
              </Row>
              <Row icon={<Calendar />} label={tt.birthDate}>
                {t.birthDate ? formatDate(t.birthDate) : tt.notSet}
              </Row>
              {support ? (
                <Row icon={<UserCheck />} label={tt.assignedTeacher}>
                  {mentor ? (
                    <Link href={`/teachers/${mentor.id}`} className="hover:text-primary">
                      {mentor.archived ? `${mentor.name} ${tt.archivedSuffix}` : mentor.name}
                    </Link>
                  ) : (
                    tt.notAssigned
                  )}
                </Row>
              ) : null}
            </dl>
          </section>
          <section>
            <h2 className="mb-1 text-caption font-bold tracking-wide text-muted-foreground uppercase">{tt.workInfo}</h2>
            <dl className="divide-y divide-border-soft text-body">
              <Row label={tt.branch}>{branch?.name ?? tt.notSet}</Row>
              <Row label={tt.salaryType}>
                <span className="text-(--success-fg)">{salaryLabel(t)}</span>
              </Row>
              <Row label={tt.workDays}>{days}</Row>
              {hoursLabel(t) ? <Row label={tt.workHours}>{hoursLabel(t)}</Row> : null}
            </dl>
          </section>
          <section>
            <div className="mb-1 text-caption font-semibold text-muted-foreground">{tt.note}</div>
            <p className="rounded-control border border-border-soft bg-muted px-3 py-2.5 text-body text-foreground">
              {t.note || tt.noNote}
            </p>
          </section>
        </Card>

        {/* Tablar */}
        <Card className="min-w-0 space-y-4 p-5 lg:col-span-8">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              {salary ? (
                <>
                  <TabsTrigger value="transactions">
                    {tt.tabTransactions} <Count n={visibleEntries} />
                  </TabsTrigger>
                  <TabsTrigger value="shares">
                    {tt.tabShares} <Count n={shareCount} />
                  </TabsTrigger>
                </>
              ) : null}
              <TabsTrigger value="groups">
                {tt.tabGroups} <Count n={groups.length} />
              </TabsTrigger>
              <TabsTrigger value="students">
                {tt.tabStudents} <Count n={totalCount} />
              </TabsTrigger>
              {!support ? (
                <TabsTrigger value="supports">
                  {tt.tabSupports} <Count n={supports.length} />
                </TabsTrigger>
              ) : null}
            </TabsList>
          </Tabs>

          {tab === "transactions" && salary ? (
            <>
              <div className="text-body font-bold text-foreground">
                {tt.transactionsTitle} <span className="font-normal text-muted-foreground">({formatMonth(month)})</span>
              </div>
              <TeacherTransactions
                entries={salary.entries}
                perms={salary.perms}
                onEdit={(e) => setSalaryForm({ editing: e, person: e.person, month: e.month, amount: e.amount })}
              />
            </>
          ) : null}
          {tab === "shares" && salary ? (
            <TeacherShares row={salary.row} groupNames={salary.groupNames} shares={salary.shares} />
          ) : null}
          {tab === "groups" ? <GroupsTab groups={groups} /> : null}
          {tab === "students" ? <StudentsTab students={overview.students} /> : null}
          {tab === "supports" && !support ? <SupportsTab supports={supports} /> : null}
        </Card>
      </div>

      {perms.edit ? (
        <TeacherForm
          open={formOpen}
          onOpenChange={setFormOpen}
          kind={t.kind}
          editing={t}
          mentors={mentors}
          branches={branches}
          selectedBranch={selectedBranch}
          onSaved={() => router.refresh()}
        />
      ) : null}
      {salary && payroll && canPay ? (
        <SalaryForm
          state={salaryForm}
          onClose={() => setSalaryForm(null)}
          people={[{ value: person, name: t.name, kind: "teacher" }]}
          methods={salary.methods}
          months={months}
          perms={salary.perms}
          payroll={payroll}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={confirm}
        onOpenChange={setConfirm}
        title={tt.archiveTitle}
        message={tt.archiveMessage(t.name)}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => void archive()}
      />
    </div>
  );
}

function Count({ n }: { n: number }) {
  return n ? <Badge tone="neutral">{n}</Badge> : null;
}

function GroupsTab({ groups }: { groups: TeacherGroup[] }) {
  if (!groups.length) return <EmptyState icon={<Layers />} title={tt.groupsEmpty} />;
  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr>
            <Th>{tt.colGroup}</Th>
            <Th>{tt.colCourse}</Th>
            <Th>{tt.colSchedule}</Th>
            <Th className="text-center">{tt.colStudents}</Th>
            <Th className="text-right">{tt.colPrice}</Th>
          </Tr>
        </THead>
        <TBody>
          {groups.map((g) => (
            <Tr key={g.id}>
              <Td>
                <Link
                  href={`/groups/${g.id}`}
                  className="flex items-center gap-2 font-semibold text-foreground hover:text-primary"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.color }} aria-hidden />
                  {g.name}
                </Link>
              </Td>
              <Td className="text-muted-foreground">{g.courseName}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                {daysLabel(g.days)} · {g.startTime} - {g.endTime}
              </Td>
              <Td className="text-center font-semibold">{g.members.active + g.members.trial + g.members.paused}</Td>
              <Td className="text-right whitespace-nowrap">{money(g.price)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}

function StudentsTab({ students }: { students: TeacherOverview["students"] }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const shown = students.filter(
    (s) =>
      (status === "all" || s.status === status) &&
      (!q || s.name.toLowerCase().includes(q) || (!!digits && s.phone.includes(digits))),
  );
  return (
    <div className="space-y-3">
      <FilterBar>
        <FilterSearch placeholder={tt.studentsSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={tt.colStatus}
          value={status}
          onValueChange={setStatus}
          options={Object.entries(tt.studentFilters).map(([value, label]) => ({ value, label }))}
        />
      </FilterBar>
      {shown.length ? (
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th>{tt.colName}</Th>
                <Th>{tt.phone}</Th>
                <Th>{tt.colGroup}</Th>
                <Th>{tt.colStatus}</Th>
              </Tr>
            </THead>
            <TBody>
              {shown.map((s) => (
                <Tr key={`${s.studentId}|${s.groupId}`}>
                  <Td>
                    <Link
                      href={`/students/${s.studentId}`}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {s.name}
                    </Link>
                  </Td>
                  <Td className="font-mono whitespace-nowrap text-muted-foreground">{displayPhone(s.phone)}</Td>
                  <Td className="text-muted-foreground">{s.groupName}</Td>
                  <Td>
                    <Badge tone={MEMBER_TONE[s.status]} dot>
                      {uz.groups.membership[s.status]}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      ) : (
        <EmptyState icon={<GraduationCap />} title={tt.studentsEmpty} />
      )}
    </div>
  );
}

function SupportsTab({ supports }: { supports: { id: string; name: string }[] }) {
  if (!supports.length) return <EmptyState icon={<UserCheck />} title={tt.noSupports} />;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {supports.map((s) => (
        <li key={s.id}>
          <Link
            href={`/teachers/${s.id}`}
            className="flex items-center gap-2.5 rounded-control border border-border-soft px-3 py-2.5 text-body font-semibold text-foreground hover:text-primary"
          >
            <Avatar name={s.name} size={28} /> {s.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Row({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="max-w-60 truncate text-right font-semibold text-foreground">{children}</dd>
    </div>
  );
}
