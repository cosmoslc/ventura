"use client";

import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Banknote,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  DoorOpen,
  FileText,
  GraduationCap,
  Layers,
  LineChart,
  RefreshCw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { DonutChart, type DonutSegment } from "@ventura/ui/donut-chart";
import { Gauge } from "@ventura/ui/gauge";
import { cn } from "@ventura/ui/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Sparkline } from "@ventura/ui/sparkline";
import { TrendChart, type TrendPoint } from "@ventura/ui/trend-chart";
import { type Period, compact, compactStr, kpiDelta, topWithOther } from "@/lib/dashboard";
import type { DashboardData, DashboardGroup } from "@/lib/server/dashboard";
import type { LeadDashboard } from "@/lib/server/lead-stats";
import { formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";

const t = uz.dashboard;
const ALL = "all";
const REFRESH_MS = 60_000;
const WEEK_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const EV_PAGE = 4;

/** Sahifalar: havola faqat ochiq bo'lsa (bo'lim yoqilgan va ruxsat bor) */
export type DashboardLinks = Partial<
  Record<
    | "payments"
    | "salaries"
    | "expenses"
    | "debtors"
    | "attendance"
    | "students"
    | "groups"
    | "teachers"
    | "rooms"
    | "leads",
    string
  >
>;

const monthShort = (month: string) => uz.months[Number(month.slice(5, 7)) - 1]!.slice(0, 3);
const shortDate = (date: string) => `${date.slice(8, 10)} ${monthShort(date.slice(0, 7))}`;
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const somFull = (n: number) => `${money(Math.round(n))} ${t.som}`;

function useNow(ms: number) {
  // Soat faqat brauzerda (serverda null — gidratsiya farqi bo'lmasin); qiymat `ms` qadami bilan barqaror
  const tick = React.useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, ms);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / ms) * ms,
    () => null,
  );
  return tick === null ? null : new Date(tick);
}

function useOnline() {
  return React.useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

const tashkentTime = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });

