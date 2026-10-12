import { notFound } from "next/navigation";
import { z } from "zod";
import { displayPhone, formatDate, formatMonth, money } from "@/lib/format";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { receiptData } from "@/app/(crm)/payments/data";
import { PrintButton } from "./print-button";

export const metadata = { title: uz.payments.receiptTitle };

const t = uz.payments;

/** To'lov cheki (chop etish uchun, menyusiz). Eski tizimda markaz nomi va telefoni kodda yozilgan edi. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requirePage("payments", "/payments/receipt");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const r = await receiptData(db, id.data);
  const branch = await getBranchContext();
  if (!r || !branch.options.some((b) => b.id === r.branchId)) notFound();
  if (r.kind !== "payment" || r.receiptNo === null) notFound();

  const rows: [string, string][] = [
    [t.receiptDate, formatDate(r.date)],
    [t.receiptStudent, r.studentName],
    [t.receiptPhone, displayPhone(r.studentPhone) ?? "—"],
    [t.receiptGroup, r.groupName ?? t.noGroup],
    ...(r.courseName ? ([[t.receiptCourse, r.courseName]] as [string, string][]) : []),
    ...(r.month ? ([[t.receiptMonth, formatMonth(r.month)]] as [string, string][]) : []),
    [t.receiptMethod, r.methodName ?? "—"],
    [t.receiptCashier, r.createdByName ?? "—"],
  ];

  return (
    <main className="mx-auto max-w-sm space-y-4 bg-background p-6 text-foreground print:p-0">
      <header className="space-y-1 border-b border-dashed border-border pb-4 text-center">
        <div className="type-heading text-lg">{tenant.name}</div>
        <div className="text-caption text-muted-foreground">
          {r.branchName}
          {r.branchAddress ? ` · ${r.branchAddress}` : ""}
        </div>
        <div className="pt-2 font-mono text-body font-semibold">{t.receiptNo(r.receiptNo)}</div>
        {r.voided ? <div className="font-semibold text-(--danger-fg)">{t.receiptVoided}</div> : null}
      </header>
      <dl className="space-y-1.5 text-body">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between border-t border-dashed border-border pt-4">
        <span className="font-semibold">{t.receiptTotal}</span>
        <span className="type-heading text-xl">
          {money(r.amount)} {uz.common.som}
        </span>
      </div>
      <p className="text-center text-caption text-muted-foreground">{t.receiptThanks}</p>
      <PrintButton />
    </main>
  );
}
