import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { smsMessages } from "@ventura/db/schema/tenant";
import { eskizPhone } from "@ventura/integrations/eskiz";
import { type SmsTemplateKind, smsParts } from "@/lib/sms-text";
import type { DeliveryState, SmsSender } from "./sender";

/*
 * SMS navbati (docs/EDU-CRM-SMS.md, 4.3). `enqueue` — biznes amal ichida (tashqi so'rovsiz) qator yozadi;
 * `flush` — fon jarayoni navbatdagilarni oladi (FOR UPDATE SKIP LOCKED: ikki jarayon bir xabarni olmaydi), yuboradi,
 * xatoda 1 / 5 / 15 daqiqadan keyin qayta urinadi, 3-xatodan keyin `failed`. `poll` — callback kelmagan xabarlar
 * holatini Eskiz'dan so'raydi. Jarayon yuborish o'rtasida to'xtasa, 10 daqiqadan keyin xabar navbatga qaytadi.
 */

export interface OutboxItem {
  kind: SmsTemplateKind;
  recipient: "student" | "parent" | "staff" | "other";
  /** Har qanday ko'rinishdagi raqam — 998XXXXXXXXX ga keltiriladi; noto'g'ri bo'lsa qator tashlanadi */
  phone: string;
  text: string;
  templateId?: string | null;
  dispatchId?: string | null;
  studentId?: string | null;
  staffId?: string | null;
  groupId?: string | null;
  branchId?: string | null;
  createdBy?: string | null;
  dedupeKey?: string | null;
  sendAfter?: Date;
}

const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = [1, 5, 15];
const BATCH = 60;
const STALE_MINUTES = 10;

/** Navbatga yozadi; noto'g'ri raqam va takror (`dedupe_key`) tashlanadi. Yozilganlar soni qaytadi. */
export async function enqueue(db: Pick<TenantDb, "insert">, items: readonly OutboxItem[]): Promise<number> {
  const rows = items.flatMap((i) => {
    const phone = eskizPhone(i.phone);
    const text = i.text.trim();
    if (!phone || !text) return [];
    return [
      {
        kind: i.kind,
        recipient: i.recipient,
        phone,
        text: text.slice(0, 1000),
        parts: Math.min(20, smsParts(text).parts),
        templateId: i.templateId ?? null,
        dispatchId: i.dispatchId ?? null,
        studentId: i.studentId ?? null,
        staffId: i.staffId ?? null,
        groupId: i.groupId ?? null,
        branchId: i.branchId ?? null,
        createdBy: i.createdBy ?? null,
        dedupeKey: i.dedupeKey ?? null,
        ...(i.sendAfter ? { sendAfter: i.sendAfter } : {}),
      },
    ];
  });
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const res = await db
      .insert(smsMessages)
      .values(rows.slice(i, i + 500))
      .onConflictDoNothing()
      .returning({ id: smsMessages.id });
    inserted += res.length;
  }
  return inserted;
}

export interface FlushResult {
  sent: number;
  failed: number;
  retried: number;
}

/** Navbatdagi xabarlarni yuboradi (bir chaqiruvda ko'pi bilan BATCH ta) */
/**
 * `at` — testlar uchun soat; berilmasa bazaning `now()` i (JS soati millisoniya, baza — mikrosoniya: hozirgina yozilgan
 * xabar JS vaqti bilan "kelajakda" ko'rinib, keyingi aylanishgacha qolib ketmasin).
 */
