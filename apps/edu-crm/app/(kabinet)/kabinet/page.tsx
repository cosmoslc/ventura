import { Clock, DoorOpen, Users } from "lucide-react";
import { Card } from "@ventura/ui/card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { getTenantDb } from "@/lib/server/deps";
import { kabinetGroups } from "@/lib/server/kabinet";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";

export const metadata = { title: uz.kabinet.subtitle };

const t = uz.kabinet;

/** Kabinet bosh sahifasi (ADR 0062, 1-bosqich): o'z guruhlari. To'liq bosh sahifa 2-bosqichda. */
export default async function KabinetHome() {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const groups = await kabinetGroups(getTenantDb(tenant), staff.teacherId);
  return (
    <div className="space-y-section">
      <PageHeader title={t.hello(staff.name)} description={t.homeHint} />
      <h2 className="type-heading text-base">{t.groupsTitle}</h2>
      {groups.length ? (
        <div className="grid gap-grid sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} className="space-y-2 border-l-4 p-4" style={{ borderLeftColor: g.color }}>
              <div className="font-bold text-foreground">{g.name}</div>
              <div className="text-caption text-muted-foreground">{g.courseName}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground [&_svg]:size-3.5">
                <span className="flex items-center gap-1">
                  <Clock aria-hidden />
                  {g.days.map((d) => uz.weekdays.short[d as keyof typeof uz.weekdays.short]).join(", ")} · {g.startTime}
                  –{g.endTime}
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
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Users />} title={t.groupsEmpty} />
        </Card>
      )}
    </div>
  );
}
