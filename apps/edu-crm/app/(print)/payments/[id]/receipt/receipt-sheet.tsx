import { type ReceiptConfig, RECEIPT_WIDTH } from "@/lib/receipt-config";

/*
 * Chek varag'i (E6b): haqiqiy chek sahifasi ham, sozlamalardagi jonli ko'rinish ham shuni chizadi — ikkalasi bir
 * xil chiqadi. Qog'oz hajmi varaq kengligini belgilaydi; 58 mm da matn bir pog'ona kichik.
 */

export interface ReceiptSheetProps {
  config: ReceiptConfig;
  /** Sarlavha: sozlamadagi matn yoki markaz nomi */
  title: string;
  /** Filial va manzil qatori */
  place: string;
  /** "Tel: +998 ..." qatori */
  tel: string | null;
  receiptNo: string;
  voidedLabel: string | null;
  rows: [string, string][];
  totalLabel: string;
  total: string;
  footer: string;
  qr: { size: number; d: string } | null;
}

export function ReceiptSheet(p: ReceiptSheetProps) {
  const narrow = p.config.paper === "58mm";
  return (
    <div
      className="mx-auto space-y-4 bg-background text-foreground"
      style={{ width: RECEIPT_WIDTH[p.config.paper], padding: p.config.paper === "a4" ? undefined : "3mm" }}
    >
      <header className="space-y-1 border-b border-dashed border-border pb-4 text-center">
        <div className={narrow ? "type-heading text-base" : "type-heading text-lg"}>{p.title}</div>
        {p.place ? <div className="text-caption text-muted-foreground">{p.place}</div> : null}
        {p.tel ? <div className="text-caption text-muted-foreground">{p.tel}</div> : null}
        <div className="pt-2 font-mono text-body font-semibold">{p.receiptNo}</div>
        {p.voidedLabel ? <div className="font-semibold text-(--danger-fg)">{p.voidedLabel}</div> : null}
      </header>
      <dl className={narrow ? "space-y-1 text-caption" : "space-y-1.5 text-body"}>
        {p.rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border pt-4">
        <span className={narrow ? "text-caption font-semibold" : "font-semibold"}>{p.totalLabel}</span>
        <span className={narrow ? "type-heading text-base" : "type-heading text-xl"}>{p.total}</span>
      </div>
      {p.qr ? (
        <div className="flex justify-center">
          {/* Oq fon va qora kataklar — qaysi temada ham skanerlanadi */}
          <svg
            viewBox={`-2 -2 ${p.qr.size + 4} ${p.qr.size + 4}`}
            style={{ width: "28mm" }}
            shapeRendering="crispEdges"
            role="img"
            aria-label="QR"
          >
            <rect x={-2} y={-2} width={p.qr.size + 4} height={p.qr.size + 4} fill="#fff" />
            <path d={p.qr.d} fill="#000" />
          </svg>
        </div>
      ) : null}
      <p className="text-center text-caption text-muted-foreground">{p.footer}</p>
    </div>
  );
}
