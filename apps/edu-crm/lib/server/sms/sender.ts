import "server-only";
import { createHmac } from "node:crypto";
import type { TenantDb } from "@ventura/db";
import { EskizError, eskizDeliveryState } from "@ventura/integrations/eskiz";
import type { Tenant } from "@ventura/tenants";
import { eskizFor, getProviderRow } from "./provider";

/*
 * SMS yuboruvchi (docs/EDU-CRM-SMS.md, S3): navbat (outbox.ts) provayderni bilmaydi — faqat shu interfeys.
 * Hozir markazning o'z Eskiz hisobi (A rejim); Ventura paketi (B rejim, standart) panel relay orqali shu interfeysni
 * amalga oshiradi.
 */

export type DeliveryState = "delivered" | "failed" | "pending";

/** Provayder xabarni qabul qilmadi (masalan test holatida boshqa matn, noto'g'ri raqam): qayta urinish befoyda */
export class SmsRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsRejected";
  }
}

export interface SmsSender {
  /** Yuboruvchi nomi (nikneym); null — standart */
  from: string | null;
  send(msg: { phone: string; text: string }): Promise<{ providerId: string }>;
  status(providerId: string): Promise<{ state: DeliveryState; parts: number | null; cost: number | null }>;
}

/** Callback manzilidagi maxfiy qism: tenant `authSecret`idan (taxmin qilib bo'lmaydi, markazga xos) */
export function callbackToken(authSecret: string): string {
  return createHmac("sha256", authSecret).update("sms-callback-v1").digest("base64url").slice(0, 32);
}

/** Eskiz holat xabarini yuboradigan manzil; mahalliy domenda (localhost) — yo'q, holat so'rov bilan olinadi */
export function callbackUrl(tenant: Pick<Tenant, "hosts">, authSecret: string): string | undefined {
  const host = tenant.hosts.find((h) => h.includes(".") && !/^\d/.test(h) && !h.endsWith(".localhost"));
  return host ? `https://${host}/api/sms/eskiz/${callbackToken(authSecret)}` : undefined;
}

export async function senderFor(
  db: TenantDb,
  tenant: Pick<Tenant, "hosts">,
  authSecret: string,
): Promise<SmsSender | null> {
  const row = await getProviderRow(db);
  const eskiz = eskizFor(db, row, authSecret);
  if (!eskiz) return null;
  const from = row?.sender ?? null;
  const cb = callbackUrl(tenant, authSecret);
  return {
    from,
    async send(msg) {
      try {
        const res = await eskiz.send({ phone: msg.phone, text: msg.text, from: from ?? undefined, callbackUrl: cb });
        return { providerId: res.id };
      } catch (e) {
        // 4xx (401 — kirish, 429 — tezlik cheklovidan tashqari): so'rovning o'zi rad etilgan
        const s = e instanceof EskizError ? e.status : undefined;
        if (s && s >= 400 && s < 500 && s !== 401 && s !== 429)
          throw new SmsRejected(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
    async status(providerId) {
      const s = await eskiz.status(providerId);
      return { state: eskizDeliveryState(s.status), parts: s.parts, cost: s.cost };
    },
  };
}
