import { ACTIVITY_SECTIONS, type ActivitySection } from "@/lib/activity-log";
import { ACTIVITY_PAGE_SIZE, activityActors, listActivity, staffActivity } from "@/lib/server/activity";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ActivityView } from "./activity-view";

export const metadata = { title: uz.activityLog.title };

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

const daysBefore = (day: string, n: number) => new Date(Date.parse(day) - n * 86_400_000).toISOString().slice(0, 10);

interface Params {
  from?: string;
  to?: string;
  actor?: string;
  section?: string;
  q?: string;
  page?: string;
}

/** Faoliyat jurnali (E6c): "Tizim harakatlari jurnali" (settings.logs) ruxsati bor xodim va direktor */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { tenant } = await requirePage("students", "/activity");
  const sp = await searchParams;
  const today = todayTashkent();
  let from = isDay(sp.from) ? sp.from : daysBefore(today, 6);
  let to = isDay(sp.to) ? sp.to : today;
  const rangeInvalid = from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 366;
  if (rangeInvalid) [from, to] = [daysBefore(today, 6), today];
  const section = ACTIVITY_SECTIONS.find((s) => s === sp.section) ?? null;
  const actorId = sp.actor && sp.actor.length <= 64 ? sp.actor : null;
  const q = (sp.q ?? "").slice(0, 100);
  const page = /^\d{1,6}$/.test(sp.page ?? "") ? Number(sp.page) : 1;

  const db = getTenantDb(tenant);
  const [list, actors, staff] = await Promise.all([
    listActivity(db, { from, to, actorId, section: section as ActivitySection | null, q, page }),
    activityActors(db),
    staffActivity(db, { from, to }),
  ]);
  return (
    <ActivityView
      rows={list.rows}
      total={list.total}
      page={list.page}
      pageSize={ACTIVITY_PAGE_SIZE}
      from={from}
      to={to}
      actorId={actorId ?? ""}
      section={section ?? ""}
      q={q}
      actors={actors}
      staff={staff}
      rangeInvalid={rangeInvalid}
    />
  );
}
