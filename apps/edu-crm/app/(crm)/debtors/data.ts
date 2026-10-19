import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { groups, studentNotes, students, teachers } from "@ventura/db/schema/tenant";
import { overdueDays } from "@/lib/ledger";
import { type FinanceSettings, loadAccountsCached } from "@/lib/server/finance";

/*
 * Qarzdorlar (ADR 0015): barcha oylar bo'yicha yig'ilgan qarz — balans manfiy bo'lgan o'quvchilar. Eski tizimda
 * faqat joriy oy qarzi ko'rinar, muddat har doim 10-sana deb olinar va arxivdagilar ham kirar edi (izohsiz).
 */

export interface DebtGroup {
  id: string;
  name: string;
  teacherId: string | null;
  teacherName: string | null;
  due: number;
  months: string[];
}

/** Qarzdor bilan bog'lanish izohlari: qo'ng'iroq, xabar, ota-ona bilan suhbat, ogohlantirish (ADR 0042) */
export const DEBTOR_NOTE_KINDS = ["call", "message", "parent", "warning"] as const;

export interface DebtorNote {
  kind: (typeof DEBTOR_NOTE_KINDS)[number];
  text: string;
  authorName: string;
  /** ISO vaqt */
  at: string;
}

export interface DebtorRow {
  studentId: string;
  name: string;
  phone: string;
  parentName: string | null;
  parentPhone: string | null;
  archived: boolean;
  debt: number;
  otherDebt: number;
  groups: DebtGroup[];
  oldestUnpaid: string | null;
  /** Eng eski yopilmagan oy muddatidan o'tgan kunlar (0 — muddati kelmagan) */
  overdueDays: number;
  /** Joriy oy qisman to'langan */
  partial: boolean;
  /** Eng oxirgi bog'lanish izohi (jadvalda faqat shu ko'rsatiladi) */
  note: DebtorNote | null;
}

const localPhone = (p: string | null) => (p ? p.replace(/\D/g, "").slice(-9) : null);

export async function listDebtors(
  db: TenantDb,
  filter: readonly string[] | null,
  today: string,
  fs: FinanceSettings,
): Promise<DebtorRow[]> {
  const list = await db
    .select()
    .from(students)
    .where(filter ? inArray(students.branchId, [...filter]) : undefined);
  if (!list.length) return [];
  const accounts = await loadAccountsCached(
    db,
    list.map((s) => s.id),
    today,
    fs,
  );
  const debtors = list.filter((s) => (accounts.get(s.id)?.summary.debt ?? 0) > 0);
  if (!debtors.length) return [];
  const groupIds = [...new Set(debtors.flatMap((s) => accounts.get(s.id)!.summary.groups.map((g) => g.groupId)))];
  const groupRows = groupIds.length
    ? await db
        .select({ id: groups.id, name: groups.name, teacherId: groups.teacherId, teacherName: teachers.name })
        .from(groups)
        .leftJoin(teachers, eq(teachers.id, groups.teacherId))
        .where(inArray(groups.id, groupIds))
    : [];
  const groupById = new Map(groupRows.map((g) => [g.id, g]));
  const currentMonth = today.slice(0, 7);
  // Har o'quvchining eng oxirgi izohi (DISTINCT ON student_id, yangisi birinchi)
  const noteRows = await db
    .selectDistinctOn([studentNotes.studentId], {
      studentId: studentNotes.studentId,
      kind: studentNotes.kind,
      text: studentNotes.text,
      authorName: studentNotes.authorName,
      createdAt: studentNotes.createdAt,
    })
    .from(studentNotes)
    .where(
      and(
        inArray(
          studentNotes.studentId,
          debtors.map((s) => s.id),
        ),
        inArray(studentNotes.kind, [...DEBTOR_NOTE_KINDS]),
      ),
    )
    .orderBy(studentNotes.studentId, desc(studentNotes.createdAt));
  const noteByStudent = new Map(noteRows.map((n) => [n.studentId, n]));

  return debtors.map((s) => {
    const { summary } = accounts.get(s.id)!;
    const debtGroups: DebtGroup[] = summary.groups
      .map((g) => {
        const info = groupById.get(g.groupId);
        const unpaid = g.months.filter((m) => m.due > 0);
        return {
          id: g.groupId,
          name: info?.name ?? "—",
          teacherId: info?.teacherId ?? null,
          teacherName: info?.teacherName ?? null,
          due: unpaid.reduce((x, m) => x + m.due, 0),
          months: unpaid.map((m) => m.month),
        };
      })
      .filter((g) => g.due > 0);
    const partial = summary.groups.some((g) =>
      g.months.some((m) => m.month === currentMonth && m.status === "partial"),
    );
    return {
      studentId: s.id,
      name: s.name,
      phone: localPhone(s.phone) ?? "",
      parentName: s.parentName,
      parentPhone: localPhone(s.parentPhone),
      archived: s.archivedAt !== null,
      debt: summary.debt,
      otherDebt: summary.otherDebt,
      groups: debtGroups,
      oldestUnpaid: summary.oldestUnpaid,
      overdueDays: overdueDays(summary.oldestUnpaid, fs.dueDay, today),
      partial,
      note: (() => {
        const n = noteByStudent.get(s.id);
        return n
          ? {
              kind: n.kind as DebtorNote["kind"],
              text: n.text,
              authorName: n.authorName,
              at: n.createdAt.toISOString(),
            }
          : null;
      })(),
    };
  });
}
