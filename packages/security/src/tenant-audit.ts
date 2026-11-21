import { asc, desc, sql } from "drizzle-orm";
import type { SawmillDb, TenantDb, TenantTx } from "@ventura/db";
import { auditEvents } from "@ventura/db/schema/tenant";
import type { AuditInput } from "./audit";
import { type ChainLink, type ChainPayload, type ChainVerdict, hashLink, verifyChain } from "./chain";

/*
 * Mijoz tizimidagi faoliyat jurnali (EDU-CRM-PLAN 4-bo'lim, 7-tamoyil): panel jurnali bilan bir xil qoidalar —
 * o'chmas va xesh zanjirli. Zanjir har mijozda alohida: umumiy bazada ham RLS faqat shu mijoz yozuvlarini
 * ko'rsatadi, lock esa mijoz bo'yicha olinadi (bir mijoz yozuvi boshqasini kutmaydi).
 */

const LOCK_CLASS = 7_420_002;

export async function recordTenant(db: TenantDb | SawmillDb | TenantTx, input: AuditInput) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${LOCK_CLASS}, hashtext(coalesce(nullif(current_setting('app.tenant_id', true), ''), 'default')))`,
    );
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

export async function verifyTenant(db: TenantDb | SawmillDb): Promise<ChainVerdict> {
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

/** Mijoz tizimida: `tenantAudit.record(db, {...})` — panel'dagi `audit.record()` ning juftligi. */
export const tenantAudit = { record: recordTenant, verify: verifyTenant };
