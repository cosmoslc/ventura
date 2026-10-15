import { notFound } from "next/navigation";
import { z } from "zod";
import { qrTarget } from "@/lib/center-settings";
import { displayPhone, formatDate, formatMonth, money } from "@/lib/format";
import { qrPath } from "@/lib/qr";
import { pageCss } from "@/lib/receipt-config";
import { getBranchContext } from "@/lib/server/branch";
import { getCenterSettings, getReceiptConfig } from "@/lib/server/center";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { receiptData } from "@/app/(crm)/payments/data";
import { PrintButton } from "./print-button";
import { ReceiptSheet } from "./receipt-sheet";

export const metadata = { title: uz.payments.receiptTitle };

const t = uz.payments;

/**
 * To'lov cheki (chop etish uchun, menyusiz). Sarlavha, pastki matn, qog'oz hajmi, QR va avto chop — "To'lov
 * sozlamalari"dan (E6b); telefon va manzil — "Markaz sozlamalari"dan (E6a).
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requirePage("payments", "/payments/receipt");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const [r, config, center] = await Promise.all([
    receiptData(db, id.data),
    getReceiptConfig(db),
    getCenterSettings(db),
  ]);
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

  const place = [r.branchName, r.branchAddress ?? center.address].filter(Boolean).join(" · ");
  const qr = config.showQr ? qrPath(qrTarget(center)) : null;

  return (
    <main className="mx-auto space-y-4 p-6 print:p-0">
      <style>{pageCss(config.paper)}</style>
      <ReceiptSheet
        config={config}
        title={config.header || tenant.name}
        place={place}
        tel={center.phone ? uz.receiptSettings.tel(displayPhone(center.phone) ?? center.phone) : null}
        receiptNo={t.receiptNo(r.receiptNo)}
        voidedLabel={r.voided ? t.receiptVoided : null}
        rows={rows}
        totalLabel={t.receiptTotal}
        total={`${money(r.amount)} ${uz.common.som}`}
        footer={config.footer || t.receiptThanks}
        qr={qr}
      />
      <PrintButton autoPrint={config.autoPrint} />
    </main>
  );
}
