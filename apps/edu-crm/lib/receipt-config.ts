import { z } from "zod";

/*
 * Chek sozlamalari (E6b, ADR 0036): `settings` jadvalida kalit `receipt`. Manzil va telefon bu yerda takrorlanmaydi —
 * ular "Markaz sozlamalari"dan olinadi (bitta joy).
 */

export const RECEIPT_KEY = "receipt";

export const PAPER_SIZES = ["80mm", "58mm", "a4"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

export const receiptConfigSchema = z.object({
  /** Chek tepasidagi nom; bo'sh bo'lsa — markaz nomi */
  header: z.string().trim().max(80).default(""),
  /** Chek ostidagi matn; bo'sh bo'lsa — standart minnatdorchilik */
  footer: z.string().trim().max(200).default(""),
  paper: z.enum(PAPER_SIZES).default("80mm"),
  /** QR kod markaz havolasiga olib boradi (havola kiritilmagan bo'lsa chiqmaydi) */
  showQr: z.boolean().default(false),
  /** Chek ochilganda chop etish oynasi o'zi ochiladi */
  autoPrint: z.boolean().default(false),
});
export type ReceiptConfig = z.infer<typeof receiptConfigSchema>;

export const receiptConfigInput = receiptConfigSchema.strict();
export const DEFAULT_RECEIPT: ReceiptConfig = receiptConfigSchema.parse({});

export function parseReceiptConfig(value: unknown): ReceiptConfig {
  const parsed = receiptConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_RECEIPT;
}

/** Ekrandagi chek kengligi (CSS): termo qog'ozda qog'oz kengligi, A4 da — sahifaning yarmiga yaqin */
export const RECEIPT_WIDTH: Record<PaperSize, string> = { "58mm": "58mm", "80mm": "80mm", a4: "150mm" };

/** `@page` qoidasi: termo qog'oz — qog'oz kengligi, balandligi chek bo'yicha; A4 — oddiy sahifa */
export function pageCss(paper: PaperSize): string {
  return paper === "a4" ? "@page{size:A4;margin:15mm}" : `@page{size:${paper} auto;margin:0}`;
}