export async function flush(db: TenantDb, sender: SmsSender, at?: Date): Promise<FlushResult> {
  const now = at ?? new Date();
  const due = at ?? sql`now()`;
  // To'xtab qolgan "sending" (provayder id siz) — qaytadan navbatga
  await db
    .update(smsMessages)
    .set({ status: "queued", lockedAt: null })
    .where(
      and(
        eq(smsMessages.status, "sending"),
        isNull(smsMessages.providerId),
        lt(smsMessages.lockedAt, new Date(now.getTime() - STALE_MINUTES * 60_000)),
      ),
    );

  const claimed = await db.transaction(async (tx) => {
    const ids = await tx
      .select({ id: smsMessages.id })
      .from(smsMessages)
      .where(and(eq(smsMessages.status, "queued"), lte(smsMessages.sendAfter, due)))
      .orderBy(asc(smsMessages.sendAfter))
      .limit(BATCH)
      .for("update", { skipLocked: true });
    if (!ids.length) return [];
    return tx
      .update(smsMessages)
      .set({ status: "sending", lockedAt: now, attempts: sql`${smsMessages.attempts} + 1` })
      .where(
        inArray(
          smsMessages.id,
          ids.map((r) => r.id),
        ),
      )
      .returning({
        id: smsMessages.id,
        phone: smsMessages.phone,
        text: smsMessages.text,
        attempts: smsMessages.attempts,
      });
  });

  const result: FlushResult = { sent: 0, failed: 0, retried: 0 };
  for (const m of claimed) {
    try {
      const { providerId } = await sender.send({ phone: m.phone, text: m.text });
      await db
        .update(smsMessages)
        .set({ status: "sent", providerId, sentAt: new Date(), error: null })
        .where(eq(smsMessages.id, m.id));
      result.sent++;
    } catch (e) {
      const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      const final = m.attempts >= MAX_ATTEMPTS;
      const wait = RETRY_MINUTES[Math.min(m.attempts, RETRY_MINUTES.length) - 1] ?? 15;
      await db
        .update(smsMessages)
        .set(
          final
            ? { status: "failed", error, lockedAt: null }
            : { status: "queued", error, lockedAt: null, sendAfter: new Date(Date.now() + wait * 60_000) },
        )
        .where(eq(smsMessages.id, m.id));
      if (final) result.failed++;
      else result.retried++;
    }
  }
  return result;
}

/** Yetkazish natijasini yozadi (callback yoki so'rov); yakuniy holatdagi xabarga tegmaydi */
export async function applyDelivery(
  db: TenantDb,
  providerId: string,
  state: DeliveryState,
  info: { parts?: number | null; cost?: number | null; at?: Date } = {},
): Promise<boolean> {
  if (state === "pending" && info.parts == null && info.cost == null) return false;
  const res = await db
    .update(smsMessages)
    .set({
      ...(state === "delivered" ? { status: "delivered" as const, deliveredAt: info.at ?? new Date() } : {}),
      ...(state === "failed" ? { status: "failed" as const, error: "Yetkazilmadi" } : {}),
      ...(info.parts != null ? { parts: Math.min(20, Math.max(1, info.parts)) } : {}),
      ...(info.cost != null ? { cost: Math.round(info.cost) } : {}),
    })
    .where(and(eq(smsMessages.providerId, providerId), inArray(smsMessages.status, ["sending", "sent"])))
    .returning({ id: smsMessages.id });
  return res.length > 0;
}

/**
 * Callback kelmagan xabarlar: yuborilganiga 5 daqiqadan oshgan, 3 kundan oshmagan "sent" xabarlar holati so'raladi.
 * Eskiz holatni 30 kun saqlaydi; 3 kundan keyin ham noma'lum bo'lsa "sent" bo'lib qoladi.
 */
export async function poll(db: TenantDb, sender: SmsSender, now = new Date(), limit = 20): Promise<number> {
  const rows = await db
    .select({ providerId: smsMessages.providerId })
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.status, "sent"),
        isNotNull(smsMessages.providerId),
        lt(smsMessages.sentAt, new Date(now.getTime() - 5 * 60_000)),
        gt(smsMessages.sentAt, new Date(now.getTime() - 3 * 86_400_000)),
      ),
    )
    // Yangilari birinchi: foydalanuvchi hozir yuborganining natijasini kutadi
    .orderBy(desc(smsMessages.sentAt))
    .limit(limit);
  let updated = 0;
  for (const r of rows) {
    try {
      const s = await sender.status(r.providerId!);
      if (await applyDelivery(db, r.providerId!, s.state, { parts: s.parts, cost: s.cost })) updated++;
    } catch {
      // Keyingi aylanishda yana so'raladi
    }
  }
  return updated;
}
