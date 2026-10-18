import "server-only";
import { createHmac } from "node:crypto";
import type { TenantDb } from "@ventura/db";
import { EskizError, eskizDeliveryState } from "@ventura/integrations/eskiz";
import type { Tenant } from "@ventura/tenants";
import { type Relay, RelayError } from "@ventura/integrations/relay";
import { relayFor } from "./context";
import { eskizFor, getProviderRow, modeOf } from "./provider";

/*
 * SMS yuboruvchi (docs/EDU-CRM-SMS.md, S3): navbat (outbox.ts) provayderni bilmaydi — faqat shu interfeys.
 * Ventura paketi (standart) — panel relay orqali; markazning o'z Eskiz hisobi — to'g'ridan-to'g'ri.
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

/** Joriy rejim yuboruvchisi: Ventura paketi (panel relay) yoki markazning o'z Eskiz hisobi; sozlanmagan — null */
export async function senderFor(tenant: Tenant, db: TenantDb, authSecret: string): Promise<SmsSender | null> {
  const row = await getProviderRow(db);
  if (modeOf(row) === "ventura") {
    const relay = relayFor(tenant);
    return relay ? relaySender(relay) : null;
  }
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

/** Ventura paketi: qism yetmasa yoki Eskiz rad etsa — qayta urinish befoyda */
function relaySender(relay: Relay): SmsSender {
  return {
    from: null,
    async send(msg) {
      try {
        const res = await relay.send(msg.phone, msg.text);
        return { providerId: res.providerId };
      } catch (e) {
        if (e instanceof RelayError && (e.code === "rejected" || e.code === "insufficient" || e.code === "invalid")) {
          throw new SmsRejected(e.message);
        }
        throw e;
      }
    },
    async status(providerId) {
      const s = await relay.status(providerId);
      return { state: s.state, parts: s.parts, cost: null };
    },
  };
}
