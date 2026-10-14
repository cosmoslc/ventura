import { CalendarClock, Clock, PhoneCall, UserPlus, UserX, Wallet } from "lucide-react";
import Link from "next/link";
import { Card } from "@ventura/ui/card";
import { cn } from "@ventura/ui/lib/utils";
import { MetricCard } from "@ventura/ui/metric-card";
import { PageHeader } from "@ventura/ui/page-header";
import { displayPhone, formatDate, money } from "@/lib/format";
import type { WbLead, WorkbenchData } from "@/lib/server/workbench";
import { uz } from "@/lib/uz";
import { todayTitle } from "@/lib/workbench";

const t = uz.workbench;
const LIMIT = 8;
const WEEKDAYS = [
  uz.weekdays.full.sun,
  uz.weekdays.full.mon,
  uz.weekdays.full.tue,
  uz.weekdays.full.wed,
  uz.weekdays.full.thu,
  uz.weekdays.full.fri,
  uz.weekdays.full.sat,
];

type Tone = "muted" | "danger" | "warning" | "success";
const TONE: Record<Tone, string> = {
  muted: "text-muted-foreground",
  danger: "text-(--danger-fg)",
  warning: "text-(--warning-fg)",
  success: "text-(--success-fg)",
};

/**
 * "Bugungi ishlar" (ADR 0027): tepada qisqa ko'rsatkichlar, pastda bloklar. Har blok — ro'yxat (8 tagacha) va
 * to'liq sahifaga havola. Ko'rinmaydigan blok (ruxsat yoki bo'lim yo'q) umuman chizilmaydi.
 */
export function WorkbenchView({ data, today }: { data: WorkbenchData; today: string }) {
  const { leads, absent, debtors, ending } = data;
  const overdue = leads?.followUps.filter((l) => l.overdue > 0).length ?? 0;
  const metrics = [
    leads && (
      <MetricCard
        key="follow"
        label={t.followUps}
        value={String(leads.followUps.length)}
        unit={uz.dashboard.unitCount}
        icon={<PhoneCall />}
        tone={overdue ? "warning" : "primary"}
        foot={overdue ? t.overdueCount(overdue) : t.noneOverdue}
      />
    ),
    leads && (
      <MetricCard
        key="lessons"
        label={t.firstLessons}
        value={String(leads.firstLessons.length)}
        unit={uz.dashboard.unitCount}
        icon={<CalendarClock />}
        tone="info"
        foot={t.unassignedCount(leads.unassigned.length)}
      />
    ),
    absent && (
      <MetricCard
        key="absent"
        label={t.absent}
        value={String(absent.list.length)}
        unit={uz.dashboard.unitCount}
        icon={<UserX />}
        tone={absent.list.length ? "danger" : "neutral"}
        foot={t.lessonsMarked(absent.lessons, absent.marked)}
      />
    ),
    debtors && (
      <MetricCard
        key="debtors"
        label={t.debtors}
        value={String(debtors.count)}
        unit={uz.dashboard.unitCount}
        icon={<Wallet />}
        tone={debtors.count ? "danger" : "neutral"}
        foot={`${money(debtors.total)} ${uz.common.som}`}
      />
    ),
    ending && (
      <MetricCard
        key="ending"
        label={t.ending}
        value={String(ending.length)}
        unit={uz.dashboard.unitCount}
        icon={<Clock />}
        tone={ending.some((g) => g.daysLeft < 0) ? "warning" : "neutral"}
        foot={t.endingWindow}
      />
    ),
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={todayTitle(today, uz.months, WEEKDAYS)} />

      {metrics.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{metrics}</div>
      ) : (
        <Card className="p-6 text-center text-body text-muted-foreground">{t.nothing}</Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {leads ? (
          <>
            <Block title={t.followUps} count={leads.followUps.length} href="/leads" empty={t.followUpsEmpty}>
              {leads.followUps.slice(0, LIMIT).map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  aside={l.overdue > 0 ? t.overdue(l.overdue) : t.dueToday}
                  tone={l.overdue > 0 ? "danger" : "warning"}
                />
              ))}
            </Block>
            <Block title={t.firstLessons} count={leads.firstLessons.length} href="/leads" empty={t.firstLessonsEmpty}>
              {leads.firstLessons.slice(0, LIMIT).map((l) => (
                <LeadRow
                  key={l.id}
                  lead={{ ...l, course: l.group }}
                  aside={l.status === "scheduled" ? (l.time ?? "—") : t.lessonStatus[l.status]!}
                  tone={l.status === "came" ? "success" : l.status === "absent" ? "danger" : "muted"}
                />
              ))}
            </Block>
            <Block
              title={t.unassigned}
              count={leads.unassigned.length}
              href="/leads"
              empty={t.unassignedEmpty}
              icon={<UserPlus />}
            >
              {leads.unassigned.slice(0, LIMIT).map((l) => (
                <LeadRow key={l.id} lead={l} aside={l.source ?? t.noSource} tone="muted" />
              ))}
            </Block>
          </>
        ) : null}

        {absent ? (
          <Block title={t.absent} count={absent.list.length} href="/attendance" empty={t.absentEmpty}>
            {absent.list.slice(0, LIMIT).map((a) => (
              <Row
                key={`${a.studentId}-${a.groupId}`}
                href={`/students/${a.studentId}`}
                title={a.name}
                sub={[a.group, a.time.slice(0, 5), a.reason].filter(Boolean).join(" · ")}
                phone={a.phone}
                aside={t.absentStatus[a.status]!}
                tone={a.status === "excused" ? "warning" : "danger"}
              />
            ))}
          </Block>
        ) : null}

        {debtors ? (
          <Block title={t.debtors} count={debtors.count} href="/debtors" empty={t.debtorsEmpty}>
            {debtors.top.map((d) => (
              <Row
                key={d.studentId}
                href={`/students/${d.studentId}`}
                title={d.name}
                sub={[d.groups, d.overdueDays > 0 ? t.overdue(d.overdueDays) : null].filter(Boolean).join(" · ")}
                phone={d.phone}
                aside={`${money(d.debt)} ${uz.common.som}`}
                tone="danger"
              />
            ))}
          </Block>
        ) : null}

        {ending ? (
          <Block title={t.ending} count={ending.length} href="/groups" empty={t.endingEmpty}>
            {ending.slice(0, LIMIT).map((g) => (
              <li key={g.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/groups/${g.id}`}
                      className="block truncate text-body font-semibold text-foreground hover:text-primary-text"
                    >
                      {g.name}
                    </Link>
                    <div className="truncate text-caption text-muted-foreground">
                      {g.course} · {g.teacher} · {t.students(g.students)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={cn(
                        "text-caption font-semibold",
                        g.daysLeft < 0 ? TONE.danger : g.daysLeft <= 7 ? TONE.warning : TONE.muted,
                      )}
                    >
                      {g.daysLeft < 0
                        ? t.endedAgo(-g.daysLeft)
                        : g.daysLeft === 0
                          ? t.endsToday
                          : t.daysLeft(g.daysLeft)}
                    </div>
                    <div className="text-2xs text-muted-foreground tabular-nums">{formatDate(g.endDate)}</div>
                  </div>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${g.progress}%` }} />
                </div>
              </li>
            ))}
          </Block>
        ) : null}
      </div>
    </div>
  );
}

