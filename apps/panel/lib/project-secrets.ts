/*
 * Loyiha sirlari (ADR 0059): panel `secrets` jadvalidagi loyiha egaligidagi qiymatlar. Ro'yxat va qoidalar shu yerda —
 * forma ham, server amali ham shundan foydalanadi. Qiymatlar faqat server amalida ochiladi (super admin, audit bilan).
 * O'zgarish serverga keyingi deploy'da yoziladi (tenant-secrets.json, baza roli paroli).
 */

export interface ProjectSecretKind {
  name: string;
  /** Tasodifiy qiymat yaratish mumkin (kalitlar, parollar) */
  generate: boolean;
  /** Xavfli: o'zgarsa ishlab turgan tizimga ta'siri bor — alohida ogohlantirish */
  danger: boolean;
  pattern: RegExp;
}

export const PROJECT_SECRETS: readonly ProjectSecretKind[] = [
  { name: "telegram_bot_token", generate: false, danger: false, pattern: /^\d+:[\w-]{20,}$/ },
  { name: "owner_password", generate: true, danger: false, pattern: /^\S{8,128}$/ },
  { name: "db_password", generate: true, danger: true, pattern: /^[A-Za-z0-9_-]{24,128}$/ },
  { name: "auth_secret", generate: true, danger: true, pattern: /^\S{32,256}$/ },
  { name: "sms_relay_key", generate: true, danger: true, pattern: /^\S{32,256}$/ },
];

export const secretKind = (name: string) => PROJECT_SECRETS.find((s) => s.name === name) ?? null;

/** Tasodifiy qiymat (32 bayt, base64url) — brauzerda */
export function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
