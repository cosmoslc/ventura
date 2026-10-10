import { count, desc } from "drizzle-orm";
import { auditEvents } from "@ventura/db/schema/panel";
import { audit } from "@ventura/security";
import { PageHeader } from "@/components/page-header";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AuditView } from "./audit-view";

export const metadata = { title: `${uz.audit.title} · ${uz.app.name}` };

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ sahifa?: string }> }) {
  await requireViewer();
  const { db } = deps();
  const page = Math.max(1, Number((await searchParams).sahifa) || 1);

  const [rows, [total], verdict] = await Promise.all([
    db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.seq))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ n: count() }).from(auditEvents),
    audit.verify(db),
  ]);

  return (
    <>
      <PageHeader title={uz.audit.title} description={uz.audit.description} />
      <AuditView
        rows={rows.map((r) => ({ ...r, at: r.at.toISOString() }))}
        page={page}
        total={total?.n ?? 0}
        pageSize={PAGE}
        verdict={
          verdict.ok
            ? { ok: true, count: verdict.count }
            : { ok: false, seq: verdict.brokenAtSeq, reason: verdict.reason }
        }
      />
    </>
  );
}