function Block({
  title,
  count,
  href,
  empty,
  icon,
  children,
}: {
  title: string;
  count: number;
  href: string;
  empty: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const more = count - LIMIT;
  return (
    <Card className="flex min-w-0 flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-caption font-bold tracking-wide text-foreground uppercase [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {title}
          <span className="font-semibold text-muted-foreground tabular-nums">{count}</span>
        </h2>
        <Link href={href} className="text-caption font-semibold text-primary-text hover:underline">
          {t.open}
        </Link>
      </div>
      {count ? (
        <ul className="mt-2 divide-y divide-border-soft">{children}</ul>
      ) : (
        <p className="grid min-h-24 flex-1 place-items-center text-center text-caption text-muted-foreground">
          {empty}
        </p>
      )}
      {more > 0 ? (
        <Link href={href} className="mt-2 text-center text-caption text-muted-foreground hover:text-primary-text">
          {t.more(more)}
        </Link>
      ) : null}
    </Card>
  );
}

function Row({
  href,
  title,
  sub,
  phone,
  aside,
  tone,
}: {
  href: string;
  title: string;
  sub: string;
  phone: string;
  aside: string;
  tone: Tone;
}) {
  const shown = displayPhone(phone);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate text-body font-semibold text-foreground hover:text-primary-text">
          {title}
        </Link>
        <div className="truncate text-caption text-muted-foreground">
          {shown ? (
            <a href={`tel:+998${phone}`} className="tabular-nums hover:text-primary-text">
              {shown}
            </a>
          ) : null}
          {shown && sub ? " · " : null}
          {sub}
        </div>
      </div>
      <span className={cn("shrink-0 text-caption font-semibold", TONE[tone])}>{aside}</span>
    </li>
  );
}

function LeadRow({ lead, aside, tone }: { lead: WbLead; aside: string; tone: Tone }) {
  return (
    <Row
      href={`/leads/${lead.id}`}
      title={lead.name}
      sub={[lead.course, lead.assigned].filter(Boolean).join(" · ")}
      phone={lead.phone}
      aside={aside}
      tone={tone}
    />
  );
}
