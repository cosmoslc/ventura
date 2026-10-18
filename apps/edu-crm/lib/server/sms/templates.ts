import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { smsTemplates } from "@ventura/db/schema/tenant";
import {
  SMS_PRESETS,
  type SmsModeration,
  type SmsTemplateKind,
  moderationFromEskiz,
  sampleParts,
} from "@/lib/sms-text";
import { uz } from "@/lib/uz";
import type { TemplateModerator } from "./context";

/*
 * SMS shablonlari (docs/EDU-CRM-SMS.md, S2). Matn o'zgarsa moderatsiya holati "yuborilmagan"ga qaytadi (Eskiz eski
 * matnni tasdiqlagan). Eskiz yuborishda id bermaydi: sinxronlashda Eskiz ro'yxatidan matni bo'yicha topiladi.
 */

export interface SmsTemplateRow {
  id: string;
  kind: SmsTemplateKind;
  name: string;
  body: string;
  parts: number;
  moderation: SmsModeration;
  submittedAt: string | null;
}

export async function listTemplates(db: TenantDb): Promise<SmsTemplateRow[]> {
  const rows = await db
    .select()
    .from(smsTemplates)
    .where(isNull(smsTemplates.archivedAt))
    .orderBy(asc(smsTemplates.createdAt));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    body: r.body,
    parts: r.parts,
    moderation: r.moderation,
    submittedAt: r.submittedAt?.toISOString() ?? null,
  }));
}

async function findTemplate(db: TenantDb, id: string) {
  const [row] = await db
    .select()
    .from(smsTemplates)
    .where(and(eq(smsTemplates.id, id), isNull(smsTemplates.archivedAt)));
  return row ?? null;
}

/** Yangi yoki tahrir; tahrirda matn o'zgarsa moderatsiya qaytadan. Oldingi holat jurnal uchun qaytadi. */
export async function saveTemplate(
  db: TenantDb,
  input: { id?: string; kind: SmsTemplateKind; name: string; body: string },
  centerName: string,
  staffId: string,
): Promise<{ ok: true; id: string; before: { name: string; body: string } | null } | { ok: false; error: string }> {
  const parts = sampleParts(input.body, centerName).parts;
  if (!input.id) {
    const [row] = await db
      .insert(smsTemplates)
      .values({ kind: input.kind, name: input.name, body: input.body, parts, createdBy: staffId })
      .returning({ id: smsTemplates.id });
    return { ok: true, id: row!.id, before: null };
  }
  const existing = await findTemplate(db, input.id);
  if (!existing) return { ok: false, error: uz.smsTemplates.notFound };
  const changed = existing.body !== input.body;
  await db
    .update(smsTemplates)
    .set({
      kind: input.kind,
      name: input.name,
      body: input.body,
      parts,
      updatedAt: new Date(),
      // Eskiz tasdiqlagan matn o'zgardi — yangi matn qayta tekshiriladi
      ...(changed && existing.submittedBody !== input.body
        ? { moderation: "draft" as const, providerTemplateId: null }
        : {}),
    })
    .where(eq(smsTemplates.id, input.id));
  return { ok: true, id: input.id, before: { name: existing.name, body: existing.body } };
}

export async function archiveTemplate(db: TenantDb, id: string): Promise<string | null> {
  const existing = await findTemplate(db, id);
  if (!existing) return null;
  await db.update(smsTemplates).set({ archivedAt: new Date() }).where(eq(smsTemplates.id, id));
  return existing.name;
}

/**
 * SMS rejimi almashdi (Ventura paketi ↔ o'z Eskiz hisobi): tasdiq boshqa hisobda edi — hammasi qaytadan "yuborilmagan".
 */
export async function resetModeration(db: TenantDb): Promise<void> {
  await db
    .update(smsTemplates)
    .set({ moderation: "draft", providerTemplateId: null, submittedBody: null, submittedAt: null })
    .where(isNull(smsTemplates.archivedAt));
}

/** Hali yo'q turlar uchun tayyor andozalar (har tur bittadan) */
export async function addPresets(db: TenantDb, centerName: string, staffId: string): Promise<number> {
  const have = new Set((await listTemplates(db)).map((t) => t.kind));
  const missing = (Object.keys(SMS_PRESETS) as (keyof typeof SMS_PRESETS)[]).filter((k) => !have.has(k));
  if (!missing.length) return 0;
  await db.insert(smsTemplates).values(
    missing.map((kind) => ({
      kind,
      name: uz.smsTemplates.kinds[kind]!,
      body: SMS_PRESETS[kind],
      parts: sampleParts(SMS_PRESETS[kind], centerName).parts,
      createdBy: staffId,
    })),
  );
  return missing.length;
}

/** Eskiz moderatsiyasiga yuboradi; matn shu holicha saqlanadi (keyin o'zgarsa — qayta) */
export async function submitTemplate(
  db: TenantDb,
  moderator: TemplateModerator,
  id: string,
): Promise<{ name: string } | null> {
  const existing = await findTemplate(db, id);
  if (!existing) return null;
  await moderator.submit(existing.body);
  await db
    .update(smsTemplates)
    .set({ moderation: "moderation", submittedBody: existing.body, submittedAt: new Date(), providerTemplateId: null })
    .where(eq(smsTemplates.id, id));
  return { name: existing.name };
}

/**
 * Eskiz ro'yxatidan holatlarni oladi: yuborilgan matni (`submitted_body`) Eskiz'dagi matnga teng shablonlar
 * yangilanadi. Bir matn bir necha marta yuborilgan bo'lsa — eng oxirgisi (id kattasi). O'zgarganlar soni qaytadi.
 */
export async function syncTemplates(db: TenantDb, moderator: TemplateModerator): Promise<number> {
  const submitted = await db
    .select({ body: smsTemplates.submittedBody })
    .from(smsTemplates)
    .where(isNull(smsTemplates.archivedAt));
  const texts = submitted.flatMap((r) => (r.body ? [r.body] : []));
  if (!texts.length) return 0;
  const remote = await moderator.statuses(texts);
  const byText = new Map<string, { id: number; status: string }>();
  for (const r of remote) {
    const prev = byText.get(r.text.trim());
    if (!prev || r.id > prev.id) byText.set(r.text.trim(), r);
  }
  const rows = await db.select().from(smsTemplates).where(isNull(smsTemplates.archivedAt));
  let changed = 0;
  for (const row of rows) {
    if (!row.submittedBody) continue;
    const hit = byText.get(row.submittedBody.trim());
    if (!hit) continue;
    // Yuborilgandan keyin matn o'zgargan bo'lsa holat "yuborilmagan" bo'lib qoladi
    const moderation = row.body === row.submittedBody ? moderationFromEskiz(hit.status) : row.moderation;
    if (moderation === row.moderation && row.providerTemplateId === hit.id) continue;
    await db.update(smsTemplates).set({ moderation, providerTemplateId: hit.id }).where(eq(smsTemplates.id, row.id));
    changed++;
  }
  return changed;
}
