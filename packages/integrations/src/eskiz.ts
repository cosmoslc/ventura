/*
 * Eskiz SMS API klienti (docs/EDU-CRM-SMS.md, 4.1). Hujjat: https://documenter.getpostman.com/view/663428/RzfmES4z
 * Kalit va token faqat server kodida; xato matniga va logga tushmaydi. Token 30 kun yashaydi: muddati o'tgan yoki
 * 401 kelsa — bir marta yangilanadi (refresh, bo'lmasa qayta login) va so'rov takrorlanadi. Yangi token `onToken`
 * orqali chaqiruvchiga beriladi (bazada shifrlab saqlash uchun).
 */

/** Standart manzil. `ESKIZ_API_URL` — e2e testlardagi soxta server uchun. */
const DEFAULT_API = "https://notify.eskiz.uz/api";

/** Hisob faollashguncha Eskiz faqat shu matnlarni yuboradi — ulanishni tekshirish shu bilan */
export const ESKIZ_TEST_MESSAGE = "Bu Eskiz dan test";

/** Nikneym tasdiqlanguncha standart yuboruvchi */
export const ESKIZ_DEFAULT_SENDER = "4546";

export class EskizError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EskizError";
  }
}

export interface EskizConfig {
  email: string;
  /** Kabinetdagi maxfiy kalit (API paroli) */
  secret: string;
  /** Oldin olingan token (bo'lsa login qilinmaydi) */
  token?: string | null;
  /** Yangi token olinganda (login yoki refresh) */
  onToken?: (token: string) => void | Promise<void>;
  api?: string;
  timeoutMs?: number;
}

export interface EskizUser {
  id: number | null;
  name: string | null;
  email: string | null;
  status: string | null;
}

/** Eskiz'dagi shablon: `status` — moderation, inproccess, service, reklama, rejected */
export interface EskizTemplate {
  id: number;
  text: string;
  status: string;
}

export interface EskizStatus {
  /** Eskiz holati as-is: DELIVERED, WAITING, REJECTED ... */
  status: string;
  parts: number | null;
  /** So'm */
  cost: number | null;
}

/** Eskiz (va callback) holati → yakuniy natija; oraliq holat — pending */
export function eskizDeliveryState(status: string): "delivered" | "failed" | "pending" {
  const s = status.toUpperCase();
  if (s === "DELIVERED" || s === "DELIVRD") return "delivered";
  if (/^(REJECTE?D?|UNDELIV(ERABLE|ERED)?|EXPIRED|FAILED|ERROR|DELETED)$/.test(s)) return "failed";
  return "pending";
}

export interface EskizSendResult {
  id: string;
  status: string;
}

/** O'zbekiston raqami `998XXXXXXXXX` ko'rinishiga; noto'g'ri bo'lsa null. */
export function eskizPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 9) return `998${d}`;
  if (d.length === 12 && d.startsWith("998")) return d;
  return null;
}

