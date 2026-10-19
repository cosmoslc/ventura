import { asc, count, desc, eq, gt, lte, sql } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { auditEvents, settings } from "@ventura/db/schema/panel";
import { type ChainLink, type ChainPayload, type ChainVerdict, hashLink, verifySegment } from "./chain";

/*
 * audit.record(): har o'zgartiruvchi amal shu orqali yoziladi (CLAUDE.md).
 * Zanjir tartibi buzilmasligi uchun yozish tranzaksiyada, advisory lock bilan ketma-ket bajariladi.
 */

export interface AuditActor {
  type: "user" | "system" | "cli";
  id?: string | null;
  name?: string | null;
}

export interface AuditInput {
  actor: AuditActor;
  action: string;
  target?: { type: string; id?: string | null };
  ip?: string | null;
  userAgent?: string | null;
  /** Masalan { before, after } yoki qo'shimcha tafsilotlar. Sirlar yozilmaydi. */
  metadata?: Record<string, unknown>;
}

const LOCK_KEY = 7_420_001; // audit zanjiri uchun advisory lock identifikatori

export async function record(db: PanelDb, input: AuditInput) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
    const [last] = await tx
      .select({ hash: auditEvents.hash })
      .from(auditEvents)
      .orderBy(desc(auditEvents.seq))
      .limit(1);
    const prevHash = last?.hash ?? null;
    const payload: ChainPayload = {
      at: new Date().toISOString(),
      actorType: input.actor.type,
      actorId: input.actor.id ?? null,
      actorName: input.actor.name ?? null,
      action: input.action,
      targetType: input.target?.type ?? null,
      targetId: input.target?.id ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    };
    const hash = hashLink(prevHash, payload);
    const [row] = await tx
      .insert(auditEvents)
      .values({ ...payload, at: new Date(payload.at), prevHash, hash })
      .returning({ id: auditEvents.id, seq: auditEvents.seq });
    return row;
  });
}

/*
 * Tekshirish (ADR 0060). Avval /audit sahifasi har ochilganda butun jadvalni xotiraga yuklab xeshlar edi — vaqt va
 * xotira yozuvlar soniga chiziqli o'sardi. Endi:
 *  - verify()     — nazorat nuqtasidan (oxirgi tekshirilgan seq, xesh va yozuvlar soni) keyingi yozuvlarnigina
 *                   tekshiradi. Nuqtaning o'zi ham tekshiriladi: o'sha yozuv o'zgarmagan va undan oldingi yozuvlar
 *                   soni o'sha-o'sha. Nuqta yo'q yoki mos kelmasa — butun zanjir.
 *  - verifyFull() — butun zanjir, bo'laklab (xotirada bir vaqtda BATCH ta yozuv). Ishchi jarayon kuniga bir marta
 *                   va ishga tushganda bajaradi: nuqtadan oldingi o'rtadagi yozuvni superuser o'zgartirsa, shu topadi.
 * Nuqta panel `settings` jadvalida turadi; u ichki hisob, foydalanuvchi amali emas — audit.record() chaqirilmaydi.
 */

export const AUDIT_CHECKPOINT_KEY = "audit.checkpoint";
const BATCH = 1_000;

interface Checkpoint {
  seq: number;
  hash: string;
  count: number;
}

const isCheckpoint = (v: unknown): v is Checkpoint => {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    Number.isSafeInteger(c.seq) &&
    (c.seq as number) > 0 &&
    typeof c.hash === "string" &&
    Number.isSafeInteger(c.count) &&
    (c.count as number) > 0
  );
};

type EventRow = typeof auditEvents.$inferSelect;
const linkOf = (r: EventRow): ChainLink => ({
  seq: r.seq,
  at: r.at.toISOString(),
  actorType: r.actorType,
  actorId: r.actorId,
  actorName: r.actorName,
  action: r.action,
  targetType: r.targetType,
  targetId: r.targetId,
  ip: r.ip,
  userAgent: r.userAgent,
  metadata: r.metadata,
  prevHash: r.prevHash,
  hash: r.hash,
});

type Walk = { ok: true; last: Checkpoint | null } | { ok: false; brokenAtSeq: number; reason: string };

