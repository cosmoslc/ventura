import "server-only";
import { desc, inArray } from "drizzle-orm";
import type { Db } from "@/lib/server/memberships";
import { type HolidayType, holidayBranches, holidays } from "@ventura/db/schema/tenant";
import type { HolidayRange } from "@/lib/lessons";

export interface HolidayRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: HolidayType;
  affectsLessons: boolean;
  note: string | null;
  /** null — barcha filiallar */
  branchIds: string[] | null;
}

/** Bayramlar; `filter` berilsa — barcha filiallarga tegishli va shu filiallardan biriga tegishlilari */
export async function listHolidays(db: Db, filter: readonly string[] | null): Promise<HolidayRow[]> {
  const rows = await db.select().from(holidays).orderBy(desc(holidays.startDate));
  if (!rows.length) return [];
  const links = await db
    .select()
    .from(holidayBranches)
    .where(
      inArray(
        holidayBranches.holidayId,
        rows.map((r) => r.id),
      ),
    );
  return rows
    .map((h) => {
      const ids = links.filter((l) => l.holidayId === h.id).map((l) => l.branchId);
      return {
        id: h.id,
        name: h.name,
        startDate: h.startDate,
        endDate: h.endDate,
        type: h.type,
        affectsLessons: h.affectsLessons,
        note: h.note,
        branchIds: ids.length ? ids : null,
      };
    })
    .filter((h) => !filter || h.branchIds === null || h.branchIds.some((b) => filter.includes(b)));
}

/** Dars taqvimi uchun: [from, to] bilan kesishadigan bayramlar */
export async function holidayRanges(db: Db, from: string, to: string): Promise<(HolidayRange & { name: string })[]> {
  const all = await listHolidays(db, null);
  return all.filter((h) => h.startDate <= to && h.endDate >= from);
}
