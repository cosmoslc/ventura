import { afterEach, describe, expect, it, vi } from "vitest";
import { RELAY_HEADERS, RelayError, createRelay, relaySignature, verifyRelay } from "./relay";

/* Relay imzosi: to'g'ri kalit va vaqt — o'tadi; boshqa kalit, o'zgargan tana, eski vaqt — yo'q. Klient xato kodini beradi. */

const KEY = "k".repeat(43);

afterEach(() => vi.unstubAllGlobals());

describe("relay imzosi", () => {
  it("tekshiradi", () => {
    const now = 1_760_000_000_000;
    const ts = String(now);
    const body = '{"phone":"998901112233"}';
    const sig = relaySignature(KEY, ts, body);
    expect(verifyRelay({ key: KEY, ts, sig, body, now })).toBe(true);
    expect(verifyRelay({ key: "boshqa".repeat(8), ts, sig, body, now })).toBe(false);
    expect(verifyRelay({ key: KEY, ts, sig, body: '{"phone":"998900000000"}', now })).toBe(false);
    expect(verifyRelay({ key: KEY, ts, sig, body, now: now + 6 * 60_000 })).toBe(false);
    expect(verifyRelay({ key: KEY, ts: "abc", sig, body, now })).toBe(false);
  });
});

describe("createRelay", () => {
  it("imzolangan so'rov yuboradi va xato kodini qaytaradi", async () => {
    const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
      if (url.endsWith("/send")) return new Response(JSON.stringify({ providerId: "p1", parts: 1 }));
      return new Response(JSON.stringify({ error: "SMS qoldig'i yetmaydi", code: "insufficient" }), { status: 402 });
    });
    const relay = createRelay({ url: "https://admin.test/", slug: "alfa", key: KEY });
    expect(await relay.send("998901112233", "Salom")).toEqual({ providerId: "p1", parts: 1 });
    const s = seen[0]!;
    expect(s.url).toBe("https://admin.test/api/sms/relay/send");
    expect(s.headers[RELAY_HEADERS.tenant]).toBe("alfa");
    expect(
      verifyRelay({ key: KEY, ts: s.headers[RELAY_HEADERS.ts]!, sig: s.headers[RELAY_HEADERS.sig]!, body: s.body }),
    ).toBe(true);

    const err = await relay.wallet().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RelayError);
    expect((err as RelayError).code).toBe("insufficient");
  });
});
