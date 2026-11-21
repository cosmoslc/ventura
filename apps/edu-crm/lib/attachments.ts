import { z } from "zod";

/*
 * Uy vazifasi fayllari (ADR 0063): faqat /api/uploads orqali yuklangan fayl biriktiriladi.
 * Begona havola (javascript:, boshqa sayt, boshqa markaz papkasi) qabul qilinmaydi.
 */

const UPLOAD_URL_RE = /^\/api\/uploads\/[a-z0-9-]+\/[A-Za-z0-9_.Ѐ-ӿ-]+$/;

export const attachmentSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(255),
  url: z.string().max(512).regex(UPLOAD_URL_RE),
  size: z
    .number()
    .int()
    .nonnegative()
    .max(25 * 1024 * 1024),
  mimeType: z.string().max(128).optional(),
});

export const attachmentListSchema = z.array(attachmentSchema).max(10).default([]);

/** Barcha fayllar shu markaz papkasidanmi */
export function attachmentsBelongTo(slug: string, list: readonly { url: string }[]): boolean {
  const prefix = `/api/uploads/${slug}/`;
  return list.every((a) => a.url.startsWith(prefix));
}
