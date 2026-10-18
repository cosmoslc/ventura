import "server-only";
import { eq } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/panel";
import { type Eskiz, EskizError, createEskiz } from "@ventura/integrations/eskiz";
import { putSecret, readSecret } from "@ventura/security";

/*
 * Ventura'ning Eskiz hisobi (S4, ADR 0056): barcha markazlar paket SMS'lari shu hisobdan ketadi. Maxfiy kalit va
 * token panel sirlarida (AES-GCM, asosiy kalit fayli), ochiq qismi (email, yuboruvchi) — `settings` da. Token Eskiz
 * yangilasa qayta saqlanadi.
 */

const OWNER = { type: "sms", id: "00000000-0000-0000-0000-000000000000" };
const KEY = "sms_eskiz";

export interface VenturaEskizSettings {
  email: string | null;
  /** Nikneym; null — standart 4546 */
  sender: string | null;
  checkedAt: string | null;
}

export async function getEskizSettings(db: PanelDb): Promise<VenturaEskizSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, KEY));
  const v = (row?.value ?? {}) as Partial<VenturaEskizSettings>;
  return { email: v.email ?? null, sender: v.sender ?? null, checkedAt: v.checkedAt ?? null };
}

async function putEskizSettings(db: PanelDb, value: VenturaEskizSettings, userId: string | null) {
  await db
    .insert(settings)
    .values({ key: KEY, value, updatedBy: userId })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: userId, updatedAt: new Date() } });
}

/** Ulanmagan bo'lsa — null */
export async function venturaEskiz(db: PanelDb): Promise<{ eskiz: Eskiz; sender: string | null } | null> {
  const s = await getEskizSettings(db);
  const secret = s.email ? await readSecret(db, OWNER, "eskiz_secret") : null;
  if (!s.email || !secret) return null;
  const token = await readSecret(db, OWNER, "eskiz_token");
  return {
    sender: s.sender,
    eskiz: createEskiz({
      email: s.email,
      secret,
      token,
      onToken: (t) => putSecret(db, OWNER, "eskiz_token", t),
    }),
  };
}

/** Yangi email va kalit bilan kirib ko'radi; o'tsa saqlaydi. Eskiz xabari qaytadi (sir emas). */
export async function connectVenturaEskiz(
  db: PanelDb,
  input: { email: string; secret: string; sender: string | null },
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let token: string;
  try {
    token = await createEskiz({ email: input.email, secret: input.secret }).login();
  } catch (e) {
    return { ok: false, error: e instanceof EskizError ? e.message : String(e) };
  }
  await putSecret(db, OWNER, "eskiz_secret", input.secret);
  await putSecret(db, OWNER, "eskiz_token", token);
  await putEskizSettings(db, { email: input.email, sender: input.sender, checkedAt: new Date().toISOString() }, userId);
  return { ok: true };
}

export async function setVenturaSender(db: PanelDb, sender: string | null, userId: string) {
  const s = await getEskizSettings(db);
  await putEskizSettings(db, { ...s, sender }, userId);
}
