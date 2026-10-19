import "server-only";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { courses, groups, leadStages, leads, students, teachers, userBranches, users } from "@ventura/db/schema/tenant";
import { displayPhone } from "@/lib/format";
import { SEARCH_PER_KIND, type SearchHit, type SearchKind, parseQuery } from "@/lib/search";

/*
 * Global qidiruv (E6h, ADR 0039): har tur bo'yicha ism va telefon, ko'pi bilan SEARCH_PER_KIND tadan. Filial doirasi
 * `filter` (getBranchContext().filter) bilan, tur ruxsati va bo'lim yoqilganligi chaqiruvchi tomonidan `kinds` ga
 * kiritiladi — bu yerda faqat o'sha turlar qidiriladi. Arxivdagi yozuvlar chiqmaydi.
 */

const LIMIT = SEARCH_PER_KIND;
const inBranches = (col: Parameters<typeof inArray>[0], filter: readonly string[] | null): SQL | undefined =>
  filter ? inArray(col, [...filter]) : undefined;

export async function globalSearch(
  db: TenantDb,
  opts: { q: string; filter: readonly string[] | null; kinds: ReadonlySet<SearchKind> },
): Promise<SearchHit[]> {
  const q = parseQuery(opts.q);
  if (!q) return [];
  const { filter, kinds } = opts;
  const digits = q.digits ? `%${q.digits}%` : null;
  const phoneOr = (...cols: Parameters<typeof ilike>[0][]) => cols.map((c) => (digits ? ilike(c, digits) : undefined));

  const [studentHits, leadHits, groupHits, teacherHits, staffHits] = await Promise.all([
    kinds.has("student")
      ? db
          .select({ id: students.id, name: students.name, phone: students.phone })
          .from(students)
          .where(
            and(
              isNull(students.archivedAt),
              inBranches(students.branchId, filter),
              or(ilike(students.name, q.name), ...phoneOr(students.phone)),
            ),
          )
          .orderBy(asc(students.name))
          .limit(LIMIT)
      : [],
    kinds.has("lead")
      ? db
          .select({ id: leads.id, name: leads.name, phone: leads.phone, stage: leadStages.name })
          .from(leads)
          .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
          .where(
            and(
              isNull(leads.archivedAt),
              inBranches(leads.branchId, filter),
              or(ilike(leads.name, q.name), ...phoneOr(leads.phone, leads.phone2)),
            ),
          )
          .orderBy(asc(leads.name))
          .limit(LIMIT)
      : [],
    kinds.has("group")
      ? db
          .select({ id: groups.id, name: groups.name, course: courses.name, teacher: teachers.name })
          .from(groups)
          .innerJoin(courses, eq(courses.id, groups.courseId))
          .innerJoin(teachers, eq(teachers.id, groups.teacherId))
          .where(and(isNull(groups.archivedAt), inBranches(groups.branchId, filter), ilike(groups.name, q.name)))
          .orderBy(asc(groups.name))
          .limit(LIMIT)
      : [],
    kinds.has("teacher")
      ? db
          .select({ id: teachers.id, name: teachers.name, phone: teachers.phone })
          .from(teachers)
          .where(
            and(
              isNull(teachers.archivedAt),
              inBranches(teachers.branchId, filter),
              or(ilike(teachers.name, q.name), ...phoneOr(teachers.phone)),
            ),
          )
          .orderBy(asc(teachers.name))
          .limit(LIMIT)
      : [],
    kinds.has("staff")
      ? db
          .select({ id: users.id, name: users.name, phone: users.phoneNumber })
          .from(users)
          .where(
            and(
              isNull(users.archivedAt),
              eq(users.kind, "staff"),
              // Filial cheklovi bor xodim faqat o'z filialidagi xodimlarni ko'radi
              filter
                ? sql`exists (select 1 from ${userBranches} where ${userBranches.userId} = ${users.id} and ${inArray(userBranches.branchId, [...filter])})`
                : undefined,
              or(ilike(users.name, q.name), ...phoneOr(users.phoneNumber)),
            ),
          )
          .orderBy(asc(users.name))
          .limit(LIMIT)
      : [],
  ]);

  const phone = (p: string | null) => displayPhone(p) ?? p ?? "";
  return [
    ...studentHits.map((r) => ({
      id: r.id,
      kind: "student" as const,
      title: r.name,
      subtitle: phone(r.phone),
      href: `/students/${r.id}`,
    })),
    ...leadHits.map((r) => ({
      id: r.id,
      kind: "lead" as const,
      title: r.name,
      subtitle: [phone(r.phone), r.stage].join(" · "),
      href: `/leads/${r.id}`,
    })),
    ...groupHits.map((r) => ({
      id: r.id,
      kind: "group" as const,
      title: r.name,
      subtitle: [r.course, r.teacher].join(" · "),
      href: `/groups/${r.id}`,
    })),
    ...teacherHits.map((r) => ({
      id: r.id,
      kind: "teacher" as const,
      title: r.name,
      subtitle: phone(r.phone),
      href: `/teachers/${r.id}`,
    })),
    ...staffHits.map((r) => ({
      id: r.id,
      kind: "staff" as const,
      title: r.name,
      subtitle: phone(r.phone),
      href: `/staff/${r.id}`,
    })),
  ];
}