type Json = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Eskiz javobidan odamga tushunarli xato matni (kalit va token bo'lmaydi). */
function errorText(body: Json | null, fallback: string): string {
  const m = body?.message;
  if (typeof m === "string" && m) return m;
  if (m && typeof m === "object") {
    const first = Object.values(m as Json).flat()[0];
    if (typeof first === "string") return first;
  }
  return fallback;
}

export function createEskiz(config: EskizConfig) {
  const api = config.api || process.env.ESKIZ_API_URL || DEFAULT_API;
  const timeoutMs = config.timeoutMs ?? 15_000;
  let token = config.token ?? null;

  async function raw(method: string, path: string, body?: Json, auth = true) {
    const form = new FormData();
    for (const [k, v] of Object.entries(body ?? {})) if (v != null) form.append(k, String(v));
    const res = await fetch(`${api}${path}`, {
      method,
      headers: auth && token ? { authorization: `Bearer ${token}` } : {},
      body: method === "GET" ? undefined : form,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => null)) as Json | null;
    return { status: res.status, data };
  }

  async function setToken(next: string) {
    token = next;
    await config.onToken?.(next);
  }

  async function login(): Promise<string> {
    const { status, data } = await raw("POST", "/auth/login", { email: config.email, password: config.secret }, false);
    const t = str((data?.data as Json | undefined)?.token);
    if (status >= 400 || !t) throw new EskizError(errorText(data, "Eskiz'ga kirib bo'lmadi"), status);
    await setToken(t);
    return t;
  }

  /** Token yangilash; bo'lmasa — qayta login */
  async function renew() {
    if (token) {
      const { status, data } = await raw("PATCH", "/auth/refresh");
      const t = str((data?.data as Json | undefined)?.token);
      if (status < 400 && t) return setToken(t);
    }
    await login();
  }

  async function call(method: string, path: string, body?: Json): Promise<Json> {
    if (!token) await login();
    let res = await raw(method, path, body);
    if (res.status === 401) {
      await renew();
      res = await raw(method, path, body);
    }
    if (res.status >= 400) throw new EskizError(errorText(res.data, `Eskiz xatosi (${res.status})`), res.status);
    return res.data ?? {};
  }

  return {
    login,
    async user(): Promise<EskizUser> {
      const d = ((await call("GET", "/auth/user")).data ?? {}) as Json;
      return {
        id: typeof d.id === "number" ? d.id : null,
        name: str(d.name),
        email: str(d.email),
        status: str(d.status),
      };
    },
    /** Hisob balansi, so'mda */
    async balance(): Promise<number> {
      const d = (await call("GET", "/user/get-limit")).data as Json | undefined;
      const n = Number(d?.balance);
      if (!Number.isFinite(n)) throw new EskizError("Eskiz balansini o'qib bo'lmadi");
      return n;
    },
    /** Tasdiqlangan yuboruvchi nomlari (nikneymlar) */
    async nicks(): Promise<string[]> {
      // Hujjat bo'yicha javob — to'g'ridan-to'g'ri massiv (`["Eskiz.uz"]`); `data` ichida kelsa ham qabul qilamiz
      const r: unknown = await call("GET", "/nick/me");
      const d = Array.isArray(r) ? r : (r as Json).data;
      const list: unknown[] = Array.isArray(d) ? d : [];
      const names = list
        .map((x) => (typeof x === "string" ? x : (str((x as Json)?.nickname) ?? str((x as Json)?.name))))
        .filter((x): x is string => !!x);
      return [...new Set(names)];
    },
    /** Shablonni moderatsiyaga yuboradi. Javobda id yo'q — keyin `templates()` dan matni bo'yicha topiladi */
    async submitTemplate(text: string): Promise<void> {
      await call("POST", "/user/template", { template: text });
    },
    async templates(): Promise<EskizTemplate[]> {
      const r = (await call("GET", "/user/templates")).result;
      const list: unknown[] = Array.isArray(r) ? r : [];
      return list.flatMap((x) => {
        const t = x as Json;
        const text = str(t.original_text) ?? str(t.template);
        return typeof t.id === "number" && text ? [{ id: t.id, text, status: str(t.status) ?? "moderation" }] : [];
      });
    },
    /** Xabar holati (Eskiz 30 kun saqlaydi) */
    async status(id: string): Promise<EskizStatus> {
      const d = ((await call("GET", `/message/sms/status_by_id/${encodeURIComponent(id)}`)).data ?? {}) as Json;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      return { status: str(d.status) ?? "", parts: num(d.parts_count), cost: num(d.total_price) };
    },
    async send(input: { phone: string; text: string; from?: string; callbackUrl?: string }): Promise<EskizSendResult> {
      const phone = eskizPhone(input.phone);
      if (!phone) throw new EskizError("Telefon raqami noto'g'ri");
      const d = await call("POST", "/message/sms/send", {
        mobile_phone: phone,
        message: input.text,
        from: input.from || ESKIZ_DEFAULT_SENDER,
        callback_url: input.callbackUrl,
      });
      const id = str(d.id);
      if (!id) throw new EskizError(errorText(d, "Eskiz SMS'ni qabul qilmadi"));
      return { id, status: str(d.status) ?? "waiting" };
    },
  };
}

export type Eskiz = ReturnType<typeof createEskiz>;
