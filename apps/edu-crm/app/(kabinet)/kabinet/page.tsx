import { CalendarCheck, Clock, DoorOpen, Medal, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@ventura/ui/badge";
import { Card } from "@ventura/ui/card";
import { MetricCard } from "@ventura/ui/metric-card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { RankList } from "@ventura/ui/rank-list";
import { money } from "@/lib/format";
import { getTenantDb } from "@/lib/server/deps";
import { type KabinetDashboard, kabinetDashboard } from "@/lib/server/kabinet";
import { todayTashkent } from "@/lib/server/memberships";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";

export const metadata = { title: uz.kabinet.subtitle };

const t = uz.kabinet;

/**
 * Kabinet bosh sahifasi (ADR 0062): balans, reytingdagi o'rni, bugungi darslar, top-3 o'qituvchi (markaz, raqamsiz),
 * top-3 o'quvchi (o'z guruhlaridan, coin bo'yicha), pastda bugungi va barcha guruhlar.
 */
export default async function KabinetHome() {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const today = todayTashkent();
  const d = await kabinetDashboard(tenant, getTenantDb(tenant), staff.teacherId, today);
  const todays = d.groups.filter((g) => g.today);
  const b = d.balance;

  return (
    <div className="space-y-section">
      <PageHeader title={t.hello(staff.name)} description={t.homeHint} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {b ? (
          <MetricCard
            label={t.balance}
            value={`${b.remaining > 0 ? "+" : b.remaining < 0 ? "−" : ""}${money(Math.abs(b.remaining))}`}
            unit={uz.common.som}
            badge={b.remaining > 0 ? t.balanceRemaining : b.remaining < 0 ? t.balanceDebt : t.balanceEven}
            tone={b.remaining > 0 ? "success" : b.remaining < 0 ? "danger" : "neutral"}
            colorValue
            foot={t.balanceFoot(money(b.accrued), money(b.paid))}
          />
        ) : null}
        <MetricCard
          label={t.rank}
          value={d.rank ? `${d.rank.place} / ${d.rank.total}` : t.rankNone}
          icon={<Trophy />}
          tone="warning"
          colorValue={!!d.rank}
          foot={t.rankFoot}
        />
        <MetricCard
          label={t.todayLessons}
          value={String(todays.length)}
          icon={<CalendarCheck />}
          tone="primary"
          foot={t.todayLessonsFoot(todays.filter((g) => g.attendanceTaken).length, todays.length)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="type-heading flex items-center gap-2 text-base">
              <Medal className="size-4 text-primary" aria-hidden /> {t.topTeachers}
            </h2>
            <p className="text-caption text-muted-foreground">{t.topTeachersHint}</p>
          </div>
          <RankList
            items={d.topTeachers.map((x) => ({ id: x.id, name: x.name, me: x.me }))}
            self={d.rank ? { place: d.rank.place, total: d.rank.total, label: t.myPlace } : null}
            emptyLabel={t.noRank}
          />
        </Card>
        {d.topStudents ? (
          <Card className="space-y-3 p-5">
            <div>
              <h2 className="type-heading flex items-center gap-2 text-base">
                <Trophy className="size-4 text-primary" aria-hidden /> {t.topStudents}
              </h2>
              <p className="text-caption text-muted-foreground">{t.topStudentsHint}</p>
            </div>
            <RankList
              items={d.topStudents.map((x) => ({ id: x.id, name: x.name, value: t.coinsValue(money(x.coins)) }))}
              emptyLabel={t.noStudents}
            />
          </Card>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="type-heading text-base">{t.todayTitle}</h2>
        {todays.length ? (
          <GroupGrid groups={todays} withStatus />
        ) : (
          <Card>
            <EmptyState icon={<Clock />} title={t.noToday} />
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="type-heading text-base">{t.allGroups}</h2>
        {d.groups.length ? (
          <GroupGrid groups={d.groups} />
        ) : (
          <Card>
            <EmptyState icon={<Users />} title={t.groupsEmpty} />
          </Card>
        )}
      </section>
    </div>
  );
}

function GroupGrid({ groups, withStatus = false }: { groups: KabinetDashboard["groups"]; withStatus?: boolean }) {
  return (
    <div className="grid gap-grid sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <Link key={g.id} href={`/kabinet/guruhlar/${g.id}`} className="group">
          <Card
            className="h-full space-y-2 border-l-4 p-4 transition-colors group-hover:border-(--ring-border)"
            style={{ borderLeftColor: g.color }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-bold text-foreground group-hover:text-primary">{g.name}</div>
                <div className="truncate text-caption text-muted-foreground">{g.courseName}</div>
              </div>
              {withStatus ? (
                <Badge tone={g.attendanceTaken ? "success" : "warning"}>
                  {g.attendanceTaken ? t.attendanceTaken : t.attendanceMissing}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground [&_svg]:size-3.5">
              <span className="flex items-center gap-1">
                <Clock aria-hidden />
                {withStatus
                  ? `${g.startTime}–${g.endTime}`
                  : `${g.days.map((x) => uz.weekdays.short[x as keyof typeof uz.weekdays.short]).join(", ")} · ${g.startTime}–${g.endTime}`}
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
  );
}