/** `from` dan keyingi yozuvlar bo'laklab: har bo'lak oldingisining oxirgi xeshidan davom etadi */
async function walk(db: PanelDb, from: Checkpoint | null): Promise<Walk> {
  let last = from;
  for (;;) {
    const rows = await db
      .select()
      .from(auditEvents)
      .where(last ? gt(auditEvents.seq, last.seq) : undefined)
      .orderBy(asc(auditEvents.seq))
      .limit(BATCH);
    if (!rows.length) return { ok: true, last };
    const v = verifySegment(rows.map(linkOf), last?.hash ?? null);
    if (!v.ok) return v;
    const tail = rows[rows.length - 1]!;
    last = { seq: tail.seq, hash: tail.hash, count: (last?.count ?? 0) + rows.length };
    if (rows.length < BATCH) return { ok: true, last };
  }
}

/** Nazorat nuqtasi hali to'g'rimi: o'sha yozuv o'zgarmagan va undan oldingi yozuvlar soni o'zgarmagan */
async function checkpointHolds(db: PanelDb, cp: Checkpoint): Promise<boolean> {
  const [[row], [before]] = await Promise.all([
    db.select().from(auditEvents).where(eq(auditEvents.seq, cp.seq)),
    db.select({ n: count() }).from(auditEvents).where(lte(auditEvents.seq, cp.seq)),
  ]);
  if (!row || row.hash !== cp.hash || before?.n !== cp.count) return false;
  const { seq: _seq, prevHash, hash, ...payload } = linkOf(row);
  return hashLink(prevHash, payload) === hash;
}

async function readCheckpoint(db: PanelDb): Promise<Checkpoint | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, AUDIT_CHECKPOINT_KEY));
  return isCheckpoint(row?.value) ? row.value : null;
}

/**
 * `force` — to'liq tekshiruv natijasi, har doim yoziladi. Aks holda nuqta faqat oldinga suriladi: parallel
 * tekshiruv eskirog'ini yoki to'liq tekshiruv qo'ygan "uzilgan" belgisini ustiga yozmaydi.
 */
async function writeCheckpoint(db: PanelDb, value: Checkpoint | { brokenAtSeq: number; at: string }, force: boolean) {
  await db
    .insert(settings)
    .values({ key: AUDIT_CHECKPOINT_KEY, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
      setWhere: force
        ? undefined
        : sql`(${settings.value} ->> 'seq') is not null and (${settings.value} ->> 'seq')::bigint < ${"seq" in value ? value.seq : 0}`,
    });
}

async function total(db: PanelDb): Promise<number> {
  const [row] = await db.select({ n: count() }).from(auditEvents);
  return row?.n ?? 0;
}

/** Butun zanjir, bo'laklab. Natija nazorat nuqtasiga yoziladi (uzilgan bo'lsa — nuqta bekor qilinadi). */
export async function verifyFull(db: PanelDb): Promise<ChainVerdict> {
  const v = await walk(db, null);
  if (!v.ok) {
    await writeCheckpoint(db, { brokenAtSeq: v.brokenAtSeq, at: new Date().toISOString() }, true);
    return { ok: false, count: await total(db), brokenAtSeq: v.brokenAtSeq, reason: v.reason };
  }
  if (v.last) await writeCheckpoint(db, v.last, true);
  return { ok: true, count: v.last?.count ?? 0 };
}

/** Nazorat nuqtasidan keyingi yozuvlar (/audit sahifasi). Nuqta yo'q yoki buzilgan bo'lsa — butun zanjir. */
export async function verify(db: PanelDb): Promise<ChainVerdict> {
  const cp = await readCheckpoint(db);
  if (!cp || !(await checkpointHolds(db, cp))) return verifyFull(db);
  const v = await walk(db, cp);
  if (!v.ok) return { ok: false, count: await total(db), brokenAtSeq: v.brokenAtSeq, reason: v.reason };
  const last = v.last ?? cp;
  if (last.seq !== cp.seq) await writeCheckpoint(db, last, false);
  return { ok: true, count: last.count };
}

export const audit = { record, verify, verifyFull };
