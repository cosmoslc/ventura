"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { hasFeature } from "@ventura/tenants";
import { WindowLimiter, applyInput, plausiblePhone } from "@/lib/apply-form";
import { checkStamp } from "@/lib/apply-stamp";
import { getApplyForm, submitApplication } from "@/lib/server/apply";
import { tenantDeps } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";
import { currentTenant } from "@/lib/server/tenant";
import { uz } from "@/lib/uz";

/*
 * Ariza yuborish (ADR 0026) — kirishsiz amal. Tartib: mijoz va bo'lim yoqilgan, sahifa yoqilgan, tuzoq maydon bo'sh,
 * vaqt belgisi to'g'ri va forma 3 soniyadan keyin yuborilgan, IP va markaz bo'yicha chegara, telefon. Botga
 * "qabul qilindi" deb javob beriladi (tuzoq yoki juda tez) — u nimani noto'g'ri qilganini bilmaydi.
 */

export type ApplyActionResult = { ok: true } | { ok: false; error: string };

const g = globalThis as unknown as { __eduApplyLimits?: { ip: WindowLimiter; tenant: WindowLimiter } };
const limits = (g.__eduApplyLimits ??= {
  // Bir IP'dan 10 daqiqada 3 ta ariza; bitta markazga soatiga 60 ta
  ip: new WindowLimiter(3, 10 * 60_000),
  tenant: new WindowLimiter(60, 60 * 60_000),
});

export async function submitApplyAction(input: unknown): Promise<ApplyActionResult> {
  const t = uz.apply;
  const tenant = await currentTenant();
  if (!tenant || !(await hasFeature(tenant, "leads"))) return { ok: false, error: t.closed };
  const deps = tenantDeps(tenant);
  if (!deps) return { ok: false, error: t.closed };
  const form = await getApplyForm(deps.db);
  if (!form.enabled) return { ok: false, error: t.closed };

  const parsed = applyInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.path[0];
    return { ok: false, error: issue === "name" ? t.nameRequired : issue === "phone" ? t.phoneInvalid : t.failed };
  }
  const v = parsed.data;
  if (v.website.trim()) return { ok: true };
  const stamp = checkStamp(deps.secret, tenant.slug, v.stamp);
  if (stamp === "invalid") return { ok: false, error: t.stale };
  if (stamp === "fast") return { ok: true };
  if (!plausiblePhone(v.phone)) return { ok: false, error: t.phoneInvalid };

  const meta = await requestMeta();
  // Chegara uchun IP — nginx yozadigan X-Real-IP (X-Forwarded-For ning birinchi qiymatini mijoz o'zi yuborishi mumkin)
  const ip = (await headers()).get("x-real-ip") || meta.ip;
  if (!limits.ip.take(`${tenant.slug}:${ip}`) || !limits.tenant.take(tenant.slug))
    return { ok: false, error: t.tooMany };

  const res = await submitApplication(deps.db, form, v, { ip, userAgent: meta.userAgent });
  if (!res.ok) return { ok: false, error: res.reason === "missing" ? t.fieldMissing(res.field ?? "") : t.closed };
  revalidatePath("/leads");
  return { ok: true };
}
