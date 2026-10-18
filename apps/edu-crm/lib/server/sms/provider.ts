import "server-only";
import type { TenantDb } from "@ventura/db";
import { smsProvider } from "@ventura/db/schema/tenant";
import { type Eskiz, EskizError, createEskiz } from "@ventura/integrations/eskiz";
import type { SmsProviderView } from "@/lib/sms";
import { openSecret, sealSecret } from "./secret";

/*
 * Markazning Eskiz ulanishi (docs/EDU-CRM-SMS.md, S1). Har mijozda bitta `sms_provider` qatori. Klient saqlangan
 * tokenni ishlatadi; Eskiz yangi token bersa (login yoki refresh) — shifrlab qayta yoziladi. Sirlar sahifaga chiqmaydi.
 */

/** Eskiz tokeni 30 kun yashaydi; bir kun oldin yangisini olamiz */
const TOKEN_DAYS = 29;

type Row = typeof smsProvider.$inferSelect;

export async function getProviderRow(db: TenantDb): Promise<Row | null> {
  const [row] = await db.select().from(smsProvider).limit(1);
  return row ?? null;
}

export function providerView(row: Row | null, authSecret: string): SmsProviderView {
  const hasSecret = !!row?.secretEnc;
  const opened = hasSecret && openSecret(row.secretEnc, authSecret) !== null;
  return {
    connected: opened,
    broken: hasSecret && !opened,
    email: row?.email ?? null,
    sender: row?.sender ?? null,
    quietFrom: row?.quietFrom ?? 21,
    quietTo: row?.quietTo ?? 8,
    checkedAt: row?.checkedAt?.toISOString() ?? null,
  };
}

function tokenSaver(db: TenantDb, authSecret: string) {
  return async (token: string) => {
    await db.update(smsProvider).set({
      tokenEnc: sealSecret(token, authSecret),
      tokenExpiresAt: new Date(Date.now() + TOKEN_DAYS * 86_400_000),
    });
  };
}

/** Saqlangan ulanishdan klient; ulanmagan yoki kalit ochilmasa — null */
export function eskizFor(db: TenantDb, row: Row | null, authSecret: string): Eskiz | null {
  const secret = openSecret(row?.secretEnc ?? null, authSecret);
  if (!row?.email || !secret) return null;
  const fresh = row.tokenExpiresAt && row.tokenExpiresAt.getTime() > Date.now();
  return createEskiz({
    email: row.email,
    secret,
    token: fresh ? openSecret(row.tokenEnc, authSecret) : null,
    onToken: tokenSaver(db, authSecret),
  });
}

/**
 * Yangi email va kalit bilan kirib ko'radi; o'tsa — saqlaydi (token ham). Eskiz xatosi matni qaytadi (sir emas).
 * Oldingi email jurnal uchun qaytariladi.
 */
export async function connectEskiz(
  db: TenantDb,
  input: { email: string; secret: string },
  staffId: string,
  authSecret: string,
): Promise<{ ok: true; before: string | null } | { ok: false; error: string }> {
  let token: string;
  try {
    token = await createEskiz({ email: input.email, secret: input.secret }).login();
  } catch (e) {
    return { ok: false, error: e instanceof EskizError ? e.message : String(e) };
  }
  const before = (await getProviderRow(db))?.email ?? null;
  const values = {
    email: input.email,
    secretEnc: sealSecret(input.secret, authSecret),
    tokenEnc: sealSecret(token, authSecret),
    tokenExpiresAt: new Date(Date.now() + TOKEN_DAYS * 86_400_000),
    checkedAt: new Date(),
    updatedBy: staffId,
    updatedAt: new Date(),
  };
  await db.insert(smsProvider).values(values).onConflictDoUpdate({ target: smsProvider.tenantId, set: values });
  return { ok: true, before };
}

/** Kalit va tokenni o'chiradi; sozlamalar (yuboruvchi, tinch soatlar) qoladi */
export async function disconnectEskiz(db: TenantDb, staffId: string) {
  await db.update(smsProvider).set({
    secretEnc: null,
    tokenEnc: null,
    tokenExpiresAt: null,
    checkedAt: null,
    enabled: false,
    updatedBy: staffId,
    updatedAt: new Date(),
  });
}

export async function saveSmsPrefs(
  db: TenantDb,
  prefs: { sender: string; quietFrom: number; quietTo: number },
  staffId: string,
) {
  const values = {
    sender: prefs.sender || null,
    quietFrom: prefs.quietFrom,
    quietTo: prefs.quietTo,
    updatedBy: staffId,
    updatedAt: new Date(),
  };
  await db.insert(smsProvider).values(values).onConflictDoUpdate({ target: smsProvider.tenantId, set: values });
}

export interface SmsOverview {
  balance: number | null;
  nicks: string[];
  accountStatus: string | null;
  error: string | null;
}

/** Sahifa uchun Eskiz'dan jonli ma'lumot; Eskiz javob bermasa sahifa baribir ochiladi (xato matni bilan) */
export async function smsOverview(db: TenantDb, row: Row | null, authSecret: string): Promise<SmsOverview | null> {
  const eskiz = eskizFor(db, row, authSecret);
  if (!eskiz) return null;
  try {
    // Ketma-ket: token eskirgan bo'lsa birinchi so'rov yangilaydi, qolganlari yangi token bilan ketadi
    const balance = await eskiz.balance();
    const [nicks, user] = await Promise.all([eskiz.nicks().catch(() => []), eskiz.user().catch(() => null)]);
    await db.update(smsProvider).set({ checkedAt: new Date() });
    return { balance, nicks, accountStatus: user?.status ?? null, error: null };
  } catch (e) {
    return { balance: null, nicks: [], accountStatus: null, error: e instanceof Error ? e.message : String(e) };
  }
}
