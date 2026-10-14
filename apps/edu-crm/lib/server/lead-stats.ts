import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { leadStages, leads, payments } from "@ventura/db/schema/tenant";
import type { Period } from "@/lib/dashboard";
import { type LeadStatRow, type LeadStats, leadStats } from "@/lib/lead-stats";

/*
 * Bosh paneldagi lid kartalari uchun ma'lumot (E4d, ADR 0027): faqat "Konversiya va lidlar" ruxsati bo'lsa o'qiladi.
 * Filial bo'yicha, arxivdagi lidlarsiz.
 */

export interface RecentLead {
  id: string;
  name: string;
  source: string | null;
  stage: string;
  color: string;
  /** Qo'shilgan kun (Toshkent) */
  date: string;
}

export interface LeadDashboard {
  stats: LeadStats;
  /** Bosqich id → nomi (eng ko'p yo'qotilgan bosqich uchun) */
  stageNames: Record<string, string>;
  recent: RecentLead[];
}

const tashkentDay = sql<string>`to_char(${leads.createdAt} at time zone 'Asia/Tashkent', 'YYYY-MM-DD')`;

export async function loadLeadDashboard(
  db: TenantDb,
  filter: readonly string[] | null,
  period: Period,
  months: readonly string[],
): Promise<LeadDashboard> {
  const scope = and(isNull(leads.archivedAt), filter ? inArray(leads.branchId, [...filter]) : undefined);
  const paid = sql<boolean>`exists (
    select 1 from ${payments}
    where ${payments.studentId} = ${leads.studentId}
      and ${payments.kind} = 'payment' and ${payments.voidedAt} is null and ${payments.amount} > 0
  )`;
  const [rows, stages, recent] = await Promise.all([
    db
      .select({
        date: tashkentDay,
        source: leads.source,
        kind: leadStages.kind,
        lostFromStageId: leads.lostFromStageId,
        paid,
      })
      .from(leads)
      .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
      .where(scope),
    db.select({ id: leadStages.id, name: leadStages.name }).from(leadStages),
    db
      .select({
        id: leads.id,
        name: leads.name,
        source: leads.source,
        stage: leadStages.name,
        color: leadStages.color,
        date: tashkentDay,
      })
      .from(leads)
      .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
      .where(scope)
      .orderBy(desc(leads.createdAt))
      .limit(36),
  ]);
  return {
    stats: leadStats(rows as LeadStatRow[], period, months),
    stageNames: Object.fromEntries(stages.map((s) => [s.id, s.name])),
    recent,
  };
}
