import { afterEach, describe, expect, it, vi } from "vitest";
import { EskizError, createEskiz, eskizPhone } from "./eskiz";

/* Eskiz klienti soxta fetch bilan: login, token yangilash (401), xato matnida sir yo'qligi, telefon formati. */

const API = "https://eskiz.test/api";

interface Call {
  method: string;
  path: string;
  auth: string | null;
  body: Record<string, string>;
}

function fakeEskiz(routes: Record<string, (c: Call) => { status?: number; json: unknown }>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body: Record<string, string> = {};
    if (init.body instanceof FormData) for (const [k, v] of init.body.entries()) body[k] = String(v);
    const c: Call = {
      method: init.method ?? "GET",
      path: url.replace(API, ""),
      auth: headers.authorization ?? null,
      body,
    };
    calls.push(c);
    const route = routes[`${c.method} ${c.path}`];
    const r = route ? route(c) : { status: 404, json: { message: "not found" } };
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("eskizPhone", () => {
  it("998 bilan 12 raqamga keltiradi", () => {
    expect(eskizPhone("+998 90 123-45-67")).toBe("998901234567");
    expect(eskizPhone("901234567")).toBe("998901234567");
    expect(eskizPhone("12345")).toBeNull();
    expect(eskizPhone("+7 900 123 45 67")).toBeNull();
  });
});

describe("createEskiz", () => {
  it("token bo'lmasa login qiladi va yangi tokenni beradi", async () => {
    const calls = fakeEskiz({
      "POST /auth/login": () => ({ json: { message: "token_generated", data: { token: "T1" } } }),
      "GET /user/get-limit": () => ({ json: { status: "success", data: { balance: 12500 } } }),
    });
    const onToken = vi.fn();
    const eskiz = createEskiz({ email: "a@b.uz", secret: "KALIT", api: API, onToken });
    expect(await eskiz.balance()).toBe(12500);
    expect(onToken).toHaveBeenCalledWith("T1");
    expect(calls[0]!.body).toEqual({ email: "a@b.uz", password: "KALIT" });
    expect(calls[1]!.auth).toBe("Bearer T1");
  });

  it("401 kelsa tokenni yangilaydi va so'rovni takrorlaydi", async () => {
    const calls = fakeEskiz({
      "PATCH /auth/refresh": () => ({ json: { data: { token: "T2" } } }),
      "GET /nick/me": (c) =>
        c.auth === "Bearer T2"
          ? { json: ["MARKAZ", "4546", "MARKAZ"] }
          : { status: 401, json: { message: "Unauthenticated." } },
    });
    const onToken = vi.fn();
    const eskiz = createEskiz({ email: "a@b.uz", secret: "KALIT", token: "ESKI", api: API, onToken });
    expect(await eskiz.nicks()).toEqual(["MARKAZ", "4546"]);
    expect(onToken).toHaveBeenCalledWith("T2");
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /nick/me", "PATCH /auth/refresh", "GET /nick/me"]);
  });

  it("refresh ham o'tmasa qayta login qiladi", async () => {
    fakeEskiz({
      "PATCH /auth/refresh": () => ({ status: 401, json: { message: "Unauthenticated." } }),
      "POST /auth/login": () => ({ json: { data: { token: "T3" } } }),
      "GET /auth/user": (c) =>
        c.auth === "Bearer T3"
          ? { json: { data: { id: 7, name: "Markaz", email: "a@b.uz", status: "active" } } }
          : { status: 401, json: { message: "Unauthenticated." } },
    });
    const eskiz = createEskiz({ email: "a@b.uz", secret: "KALIT", token: "ESKI", api: API });
    expect(await eskiz.user()).toEqual({ id: 7, name: "Markaz", email: "a@b.uz", status: "active" });
  });

  it("noto'g'ri kalitda Eskiz xabarini qaytaradi, kalit xato matnida yo'q", async () => {
    fakeEskiz({ "POST /auth/login": () => ({ status: 401, json: { message: "Incorrect email or password" } }) });
    const eskiz = createEskiz({ email: "a@b.uz", secret: "MAXFIY-KALIT", api: API });
    const err = await eskiz.balance().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EskizError);
    expect((err as EskizError).message).toBe("Incorrect email or password");
    expect((err as EskizError).message).not.toContain("MAXFIY-KALIT");
  });

  it("SMS yuboradi: raqam formatlanadi, standart yuboruvchi 4546", async () => {
    const calls = fakeEskiz({
      "POST /message/sms/send": () => ({
        json: { id: "uuid-1", message: "Waiting for SMS provider", status: "waiting" },
      }),
    });
    const eskiz = createEskiz({ email: "a@b.uz", secret: "K", token: "T", api: API });
    expect(await eskiz.send({ phone: "+998 90 123 45 67", text: "Bu Eskiz dan test" })).toEqual({
      id: "uuid-1",
      status: "waiting",
    });
    expect(calls[0]!.body).toEqual({ mobile_phone: "998901234567", message: "Bu Eskiz dan test", from: "4546" });
  });

  it("noto'g'ri raqamga so'rov yubormaydi", async () => {
    const calls = fakeEskiz({});
    const eskiz = createEskiz({ email: "a@b.uz", secret: "K", token: "T", api: API });
    await expect(eskiz.send({ phone: "123", text: "x" })).rejects.toThrow("Telefon raqami noto'g'ri");
    expect(calls).toHaveLength(0);
  });
});
