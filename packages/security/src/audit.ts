import { asc, desc, sql } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { auditEvents } from "@ventura/db/schema/panel";
import { type ChainLink, type ChainPayload, type ChainVerdict, hashLink, verifyChain } from "./chain";

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

/** Butun zanjirni tekshiradi (1-bosqichda yozuvlar kam; keyin bo'laklab tekshirishga o'tiladi). */
export async function verify(db: PanelDb): Promise<ChainVerdict> {
  const rows = await db.select().from(auditEvents).orderBy(asc(auditEvents.seq));
  const links: ChainLink[] = rows.map((r) => ({
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
  }));
  return verifyChain(links);
}

export const audit = { record, verify };
