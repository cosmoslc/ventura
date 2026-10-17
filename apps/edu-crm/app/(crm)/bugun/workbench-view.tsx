import { CalendarClock, Clock, PhoneCall, UserPlus, UserX, Wallet } from "lucide-react";
import Link from "next/link";
import { Card } from "@ventura/ui/card";
import { ListCard, ListCardProgress, ListCardRow, type ListCardTone } from "@ventura/ui/list-card";
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
    <div className="space-y-4">
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
              <ListCardRow
                key={g.id}
                title={
                  <Link href={`/groups/${g.id}`} className="block truncate">
                    {g.name}
                  </Link>
                }
                sub={`${g.course} · ${g.teacher} · ${t.students(g.students)}`}
                aside={
                  g.daysLeft < 0 ? t.endedAgo(-g.daysLeft) : g.daysLeft === 0 ? t.endsToday : t.daysLeft(g.daysLeft)
                }
                asideSub={formatDate(g.endDate)}
                tone={g.daysLeft < 0 ? "danger" : g.daysLeft <= 7 ? "warning" : "muted"}
              >
                <ListCardProgress value={g.progress} />
              </ListCardRow>
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
    <ListCard
      title={title}
      count={count}
      icon={icon}
      empty={empty}
      action={<Link href={href}>{t.open}</Link>}
      footer={more > 0 ? <Link href={href}>{t.more(more)}</Link> : undefined}
    >
      {children}
    </ListCard>
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
  tone: ListCardTone;
}) {
  const shown = displayPhone(phone);
  return (
    <ListCardRow
      title={
        <Link href={href} className="block truncate">
          {title}
        </Link>
      }
      sub={
        <>
          {shown ? (
            <a href={`tel:+998${phone}`} className="tabular-nums">
              {shown}
            </a>
          ) : null}
          {shown && sub ? " · " : null}
          {sub}
        </>
      }
      aside={aside}
      tone={tone}
    />
  );
}

function LeadRow({ lead, aside, tone }: { lead: WbLead; aside: string; tone: ListCardTone }) {
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
