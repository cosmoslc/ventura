"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { smsPackages } from "@ventura/db/schema/panel";
import { audit } from "@ventura/security";
import { deps } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";
import { requireViewer } from "@/lib/server/session";
import { connectVenturaEskiz, setVenturaSender } from "@/lib/server/sms/eskiz";
import { adjustWallet, decidePurchase } from "@/lib/server/sms/wallet";
import { uz } from "@/lib/uz";

/*
 * Ventura SMS paketi boshqaruvi (ADR 0056): Eskiz hisobi, paketlar, to'lov so'rovlarini tasdiqlash va hisobni qo'lda
 * tuzatish. Hammasi "Sozlamalar" ruxsati bilan va audit jurnaliga (maxfiy kalit yozilmaydi).
 */

export type SmsResult = { ok: true } | { ok: false; error: string };
const t = uz.sms;

async function ctx() {
  const viewer = await requireViewer("settings.manage");
  const meta = await requestMeta();
  const actor = { type: "user" as const, id: viewer.id, name: viewer.name };
  const { db } = deps();
  const record = (action: string, target: { type: string; id: string }, metadata: Record<string, unknown>) =>
    audit.record(db, { actor, action, target, ...meta, metadata });
  return { viewer, db, record };
}

const connectInput = z.object({
  email: z.email(t.emailInvalid).trim().max(200),
  secret: z.string().trim().max(500),
  sender: z.string().trim().max(20),
});

export async function connectSmsEskizAction(input: unknown): Promise<SmsResult> {
  const { viewer, db, record } = await ctx();
  const parsed = connectInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  const sender = parsed.data.sender || null;
  // Kalit bo'sh — faqat yuboruvchi nomi o'zgaradi
  if (!parsed.data.secret) {
    await setVenturaSender(db, sender, viewer.id);
  } else {
    const res = await connectVenturaEskiz(
      db,
      { email: parsed.data.email, secret: parsed.data.secret, sender },
      viewer.id,
    );
    if (!res.ok) return { ok: false, error: t.eskizError(res.error) };
  }
  await record("sms.eskiz", { type: "sms", id: "eskiz" }, { email: parsed.data.email, sender });
  revalidatePath("/sms");
  return { ok: true };
}

const packageInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, t.nameRequired).max(80),
  parts: z.number().int().min(1, t.partsInvalid).max(10_000_000),
  price: z.number().int().min(0).max(2_000_000_000),
  active: z.boolean(),
});

export async function saveSmsPackageAction(input: unknown): Promise<SmsResult> {
  const { db, record } = await ctx();
  const parsed = packageInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  const { id, ...values } = parsed.data;
  let targetId = id;
  if (id) await db.update(smsPackages).set(values).where(eq(smsPackages.id, id));
  else targetId = (await db.insert(smsPackages).values(values).returning({ id: smsPackages.id }))[0]!.id;
  await record(id ? "sms.package.update" : "sms.package.create", { type: "sms_package", id: targetId! }, values);
  revalidatePath("/sms");
  return { ok: true };
}

const decideInput = z.object({ id: z.uuid(), paid: z.boolean() });

export async function decideSmsPurchaseAction(input: unknown): Promise<SmsResult> {
  const { viewer, db, record } = await ctx();
  const parsed = decideInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: uz.common.loadError };
  const res = await decidePurchase(db, parsed.data.id, parsed.data.paid, viewer.id);
  if (!res) return { ok: false, error: t.requestGone };
  await record(
    parsed.data.paid ? "sms.purchase.paid" : "sms.purchase.cancel",
    { type: "project", id: res.projectId },
    { request: parsed.data.id, parts: res.parts },
  );
  revalidatePath("/sms");
  return { ok: true };
}

const adjustInput = z.object({
  projectId: z.uuid(),
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, t.deltaInvalid),
  note: z.string().trim().min(3, t.noteRequired).max(200),
});

export async function adjustSmsWalletAction(input: unknown): Promise<SmsResult> {
  const { viewer, db, record } = await ctx();
  const parsed = adjustInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  const ok = await adjustWallet(db, parsed.data.projectId, parsed.data.delta, parsed.data.note, viewer.id);
  if (!ok) return { ok: false, error: t.notEnough };
  await record(
    "sms.wallet.adjust",
    { type: "project", id: parsed.data.projectId },
    {
      delta: parsed.data.delta,
      note: parsed.data.note,
    },
  );
  revalidatePath("/sms");
  return { ok: true };
}
