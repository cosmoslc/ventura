/*
 * Global qidiruv (E6h, ADR 0039): so'rovni tayyorlash va natija turlari. Toza mantiq — bazasiz, testlanadi.
 */

export const SEARCH_KINDS = ["student", "lead", "group", "teacher", "staff"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
}

/** Bir turdan ko'pi bilan shuncha natija */
export const SEARCH_PER_KIND = 5;
export const SEARCH_MIN = 2;
/** Juda uzun so'rov bazaga yuborilmaydi */
export const SEARCH_MAX = 60;

export interface SearchQuery {
  /** `ilike` namunasi (ism uchun), maxsus belgilar qochirilgan */
  name: string;
  /** Telefon qismi (faqat raqamlar); 3 tadan kam bo'lsa — null (telefon bo'yicha qidirilmaydi) */
  digits: string | null;
}

/** "%" va "_" foydalanuvchi yozganda oddiy belgi bo'lishi uchun */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Bo'sh yoki juda qisqa so'rov — null (qidirilmaydi). */
export function parseQuery(raw: string): SearchQuery | null {
  const text = raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX);
  if (text.length < SEARCH_MIN) return null;
  const digits = text.replace(/\D/g, "");
  // Telefon: "+998 90 123" → "99890123"; mahalliy "90123" ham mos keladi (saqlangani +998 bilan)
  const phone = digits.length >= 3 && digits.length >= text.replace(/\s/g, "").length - 1 ? digits : null;
  return { name: `%${escapeLike(text)}%`, digits: phone };
}
