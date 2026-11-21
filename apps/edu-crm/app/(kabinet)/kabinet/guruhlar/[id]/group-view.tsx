"use client";

import {
  ArrowLeft,
  Clock,
  Coins,
  DoorOpen,
  GraduationCap,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { MetricCard } from "@ventura/ui/metric-card";
import { Modal } from "@ventura/ui/modal";
import { EmptyState } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { formatMonth, money } from "@/lib/format";
import { COIN_AMOUNT_MAX, MANUAL_REASON_MAX } from "@/lib/coins";
import { type StudentStat, masteryLevel } from "@/lib/kabinet-stats";
import type { KabinetGroupData } from "@/lib/server/kabinet";
import { uz } from "@/lib/uz";
import { AttendanceTab } from "../../../../(crm)/groups/attendance-tab";
import { GradesTab } from "../../../../(crm)/groups/grades-tab";
import { giveCoinAction } from "../../../../(crm)/coins/actions";
import { HomeworkTab } from "./homework-tab";

const t = uz.kabinet;

export type KabinetTab = "attendance" | "grades" | "students" | "homework" | "stats";

export interface KabinetGroupPerms {
  attendanceToday: boolean;
  attendancePast: boolean;
  gradesToday: boolean;
  gradesPast: boolean;
  giveCoins: boolean;
}

const pct = (v: number | null) => (v === null ? t.none : `${v}%`);

/**
 * Kabinetdagi guruh (ADR 0062): sarlavha va to'rt tab. Davomat va baholash — admin guruh profilidagi jadvallarning
 * o'zi (amallar serverda guruh egasini tekshiradi), o'quvchi nomlari havolasiz.
 */
export function GroupView({
  data,
  month,
  today,
  initialTab,
  perms,
}: {
  data: KabinetGroupData;
  month: string;
  today: string;
  initialTab: KabinetTab;
  perms: KabinetGroupPerms;
}) {
  const [tab, setTab] = React.useState<KabinetTab>(initialTab);
  const g = data.group;

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-soft pb-5">
        <Button variant="icon" size="icon" asChild title={t.back} aria-label={t.back}>
          <Link href="/kabinet/guruhlar">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="h-10 w-1.5 rounded-full" style={{ background: g.color }} aria-hidden />
        <div className="min-w-0">
          <h1 className="type-heading text-title text-foreground">{g.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground [&_svg]:size-3.5">
            <span>{g.courseName}</span>
            <span className="flex items-center gap-1">
              <Clock aria-hidden />
              {g.days.map((d) => uz.weekdays.short[d as keyof typeof uz.weekdays.short]).join(", ")} · {g.startTime}–
              {g.endTime}
            </span>
            {g.roomName ? (
              <span className="flex items-center gap-1">
                <DoorOpen aria-hidden /> {g.roomName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Card className="space-y-5 p-4 sm:p-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as KabinetTab)}>
          <TabsList>
            {data.attendance ? <TabsTrigger value="attendance">{t.tabAttendance}</TabsTrigger> : null}
            {data.grades ? <TabsTrigger value="grades">{t.tabGrades}</TabsTrigger> : null}
            <TabsTrigger value="students">{t.tabStudents}</TabsTrigger>
            <TabsTrigger value="homework">{t.tabHomework}</TabsTrigger>
            <TabsTrigger value="stats">{t.tabStats}</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "attendance" && data.attendance ? (
          <AttendanceTab
            groupId={g.id}
            data={data.attendance}
            today={today}
            canMarkToday={perms.attendanceToday}
            canEditPast={perms.attendancePast}
            studentLinks={false}
          />
        ) : null}
        {tab === "grades" && data.grades ? (
          <GradesTab
            groupId={g.id}
            data={data.grades}
            today={today}
            canMarkToday={perms.gradesToday}
            canEditPast={perms.gradesPast}
            studentLinks={false}
          />
        ) : null}
        {tab === "students" ? (
          <StudentsTab
            groupId={g.id}
            members={data.members}
            coins={data.coins}
            manual={perms.giveCoins ? data.manualCoins : null}
          />
        ) : null}
        {tab === "homework" ? <HomeworkTab groupId={g.id} today={today} homeworks={data.homeworks} /> : null}
        {tab === "stats" ? <StatsTab stats={data.stats} month={month} grades={!!data.grades} /> : null}
      </Card>
    </div>
  );
}

/* ---------- O'quvchilar ---------- */

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  active: { label: t.statusActive, tone: "success" },
  trial: { label: t.statusTrial, tone: "warning" },
  paused: { label: t.statusPaused, tone: "neutral" },
};

function StudentsTab({
  groupId,
  members,
  coins,
  manual,
}: {
  groupId: string;
  members: KabinetGroupData["members"];
  coins: Record<string, number> | null;
  /** Qo'lda coin berish yoqilgan va ruxsat bor; null — tugma yo'q */
  manual: { dailyLimit: number } | null;
}) {
  const [giving, setGiving] = React.useState<{ studentId: string; name: string } | null>(null);
  if (!members.length) return <EmptyState icon={<Users />} title={t.noMembers} />;
  return (
    <>
      <TableWrap>
        <Table>
          <THead>
            <tr>
              <Th className="w-10">№</Th>
              <Th>{t.colStudent}</Th>
              <Th className="w-32">{t.colStatus}</Th>
              {coins ? <Th className="w-24 text-right">{t.colCoins}</Th> : null}
              {manual ? <Th className="w-36" /> : null}
            </tr>
          </THead>
          <TBody>
            {members.map((m, i) => (
              <Tr key={m.studentId}>
                <Td className="text-muted-foreground tabular-nums">{i + 1}</Td>
                <Td className="font-semibold text-foreground">{m.name}</Td>
                <Td>
                  <Badge tone={STATUS[m.status]?.tone ?? "neutral"}>{STATUS[m.status]?.label ?? m.status}</Badge>
                </Td>
                {coins ? (
                  <Td className="text-right font-mono font-semibold tabular-nums">{money(coins[m.studentId] ?? 0)}</Td>
                ) : null}
                {manual ? (
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGiving({ studentId: m.studentId, name: m.name })}
                    >
                      <Coins /> {uz.coins.give}
                    </Button>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>
      {manual ? (
        <GiveCoinModal
          key={giving?.studentId ?? "none"}
          groupId={groupId}
          student={giving}
          dailyLimit={manual.dailyLimit}
          onClose={() => setGiving(null)}
        />
      ) : null}
    </>
  );
}

function GiveCoinModal({
  groupId,
  student,
  dailyLimit,
  onClose,
}: {
  groupId: string;
  student: { studentId: string; name: string } | null;
  dailyLimit: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("1");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    if (!reason.trim()) return setError(uz.coins.manualReasonRequired);
    startTransition(async () => {
      const res = await giveCoinAction({
        groupId,
        studentId: student.studentId,
        amount: Number(amount) || 0,
        reason,
      });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.coins.given, description: student.name });
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={!!student}
      onOpenChange={(open) => (open ? null : onClose())}
      position="center"
      title={student ? uz.coins.giveTitle(student.name) : ""}
      description={uz.coins.giveLimitHint(dailyLimit)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="give-coin-form" disabled={pending}>
            <Coins /> {uz.coins.give}
          </Button>
        </>
      }
    >
      <form id="give-coin-form" onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="give-amount">{uz.coins.giveAmount}</Label>
          <Input
            id="give-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ""));
              setAmount(n ? String(Math.min(COIN_AMOUNT_MAX, n)) : "");
              setError(null);
            }}
          />
        </div>
        <div>
          <Label htmlFor="give-reason">{uz.coins.giveReason}</Label>
          <Textarea
            id="give-reason"
            rows={2}
            maxLength={MANUAL_REASON_MAX}
            placeholder={uz.coins.giveReasonPlaceholder}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}

/* ---------- Statistika ---------- */

function StatsTab({ stats, month, grades }: { stats: KabinetGroupData["stats"]; month: string; grades: boolean }) {
  const person = (s: StudentStat | null) => (s ? `${s.name} · ${pct(s.average)}` : t.none);
  return (
    <div className="space-y-section">
      <div className="text-caption text-muted-foreground">{t.statsMonth(formatMonth(month))}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label={t.mastery}
          value={pct(stats.mastery)}
          icon={<GraduationCap />}
          tone="primary"
          colorValue={stats.mastery !== null}
          foot={stats.mastery !== null ? uz.kabinet.levels[masteryLevel(stats.mastery)] : t.masteryFoot}
        />
        <MetricCard
          label={t.attendanceRate}
          value={pct(stats.attendance)}
          icon={<UserCheck />}
          tone="info"
          colorValue={stats.attendance !== null}
        />
        <MetricCard label={t.homeworkRate} value={pct(stats.homework)} icon={<Coins />} tone="success" />
        <MetricCard
          label={t.best}
          value={stats.best?.name ?? t.none}
          icon={<TrendingUp />}
          tone="success"
          foot={person(stats.best)}
        />
        <MetricCard
          label={t.worst}
          value={stats.worst?.name ?? t.none}
          icon={<TrendingDown />}
          tone="danger"
          foot={person(stats.worst)}
        />
      </div>
      {!grades ? <div className="text-caption text-muted-foreground">{t.gradesOff}</div> : null}
      {stats.students.length ? (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>{t.colStudent}</Th>
                <Th className="w-32 text-right">{t.colAverage}</Th>
                <Th className="w-28 text-right">{t.colAttendance}</Th>
                <Th className="w-28 text-right">{t.colHomework}</Th>
              </tr>
            </THead>
            <TBody>
              {[...stats.students]
                .sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.name.localeCompare(b.name))
                .map((s) => (
                  <Tr key={s.studentId}>
                    <Td className="font-semibold text-foreground">{s.name}</Td>
                    <Td className="text-right">
                      {s.average === null ? (
                        t.none
                      ) : (
                        <span className="font-mono font-semibold tabular-nums">
                          {s.average}% · {uz.kabinet.levels[masteryLevel(s.average)]}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right font-mono tabular-nums">{pct(s.attendance)}</Td>
                    <Td className="text-right font-mono tabular-nums">
                      {s.homeworkMarked ? `${s.homeworkDone}/${s.homeworkMarked}` : t.none}
                    </Td>
                  </Tr>
                ))}
            </TBody>
          </Table>
        </TableWrap>
      ) : (
        <EmptyState icon={<Users />} title={t.noMembers} />
      )}
    </div>
  );
}