export function DashboardView({
  data,
  period,
  generatedAt,
  finance,
  leads,
  links,
}: {
  data: DashboardData;
  period: Period;
  generatedAt: string;
  /** "Moliyaviy ko'rsatkichlar" ruxsati — pul raqamlari faqat shunda keladi */
  finance: boolean;
  /** Lid kartalari (ADR 0027); null — "Konversiya va lidlar" ruxsati yoki Lidlar bo'limi yo'q */
  leads: LeadDashboard | null;
  links: DashboardLinks;
}) {
  const conversion = leads !== null;
  const router = useRouter();
  const pathname = usePathname();
  const now = useNow(15_000);
  const online = useOnline();
  const [syncing, startSync] = React.useTransition();

  // Jonli yangilanish: sahifa ko'rinib turganda har daqiqada server qayta o'qiydi (PLAN: avval davriy so'rov)
  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const setPeriod = (next: { yil?: string; oy?: string }) => {
    const q = new URLSearchParams({
      yil: next.yil ?? (period.year === null ? ALL : String(period.year)),
      oy: next.oy ?? (period.month === null ? ALL : String(period.month)),
    });
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const prevLabel = period.kind === "month" ? t.prevMonth : period.kind === "year" ? t.prevYear : "";
  const cur = data.cur;
  const prev = data.prev;
  const gauge = data.expected > 0 ? Math.min(1, data.covered / data.expected) : 0;
  const remaining = Math.max(0, data.expected - data.covered);
  const focusLabel = formatMonth(period.focusMonth);

  /* ---------- KPI ---------- */
  const kpis: KpiSpec[] = [
    ...(finance
      ? [
          {
            title: t.kpiIncome,
            money: cur.income,
            delta: kpiDelta(cur.income, prev?.income, "up"),
            icon: <Wallet />,
            color: "var(--chart-1)",
            kind: "area" as const,
            spark: data.months.map((m) => m.income),
            href: links.payments,
          },
          {
            title: t.kpiExpected,
            money: data.expected,
            note: t.kpiExpectedNote(Math.round(gauge * 100)),
            icon: <Coins />,
            color: "var(--chart-1)",
            kind: "bar" as const,
            spark: topValues(data.groups.map((g) => g.expected)),
            href: links.payments,
          },
          {
            title: t.kpiOutflow,
            money: cur.outflow,
            delta: kpiDelta(cur.outflow, prev?.outflow, "down"),
            icon: <TrendingDown />,
            color: "var(--chart-2)",
            kind: "area" as const,
            spark: data.months.map((m) => m.outflow),
            href: links.expenses,
          },
          {
            title: t.kpiProfit,
            money: cur.profit,
            delta: kpiDelta(cur.profit, prev?.profit, "up"),
            icon: <TrendingUp />,
            color: "var(--chart-1)",
            kind: "area" as const,
            spark: data.months.map((m) => m.profit),
          },
          {
            title: t.kpiDebt,
            money: data.totalDebt,
            note: t.kpiDebtNote(data.debtors),
            icon: <AlertCircle />,
            color: "var(--chart-2)",
            kind: "bar" as const,
            spark: topValues(data.groups.map((g) => g.debt)),
            href: links.debtors,
          },
        ]
      : []),
    {
      title: t.kpiAttendance,
      value: data.attendance.cur === null ? "0.0" : data.attendance.cur.toFixed(1),
      unit: "%",
      delta: data.attendance.cur !== null ? kpiDelta(data.attendance.cur, data.attendance.prev, "up", "pp") : null,
      note: data.attendance.cur === null ? t.kpiAttendanceNone : undefined,
      icon: <CalendarCheck />,
      color: "var(--chart-1)",
      kind: "bar",
      spark: data.months.map((m) => m.att ?? 0),
      href: links.attendance,
    },
    {
      title: t.kpiActive,
      value: money(data.students.active),
      unit: t.unitCount,
      delta: { text: `+${data.students.newInPeriod}`, tone: "up" },
      note: t.kpiActiveNote,
      icon: <GraduationCap />,
      color: "var(--chart-1)",
      kind: "bar",
      spark: data.months.map((m) => m.newStudents),
      href: links.students,
    },
    ...(finance
      ? [
          {
            title: t.kpiAdvance,
            money: cur.advance,
            delta: kpiDelta(cur.advance, prev?.advance, "down"),
            note: t.kpiAdvanceNote(cur.advanceCount),
            icon: <Banknote />,
            color: "var(--chart-2)",
            kind: "area" as const,
            spark: data.months.map((m) => m.advance),
            href: links.salaries,
          },
        ]
      : []),
    ...(leads
      ? [
          {
            title: t.kpiLeads,
            value: money(leads.stats.count),
            unit: t.unitCount,
            delta: kpiDelta(leads.stats.count, leads.stats.prevCount, "up", "count"),
            icon: <UserPlus />,
            color: "var(--chart-1)",
            kind: "bar" as const,
            spark: leads.stats.spark,
            href: links.leads,
          },
        ]
      : []),
    ...(finance
      ? [
          {
            title: t.kpiRefunds,
            money: cur.refund,
            delta: kpiDelta(cur.refund, prev?.refund, "down"),
            icon: <RotateCcw />,
            color: "var(--chart-2)",
            kind: "bar" as const,
            spark: data.months.map((m) => m.refund),
            href: links.payments,
          },
        ]
      : []),
  ];

  /* ---------- Donutlar ---------- */
  const s = data.students;
  const studentTotal = s.active + s.trial + s.paused + s.left + s.noGroup + s.graduated;
  const studentSegs: DonutSegment[] = [
    { label: t.segActive, value: s.active, color: "var(--success-fg)" },
    { label: t.segTrial, value: s.trial, color: "var(--chart-1)" },
    { label: t.segPaused, value: s.paused, color: "var(--warning-fg)" },
    { label: t.segLeft, value: s.left, color: "var(--danger-fg)" },
    { label: t.segNoGroup, value: s.noGroup, color: "var(--muted-foreground)" },
    { label: t.segGraduated, value: s.graduated, color: "var(--chart-3)" },
  ]
    .filter((x, i) => i < 4 || x.value > 0)
    .map((x) => ({ ...x, display: `${money(x.value)} ${t.unitCount}` }));

  const SPEND_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  const spendSegs: DonutSegment[] = topWithOther(
    [
      [t.spendSalaries, cur.salary],
      [t.spendRefunds, cur.refund],
      ...Object.entries(cur.categories).map(([k, v]) => [k || t.spendNoCategory, v] as [string, number]),
    ],
    t.other,
  ).map(([label, value], i) => ({ label, value, color: SPEND_COLORS[i]!, display: compactStr(value) }));
  const outflowC = compact(cur.outflow);

  /* ---------- Plitkalar ---------- */
  const tl = data.tiles;
  const tiles = [
    {
      label: t.tileGroups,
      value: money(tl.groups),
      unit: t.unitCount,
      note: t.tileGroupsNote(tl.avgPerGroup),
      icon: <Layers />,
      href: links.groups,
    },
    {
      label: t.tileTeachers,
      value: money(tl.activeTeachers),
      unit: t.unitCount,
      note: t.tileTeachersNote(tl.teachers),
      icon: <Users />,
      href: links.teachers,
    },
    {
      label: t.tileRooms,
      value: tl.avgFill === null ? "—" : tl.avgFill.toFixed(1),
      unit: tl.avgFill === null ? "" : "%",
      note: t.tileRoomsNote(tl.rooms),
      icon: <DoorOpen />,
      href: links.rooms,
    },
    {
      label: t.tileToday,
      value: money(tl.todayLessons),
      unit: t.unitCount,
      note: t.tileTodayNote(tl.studentsToday),
      icon: <BookOpen />,
      href: links.attendance,
    },
  ];

  const nowText = now ? tashkentTime(now) : "--:--";
  const todayText = now
    ? now
        .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Tashkent" })
        .replace(/\//g, ".")
    : "";

  return (
    <div className="space-y-4 pb-6 [container-type:inline-size]">
      {/* Yuqori qator */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="type-heading flex items-center gap-2 text-title text-foreground">
            {t.title}
            <Badge tone="info">{t.live}</Badge>
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i
                className={cn("size-1.5 rounded-full", online ? "animate-pulse bg-(--success-fg)" : "bg-(--danger-fg)")}
                aria-hidden
              />
              {online ? t.online : t.offline}
            </span>
            <Select
              value={period.year === null ? ALL : String(period.year)}
              onValueChange={(v) => setPeriod({ yil: v })}
            >
              <SelectTrigger className="h-(--control-h-sm) w-32" aria-label={t.year}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.allYears}</SelectItem>
                {data.years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {t.yearOption(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={period.month === null ? ALL : String(period.month)}
              onValueChange={(v) => setPeriod({ oy: v })}
            >
              <SelectTrigger className="h-(--control-h-sm) w-36" aria-label={t.month}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.allMonths}</SelectItem>
                {uz.months.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>{t.updated(tashkentTime(new Date(generatedAt)))}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <span className="hidden h-8 sm:flex items-center gap-1.5 rounded-control border border-border bg-card px-3 text-caption text-muted-foreground">
            <Calendar className="size-3.5" />
            {todayText}
          </span>
          <Button variant="ghost" size="sm" disabled={syncing} onClick={() => startSync(() => router.refresh())}>
            <RefreshCw className={cn(syncing && "animate-spin")} /> {t.refresh}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <FileText /> {t.print}
          </Button>
          <span className="hidden h-8 sm:flex items-center gap-1.5 rounded-control border border-border bg-card px-3 font-mono text-caption text-muted-foreground">
            <Clock className="size-3.5" />
            {nowText} {t.tz}
          </span>
        </div>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label={t.title}>
        {kpis.map((k) => (
          <KpiCard key={k.title} k={k} prevLabel={prevLabel} />
        ))}
      </section>

      {/* 2-qator */}
      <div
        className={cn(
          "grid gap-3 md:grid-cols-2",
          finance
            ? "2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.8fr)]"
            : "2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)]",
        )}
      >
        {finance ? <FlowCard data={data} period={period} /> : null}
        {finance ? (
          <Panel
            title={t.collectTitle}
            aside={<span className="text-caption text-muted-foreground">{focusLabel}</span>}
          >
            <Gauge value={gauge} label={t.collected} />
            <div className="flex justify-around gap-2 text-center">
              <div title={somFull(data.expected)}>
                <div className="text-caption text-muted-foreground">{t.expectedLabel}</div>
                <div className="font-bold text-foreground">{compactStr(data.expected)}</div>
              </div>
              <div title={somFull(data.covered)}>
                <div className="text-caption text-muted-foreground">{t.coveredLabel}</div>
                <div className="font-bold text-foreground">{compactStr(data.covered)}</div>
              </div>
            </div>
            <div
              className="mt-auto flex flex-wrap items-center justify-center gap-1.5 rounded-control bg-(--success-bg) px-3 py-2 text-caption text-(--success-fg)"
              title={somFull(remaining)}
            >
              {t.remaining} <b>{compactStr(remaining)}</b>
              <span>{data.expected > 0 ? `${((remaining / data.expected) * 100).toFixed(1)}%` : "0%"}</span>
            </div>
          </Panel>
        ) : null}
        <Panel title={t.studentsTitle} link={links.students ? { href: links.students, label: t.all } : undefined}>
          <DonutChart
            segments={studentSegs}
            center={money(studentTotal)}
            unit={t.total}
            size={150}
            emptyText={t.noData}
          />
        </Panel>
        <div className="grid grid-cols-2 gap-3 2xl:flex 2xl:flex-col">
          {tiles.map((x) => (
            <Tile key={x.label} {...x} />
          ))}
        </div>
      </div>

      {/* 3-qator */}
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <GroupsTable rows={data.groups} finance={finance} groupsHref={links.groups} />
        {leads ? (
          <Panel title={t.sourcesTitle} link={links.leads ? { href: links.leads, label: t.leadsLink } : undefined}>
            <DonutChart
              segments={topWithOther(leads.stats.sources, t.other).map(([label, value], i) => ({
                label,
                value,
                color: SPEND_COLORS[i]!,
                display: `${money(value)} ${t.unitCount}`,
              }))}
              center={money(leads.stats.count)}
              unit={t.leadUnit}
              size={120}
              emptyText={t.noLeads}
            />
          </Panel>
        ) : null}
        {finance ? (
          <Panel
            title={t.spendTitle}
            link={links.expenses ? { href: links.expenses, label: t.expensesLink } : undefined}
          >
            <DonutChart
              segments={spendSegs}
              center={outflowC.v}
              unit={`${outflowC.u ? `${outflowC.u} ` : ""}${t.som}`}
              size={120}
              emptyText={t.noData}
            />
          </Panel>
        ) : null}
      </div>

      {/* 4-qator */}
      {finance || conversion ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
          <Events data={data} finance={finance} leads={leads} paymentsHref={links.payments} leadsHref={links.leads} />
          {leads ? <Conversion leads={leads} period={period} prevLabel={prevLabel} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function periodLabel(p: Period) {
  if (p.kind === "month") return formatMonth(p.focusMonth);
  if (p.kind === "year") return t.yearLabel(p.year!);
  return t.allPeriod;
}

/** Eng katta 14 ta musbat qiymat (ustunli sparkline uchun) */
function topValues(xs: readonly number[]) {
  return xs
    .filter((v) => v > 0)
    .sort((a, b) => b - a)
    .slice(0, 14);
}

/* ---------- Kichik qismlar ---------- */

function Panel({
  title,
  aside,
  link,
  className,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  link?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col gap-3 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-caption font-bold tracking-wide text-foreground uppercase">{title}</h2>
        {link ? (
          <Link href={link.href} className="text-caption font-semibold text-primary-text hover:underline">
            {link.label}
          </Link>
        ) : (
          aside
        )}
      </div>
      {children}
    </Card>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="grid min-h-24 flex-1 place-items-center text-center text-caption text-muted-foreground">{text}</div>
  );
}

interface KpiSpec {
  title: string;
  /** Pul — qisqa yozuv (mln/ming) va to'liq summa maslahatda */
  money?: number;
  value?: string;
  unit?: string;
  delta?: { text: string; tone: "up" | "down" | "flat" } | null;
  note?: string;
  icon: React.ReactNode;
  color: string;
  kind: "area" | "bar";
  spark: number[];
  href?: string;
}

function KpiCard({ k, prevLabel }: { k: KpiSpec; prevLabel: string }) {
  let valText = k.value ?? "";
  let unit = k.unit ?? "";
  if (k.money !== undefined) {
    const c = compact(k.money);
    valText = c.v;
    unit = `${c.u ? `${c.u} ` : ""}${t.som}`;
  }
  const note = k.note ?? (k.delta ? prevLabel : "");
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-caption leading-tight font-semibold text-muted-foreground">{k.title}</span>
        <span className="grid size-7 shrink-0 place-items-center rounded-control bg-primary-soft text-primary-text [&_svg]:size-3.5">
          {k.icon}
        </span>
      </div>
      <div className="flex min-w-0 items-baseline gap-1">
        <b className="type-stat whitespace-nowrap text-foreground tabular-nums">{valText}</b>
        <span className="text-2xs font-semibold whitespace-nowrap text-muted-foreground">{unit}</span>
      </div>
      <div className="flex min-h-4 gap-1 truncate text-2xs text-muted-foreground">
        {k.delta?.text ? (
          <span
            className={cn(
              "font-bold",
              k.delta.tone === "up" && "text-(--success-fg)",
              k.delta.tone === "down" && "text-(--danger-fg)",
            )}
          >
            {k.delta.text}
          </span>
        ) : null}
        {note}
      </div>
      <div className="mt-auto">
        {k.spark.length ? <Sparkline values={k.spark} kind={k.kind} color={k.color} /> : <div className="h-6.5" />}
      </div>
    </>
  );
  const cls =
    "flex min-h-32 flex-col gap-1.5 rounded-card border border-border bg-card p-3 text-left shadow-card transition-colors";
  return k.href ? (
    <Link
      href={k.href}
      className={cn(cls, "hover:border-(--ring-border)")}
      title={k.money !== undefined ? somFull(k.money) : undefined}
    >
      {body}
    </Link>
  ) : (
    <div className={cls} title={k.money !== undefined ? somFull(k.money) : undefined}>
      {body}
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  note,
  icon,
  href,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-2xs text-muted-foreground">{label}</span>
        <b className="block text-body font-bold text-foreground tabular-nums">
          {value} <small className="text-2xs font-medium text-muted-foreground">{unit}</small>
        </b>
        <span className="block truncate text-2xs text-muted-foreground">{note}</span>
      </span>
    </>
  );
  const cls = "flex flex-1 items-center gap-3 rounded-card border border-border bg-card px-3 py-2 shadow-card";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-(--ring-border)")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ---------- Moliya dinamikasi ---------- */

function FlowCard({ data, period }: { data: DashboardData; period: Period }) {
  const [mode, setMode] = React.useState<"7" | "30" | "12">("30");
  const [kind, setKind] = React.useState<"area" | "bar">("area");

  let points: TrendPoint[];
  let limit: number;
  if (mode === "12") {
    points = data.months.map((m) => ({
      label: monthShort(m.month),
      tip: formatMonth(m.month),
      values: [m.income, m.outflow],
    }));
    limit = data.expected;
  } else {
    const days = mode === "7" ? data.days.slice(-7) : data.days;
    points = days.map((d) => {
      const wd = WEEK_SHORT[weekdayOf(d.date)]!;
      return {
        label: mode === "7" ? wd : String(Number(d.date.slice(8, 10))),
        tip: `${Number(d.date.slice(8, 10))} ${uz.months[Number(d.date.slice(5, 7)) - 1]!.toLowerCase()}, ${wd}`,
        values: [d.income, d.outflow],
        note: d.payCount ? t.payCount(d.payCount) : undefined,
      };
    });
    const [y, m] = period.focusMonth.split("-").map(Number);
    limit = data.expected / new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  }
  const vals = points.map((p) => p.values[0] ?? 0);
  const stats: [string, number][] = [
    [t.statMax, Math.max(0, ...vals)],
    [t.statMin, vals.length ? Math.min(...vals) : 0],
    [t.statAvg, vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length)],
    [t.statPlan, limit],
  ];

  const seg = "h-7 rounded-btn px-2.5 max-[900px]:h-10 text-caption font-semibold transition-colors";
  return (
    <Panel
      title={t.flowTitle}
      aside={
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-control border border-border p-0.5" role="group" aria-label={t.flowTitle}>
            {(
              [
                ["7", t.mode7],
                ["30", t.mode30],
                ["12", t.mode12],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={mode === v}
                onClick={() => setMode(v)}
                className={cn(
                  seg,
                  mode === v ? "bg-primary-soft text-primary-text" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex rounded-control border border-border p-0.5" role="group">
            <button
              type="button"
              aria-pressed={kind === "area"}
              aria-label={t.chartArea}
              title={t.chartArea}
              onClick={() => setKind("area")}
              className={cn(seg, kind === "area" ? "bg-primary-soft text-primary-text" : "text-muted-foreground")}
            >
              <LineChart className="size-3.5" />
            </button>
            <button
              type="button"
              aria-pressed={kind === "bar"}
              aria-label={t.chartBar}
              title={t.chartBar}
              onClick={() => setKind("bar")}
              className={cn(seg, kind === "bar" ? "bg-primary-soft text-primary-text" : "text-muted-foreground")}
            >
              <BarChart3 className="size-3.5" />
            </button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <TrendChart
          className="min-w-0"
          points={points}
          series={[
            { key: "income", label: t.seriesIncome, color: "var(--chart-1)" },
            { key: "outflow", label: t.seriesOutflow, color: "var(--chart-2)" },
          ]}
          limit={limit > 0 ? { label: t.plan, value: limit } : null}
          kind={kind}
          formatValue={somFull}
          formatAxis={compactStr}
          height={190}
          caption={t.flowCaption}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-border-soft pt-3 sm:grid-cols-4">
          {stats.map(([l, v]) => (
            <div key={l} title={somFull(v)}>
              <div className="text-2xs text-muted-foreground">{l}</div>
              <div className="text-body font-bold text-foreground tabular-nums">{compactStr(v)}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Guruhlar jadvali ---------- */

type SortKey = "count" | "payPct" | "att" | "debt";

function GroupsTable({ rows, finance, groupsHref }: { rows: DashboardGroup[]; finance: boolean; groupsHref?: string }) {
  const router = useRouter();
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "count", dir: -1 });
  const [all, setAll] = React.useState(false);
  const sorted = [...rows].sort((a, b) => ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * sort.dir);
  const shown = all ? sorted : sorted.slice(0, 5);
  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));

  const sortTh = (k: SortKey, label: string) => (
    <th key={k} className="px-2 py-2 text-left font-semibold">
      <button
        type="button"
        onClick={() => toggle(k)}
        aria-label={t.sortBy(label)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-primary-text")}
      >
        {label} <ArrowUpDown className="size-3" />
      </button>
    </th>
  );

  return (
    <Panel
      title={t.groupsTitle}
      className="md:col-span-2 2xl:col-span-1"
      link={groupsHref ? { href: groupsHref, label: t.allCount(rows.length) } : undefined}
    >
      {rows.length === 0 ? (
        <Placeholder text={t.noGroups} />
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[480px] text-caption">
            <thead className="border-b border-border-soft text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">{t.colGroup}</th>
                {sortTh("count", t.colStudents)}
                {finance ? sortTh("payPct", t.colPay) : null}
                <th className="px-2 py-2 text-left font-semibold">{t.colTeacher}</th>
                {sortTh("att", t.colAtt)}
                {finance ? sortTh("debt", t.colDebt) : null}
                <th className="px-2 py-2 text-left font-semibold">{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const low = (finance && r.payPct < 50) || (r.att !== null && r.att < 70);
                const full = r.cap !== null && r.cap > 0 && r.count >= r.cap;
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-muted"
                    onClick={() => router.push(`/groups/${r.id}`)}
                  >
                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="max-w-40 truncate px-2 py-2 font-semibold text-foreground" title={r.name}>
                      <Link href={`/groups/${r.id}`} onClick={(e) => e.stopPropagation()}>
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                      {r.count}
                      {r.cap ? ` / ${r.cap}` : ""}
                    </td>
                    {finance ? (
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2 tabular-nums">
                          {r.payPct}%
                          <span
                            className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-border-soft sm:block"
                            aria-hidden
                          >
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${r.payPct}%`,
                                background: r.payPct < 50 ? "var(--warning-fg)" : "var(--success-fg)",
                              }}
                            />
                          </span>
                        </span>
                      </td>
                    ) : null}
                    <td className="max-w-28 truncate px-2 py-2 text-muted-foreground" title={r.teacherName}>
                      {r.teacherName}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{r.att === null ? "—" : `${r.att.toFixed(0)}%`}</td>
                    {finance ? (
                      <td className="px-2 py-2 whitespace-nowrap tabular-nums" title={somFull(r.debt)}>
                        {r.debt ? compactStr(r.debt) : "—"}
                      </td>
                    ) : null}
                    <td className="px-2 py-2">
                      <Badge tone={full ? "info" : low ? "warning" : "success"}>
                        {full ? t.statusFull : low ? t.statusAttention : t.statusNorm}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 5 ? (
        <button
          type="button"
          className="mt-auto text-center text-2xs text-muted-foreground hover:text-primary-text"
          onClick={() => setAll((v) => !v)}
        >
          {all ? t.showLess : t.showMore}
        </button>
      ) : null}
    </Panel>
  );
}

/* ---------- So'nggi amallar ---------- */

function Events({
  data,
  finance,
  leads,
  paymentsHref,
  leadsHref,
}: {
  data: DashboardData;
  finance: boolean;
  leads: LeadDashboard | null;
  paymentsHref?: string;
  leadsHref?: string;
}) {
  const [page, setPage] = React.useState(0);
  const total = Math.max(finance ? data.events.length : 0, leads?.recent.length ?? 0);
  const pages = Math.max(1, Math.min(6, Math.ceil(total / EV_PAGE)));
  const idx = Math.min(page, pages - 1);
  const shown = data.events.slice(idx * EV_PAGE, idx * EV_PAGE + EV_PAGE);
  const shownLeads = leads?.recent.slice(idx * EV_PAGE, idx * EV_PAGE + EV_PAGE) ?? [];
  return (
    <Panel
      title={t.eventsTitle}
      aside={
        <div className="flex items-center gap-1 text-caption text-muted-foreground">
          <Button
            variant="icon"
            size="icon-sm"
            aria-label={t.pagePrev}
            disabled={idx === 0}
            onClick={() => setPage(idx - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">
            {idx + 1} / {pages}
          </span>
          <Button
            variant="icon"
            size="icon-sm"
            aria-label={t.pageNext}
            disabled={idx >= pages - 1}
            onClick={() => setPage(idx + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <div className={cn("grid flex-1 gap-6", finance && leads && "sm:grid-cols-2")}>
        {finance ? (
          <div className="min-w-0">
            <div className="mb-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t.eventsPayments}
            </div>
            {shown.length ? (
              <ul className="divide-y divide-border-soft">
                {shown.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2 text-caption">
                    <time className="w-14 shrink-0 text-muted-foreground tabular-nums">{shortDate(e.date)}</time>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {e.name}
                      {e.group ? <span className="text-muted-foreground"> · {e.group}</span> : null}
                    </span>
                    <Badge tone={e.refund ? "neutral" : "success"} title={somFull(e.amount)}>
                      {e.refund ? "−" : "+"}
                      {compactStr(e.amount)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Placeholder text={t.noPayments} />
            )}
          </div>
        ) : null}
        {leads ? (
          <div className="min-w-0">
            <div className="mb-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t.eventsLeads}
            </div>
            {shownLeads.length ? (
              <ul className="divide-y divide-border-soft">
                {shownLeads.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2 text-caption">
                    <time className="w-14 shrink-0 text-muted-foreground tabular-nums">{shortDate(l.date)}</time>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {leadsHref ? (
                        <Link href={`${leadsHref}/${l.id}`} className="hover:text-primary-text">
                          {l.name}
                        </Link>
                      ) : (
                        l.name
                      )}
                      {l.source ? <span className="text-muted-foreground"> · {l.source}</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: l.color }} />
                      {l.stage}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Placeholder text={t.noLeads} />
            )}
          </div>
        ) : null}
      </div>
      {finance && paymentsHref ? (
        <Link
          href={paymentsHref}
          className="mt-auto text-center text-2xs text-muted-foreground hover:text-primary-text"
        >
          {t.allPayments}
        </Link>
      ) : !finance && leadsHref ? (
        <Link href={leadsHref} className="mt-auto text-center text-2xs text-muted-foreground hover:text-primary-text">
          {t.allLeads}
        </Link>
      ) : null}
    </Panel>
  );
}

/* ---------- Lid konversiyasi (ADR 0027) ---------- */

function Conversion({ leads, period, prevLabel }: { leads: LeadDashboard; period: Period; prevLabel: string }) {
  const s = leads.stats;
  const diff = s.conv !== null && s.prevConv !== null ? s.conv - s.prevConv : null;
  return (
    <Panel
      title={t.conversionTitle}
      aside={<span className="text-caption text-muted-foreground">{periodLabel(period)}</span>}
    >
      <div className="flex items-baseline gap-2">
        {s.prevConv !== null ? (
          <>
            <span className="type-stat text-muted-foreground">{s.prevConv.toFixed(1)}%</span>
            <ArrowRight className="size-4 self-center text-muted-foreground" aria-hidden />
          </>
        ) : null}
        <span
          className={cn(
            "type-stat",
            diff === null || diff === 0 ? "text-foreground" : diff > 0 ? "text-(--success-fg)" : "text-(--danger-fg)",
          )}
        >
          {s.conv === null ? "—" : `${s.conv.toFixed(1)}%`}
        </span>
      </div>
      {diff !== null ? <p className="text-caption text-muted-foreground">{t.convDelta(prevLabel, diff)}</p> : null}
      <dl className="space-y-1.5 text-caption">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t.convJoined}</dt>
          <dd className="font-semibold text-foreground tabular-nums">
            {s.converted} / {s.count}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t.convLost}</dt>
          <dd className="truncate font-semibold text-foreground">
            {s.lostTop
              ? `${leads.stageNames[s.lostTop.stageId] ?? "—"} · ${s.lostTop.count} ${t.unitCount} (${s.lostTop.pct.toFixed(1)}%)`
              : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t.convPaid}</dt>
          <dd className="font-semibold text-foreground tabular-nums">
            {s.firstPaid} {t.unitCount}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
