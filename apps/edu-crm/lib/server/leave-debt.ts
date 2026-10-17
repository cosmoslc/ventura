import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { groupMemberships, payments } from "@ventura/db/schema/tenant";
import { groupDebt } from "@/lib/ledger";
import { uz } from "@/lib/uz";
import { loadAccount, loadAccounts } from "./finance";
import { type Tx, closePauses, openPauses } from "./memberships";

/*
 * Qarzi bor o'quvchini guruhdan chiqarish (ADR 0050). Ikki yo'l:
 *  - qarzdan kechib: shu guruh qarzi `writeoff` yozuvi bilan yopiladi (pul emas, kassaga tushmaydi, tarixda qoladi),
 *    a'zolik darhol yopiladi;
 *  - qarz bilan: a'zolik chiqish sanasidan muzlatiladi (yangi hisob yo'q) va `leave_pending_at` belgilanadi; shu guruh
 *    qarzi yopilishi bilan (to'lov, chegirma, tuzatish, kechish) o'sha sana bilan chiqadi — `settlePendingLeaves`.
 * Hamma funksiyalar o'quvchi qulfi (`lockStudent`) ostidagi tranzaksiyada chaqiriladi.
 */

export type LeaveMode = "auto" | "forgive" | "pending";

/** Shu o'quvchining pul amallari ketma-ket bajariladi (tranzaksiya oxirigacha) */
export async function lockStudent(tx: Tx, studentId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`student:${studentId}`} || current_setting('app.tenant_id'), 0))`,
  );
}

/** Shu sana bilan chiqarilsa, shu guruh bo'yicha qolgan qarz */
export async function projectedGroupDebt(
  db: Tx,
  m: { id: string; studentId: string; groupId: string },
  leftAt: string,
  today: string,
): Promise<number> {
  const account = (await loadAccounts(db, [m.studentId], today, undefined, { membershipId: m.id, leftAt })).get(
    m.studentId,
  )!;
  return groupDebt(account.summary, m.groupId);
}

/** Shu guruh qarzini kechish yozuvi (pul emas). `amount` — musbat. */
export async function writeOffGroupDebt(
  tx: Tx,
  v: { studentId: string; groupId: string; amount: number; date: string; note: string; staffId: string },
): Promise<string> {
  const [row] = await tx
    .insert(payments)
    .values({
      studentId: v.studentId,
      groupId: v.groupId,
      kind: "writeoff",
      amount: v.amount,
      date: v.date,
      note: v.note.slice(0, 500),
      createdBy: v.staffId,
    })
    .returning({ id: payments.id });
  return row!.id;
}

/** Qarz bilan chiqarish: chiqish sanasidan muzlatish va kutish belgisi (sabab va izoh saqlanadi) */
export async function startPendingLeave(
  tx: Tx,
  m: { id: string; status: string; pausedAt: string | null },
  v: { date: string; reason: string | null; note: string | null },
) {
  // Allaqachon muzlatilgan bo'lsa — asl muzlatish sanasi saqlanadi (o'sha kundan hisob yo'q)
  const pausedAt = m.status === "paused" && m.pausedAt ? m.pausedAt : v.date;
  await tx
    .update(groupMemberships)
    .set({ status: "paused", pausedAt, leavePendingAt: v.date, leftReason: v.reason, leftNote: v.note })
    .where(eq(groupMemberships.id, m.id));
  if (m.status !== "paused") await openPauses(tx, [m.id], pausedAt);
}

/** Kutish belgisi bo'lgan a'zolikni yopadi (qarzi yopilgan yoki kechilgan) */
export async function finishPendingLeave(tx: Tx, m: { id: string; pausedAt: string | null; leavePendingAt: string }) {
  await closePauses(tx, [{ id: m.id, pausedAt: m.pausedAt }], m.leavePendingAt);
  await tx
    .update(groupMemberships)
    .set({ status: "left", leftAt: m.leavePendingAt, leavePendingAt: null })
    .where(eq(groupMemberships.id, m.id));
}

/**
 * O'quvchining "qarz bilan chiqarish" kutayotgan a'zoliklaridan qarzi yopilganlarini chiqaradi. Pul yozuvi
 * qo'shilgan har tranzaksiya oxirida chaqiriladi. Chiqarilganlar (audit uchun) qaytariladi.
 */
export async function settlePendingLeaves(
  tx: Tx,
  studentId: string,
  today: string,
): Promise<{ membershipId: string; groupId: string; leftAt: string }[]> {
  const pending = await tx
    .select()
    .from(groupMemberships)
    .where(
      and(
        eq(groupMemberships.studentId, studentId),
        isNotNull(groupMemberships.leavePendingAt),
        isNull(groupMemberships.leftAt),
      ),
    );
  if (!pending.length) return [];
  const account = await loadAccount(tx, studentId, today);
  const done: { membershipId: string; groupId: string; leftAt: string }[] = [];
  for (const m of pending) {
    if (groupDebt(account.summary, m.groupId) > 0) continue;
    await finishPendingLeave(tx, { id: m.id, pausedAt: m.pausedAt, leavePendingAt: m.leavePendingAt! });
    done.push({ membershipId: m.id, groupId: m.groupId, leftAt: m.leavePendingAt! });
  }
  return done;
}

export type LeaveOutcome =
  | { kind: "left" }
  | { kind: "forgiven"; debt: number; writeoffId: string }
  | { kind: "pending"; debt: number }
  | { kind: "debt"; debt: number };

/**
 * Bitta a'zolikni chiqaradi (o'quvchi qulfi ostida). Qarz shu sana bilan chiqarilgandagi holatdan hisoblanadi:
 * qarz yo'q — chiqadi; `forgive` — qarz kechiladi va chiqadi; `pending` — to'languncha muzlatiladi; `auto` — chiqmaydi.
 */
export async function applyLeave(
  tx: Tx,
  m: typeof groupMemberships.$inferSelect,
  v: { date: string; reason: string; note: string; mode: LeaveMode },
  today: string,
  staffId: string,
): Promise<LeaveOutcome> {
  await lockStudent(tx, m.studentId);
  const debt = m.activatedAt ? await projectedGroupDebt(tx, m, v.date, today) : 0;
  if (debt > 0 && v.mode === "auto") return { kind: "debt", debt };
  if (debt > 0 && v.mode === "pending") {
    await startPendingLeave(tx, m, { date: v.date, reason: v.reason || null, note: v.note || null });
    return { kind: "pending", debt };
  }
  const writeoffId =
    debt > 0
      ? await writeOffGroupDebt(tx, {
          studentId: m.studentId,
          groupId: m.groupId,
          amount: debt,
          date: v.date,
          note: v.reason ? `${uz.groups.forgiveNote}: ${v.reason}` : uz.groups.forgiveNote,
          staffId,
        })
      : null;
  if (m.status === "paused") await closePauses(tx, [{ id: m.id, pausedAt: m.pausedAt }], v.date);
  await tx
    .update(groupMemberships)
    .set({
      status: "left",
      leftAt: v.date,
      leavePendingAt: null,
      leftReason: v.reason || null,
      leftNote: v.note || null,
    })
    .where(eq(groupMemberships.id, m.id));
  return writeoffId ? { kind: "forgiven", debt, writeoffId } : { kind: "left" };
}
