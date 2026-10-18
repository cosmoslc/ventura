import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Ventura SMS relay protokoli (docs/EDU-CRM-SMS.md, S4; ADR 0056). Markaz ilovasi Ventura paketidan SMS yuborganda
 * panelga (`<panel>/api/sms/relay/<amal>`) imzolangan JSON so'rov yuboradi. Imzo: HMAC-SHA256(kalit, "<ts>.<body>"),
 * kalit — har loyihaga alohida (panel yaratadi, deploy markazning maxfiy sozlamasiga yozadi). Ventura'ning Eskiz
 * kaliti markaz serveriga hech qachon tushmaydi.
 */

export const RELAY_HEADERS = {
  tenant: "x-ventura-tenant",
  ts: "x-ventura-ts",
  sig: "x-ventura-sig",
} as const;

/** So'rov va javob vaqti orasidagi ruxsat etilgan farq (takroriy yuborishga qarshi) */
export const RELAY_SKEW_MS = 5 * 60_000;

export const RELAY_ACTIONS = ["send", "status", "wallet", "purchase", "template_submit", "template_status"] as const;
export type RelayAction = (typeof RELAY_ACTIONS)[number];

/** Xato kodlari: insufficient — qism yetmaydi; rejected — Eskiz rad etdi; unavailable — Ventura Eskiz'i ulanmagan */
export type RelayErrorCode = "insufficient" | "rejected" | "unavailable" | "invalid" | "unauthorized" | "error";

export class RelayError extends Error {
  constructor(
    message: string,
    readonly code: RelayErrorCode,
  ) {
    super(message);
    this.name = "RelayError";
  }
}

export interface RelayPackage {
  id: string;
  name: string;
  parts: number;
  price: number;
}

export interface RelayWallet {
  balance: number;
  packages: RelayPackage[];
  pending: { id: string; packageName: string; parts: number; price: number; createdAt: string }[];
}

export function relaySignature(key: string, ts: string, body: string): string {
  return createHmac("sha256", key).update(`${ts}.${body}`).digest("hex");
}

export function verifyRelay(input: { key: string; ts: string; sig: string; body: string; now?: number }): boolean {
  const ts = Number(input.ts);
  if (!Number.isFinite(ts) || Math.abs((input.now ?? Date.now()) - ts) > RELAY_SKEW_MS) return false;
  const expected = Buffer.from(relaySignature(input.key, input.ts, input.body));
  const got = Buffer.from(input.sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function createRelay(config: { url: string; slug: string; key: string; timeoutMs?: number }) {
  const base = config.url.replace(/\/+$/, "");

  async function call<T>(action: RelayAction, payload: Record<string, unknown> = {}): Promise<T> {
    const body = JSON.stringify(payload);
    const ts = String(Date.now());
    let res: Response;
    try {
      res = await fetch(`${base}/api/sms/relay/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [RELAY_HEADERS.tenant]: config.slug,
          [RELAY_HEADERS.ts]: ts,
          [RELAY_HEADERS.sig]: relaySignature(config.key, ts, body),
        },
        body,
        signal: AbortSignal.timeout(config.timeoutMs ?? 20_000),
      });
    } catch (e) {
      throw new RelayError(`Ventura serveriga ulanib bo'lmadi: ${(e as Error).message}`, "error");
    }
    const data = (await res.json().catch(() => null)) as ({ error?: string; code?: RelayErrorCode } & T) | null;
    if (!res.ok || !data) {
      throw new RelayError(data?.error ?? `Ventura xatosi (${res.status})`, data?.code ?? "error");
    }
    return data;
  }

  return {
    send: (phone: string, text: string) => call<{ providerId: string; parts: number }>("send", { phone, text }),
    status: (providerId: string) =>
      call<{ state: "delivered" | "failed" | "pending"; parts: number | null }>("status", { providerId }),
    wallet: () => call<RelayWallet>("wallet"),
    /** Shablonni Ventura Eskiz hisobida moderatsiyaga yuboradi */
    submitTemplate: (text: string) => call<{ ok: true }>("template_submit", { text }),
    /** Berilgan matnlar holati (Eskiz'dagi boshqa markazlar shablonlari qaytmaydi) */
    templateStatus: (texts: string[]) =>
      call<{ templates: { text: string; id: number; status: string }[] }>("template_status", { texts }),
    purchase: (packageId: string, requestedBy: string) => call<{ id: string }>("purchase", { packageId, requestedBy }),
  };
}

export type Relay = ReturnType<typeof createRelay>;
