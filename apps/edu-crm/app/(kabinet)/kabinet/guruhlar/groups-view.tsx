"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock, DoorOpen, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { WeekSchedule } from "@ventura/ui/week-schedule";
import { addDays } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { weekDays, weekItems, weekStart } from "@/lib/kabinet-week";
import type { KabinetGroup } from "@/lib/server/kabinet";
import { uz } from "@/lib/uz";

const t = uz.kabinet;

export function GroupsView({ groups, monday, today }: { groups: KabinetGroup[]; monday: string; today: string }) {
  const router = useRouter();
  const days = weekDays(monday);
  // Dam olish kunlari faqat dars bo'lsa ko'rinadi
  const used = new Set(groups.flatMap((g) => g.days));
  const shown = days.filter((d) => (d.key !== "sat" && d.key !== "sun" ? true : used.has(d.key)));
  const items = weekItems(groups).map((g) => ({
    id: g.slotId,
    day: g.day,
    start: g.startTime,
    end: g.endTime,
    title: g.name,
    sub: g.roomName ?? g.courseName,
    color: g.color,
  }));
  const go = (m: string) => router.push(`/kabinet/guruhlar?hafta=${m}`, { scroll: false });
  const current = weekStart(today) === monday;

  return (
    <div className="space-y-section">
      <PageHeader title={t.navGroups} description={t.groupsDescription} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-heading flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" aria-hidden /> {t.weekTitle}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button
              variant="icon"
              size="icon-sm"
              title={t.weekPrev}
              aria-label={t.weekPrev}
              onClick={() => go(addDays(monday, -7))}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-44 text-center text-caption font-semibold text-foreground">
              {formatDate(monday)} – {formatDate(addDays(monday, 6))}
            </span>
            <Button
              variant="icon"
              size="icon-sm"
              title={t.weekNext}
              aria-label={t.weekNext}
              onClick={() => go(addDays(monday, 7))}
            >
              <ChevronRight />
            </Button>
            {!current ? (
              <Button variant="ghost" size="sm" onClick={() => go(weekStart(today))}>
                {t.weekNow}
              </Button>
            ) : null}
          </div>
        </div>
        <WeekSchedule
          days={shown.map((d) => ({
            key: d.key,
            label: uz.weekdays.short[d.key],
            sub: d.date.slice(8, 10) + "." + d.date.slice(5, 7),
            today: d.date === today,
          }))}
          items={items}
          onSelect={(id) => router.push(`/kabinet/guruhlar/${id.split("|")[0]}`)}
          emptyLabel={t.weekEmpty}
        />
      </section>

      <section className="space-y-3">
        <h2 className="type-heading text-base">{t.listTitle}</h2>
        {groups.length ? (
          <div className="grid gap-grid sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <Link key={g.id} href={`/kabinet/guruhlar/${g.id}`} className="group">
                <Card
                  className="h-full space-y-2 border-l-4 p-4 transition-colors group-hover:border-(--ring-border)"
                  style={{ borderLeftColor: g.color }}
                >
                  <div className="truncate font-bold text-foreground group-hover:text-primary">{g.name}</div>
                  <div className="truncate text-caption text-muted-foreground">{g.courseName}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground [&_svg]:size-3.5">
                    <span className="flex items-center gap-1">
                      <Clock aria-hidden />
                      {g.days.map((d) => uz.weekdays.short[d as keyof typeof uz.weekdays.short]).join(", ")} ·{" "}
                      {g.startTime}–{g.endTime}
                    </span>
                    {g.roomName ? (
                      <span className="flex items-center gap-1">
                        <DoorOpen aria-hidden /> {g.roomName}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <Users aria-hidden /> {t.students(g.students)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={<Users />} title={t.groupsEmpty} />
          </Card>
        )}
      </section>
    </div>
  );
}
