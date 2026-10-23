import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { type StaffAuth, type StaffDeps, createStaffAuth } from "@ventura/auth/staff";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/tenant";
import { type Telegram, createTelegram } from "@ventura/integrations";
import type { Tenant } from "@ventura/tenants";
import { TELEGRAM_BOTS_KEY, parseTelegramBotsConfig } from "../telegram-bots";
import { tenantSecret } from "./tenant";

/*
 * Mijozning server bog'liqliklari: baza (getTenantDb), uning Telegram boti va Better Auth.
 * Mijoz bo'yicha keshlanadi; maxfiy sozlama o'zgarsa (yangi baza manzili yoki bot), eskisi yopilib yangisi ochiladi.
 * Sahifa va server amallari baza strategiyasini bilmaydi — farq faqat manzilda (SPEC 4-bo'lim).
 */

export interface TenantDeps extends StaffDeps {
  telegram: Telegram | null;
  secret: string;
  /** Shu mijoz uchun Better Auth (so'rov manziliga qarab: http yoki https) */
  auth(origin: string): StaffAuth;
}

interface Entry {
  fingerprint: string;
  deps: TenantDeps;
}

const g = globalThis as unknown as { __eduDeps?: Map<string, Entry> };
const entries = (g.__eduDeps ??= new Map());

const fingerprint = (...parts: (string | undefined)[]) =>
  createHash("sha256")
    .update(parts.map((p) => p ?? "").join("\n"))
    .digest("hex");

/** null — mijozning bazasi hali sozlanmagan (panel maxfiy sozlamani yozmagan). */
export function tenantDeps(tenant: Tenant): TenantDeps | null {
  const secret = tenantSecret(tenant);
  if (!secret) return null;
  const fp = fingerprint(secret.databaseUrl, secret.authSecret, secret.telegramBotToken, tenant.name);
  const existing = entries.get(tenant.slug);
  if (existing?.fingerprint === fp) return existing.deps;
  if (existing) void existing.deps.db.close().catch(() => {});

  const db = createTenantDb(secret.databaseUrl, tenant.slug);
  let telegram = secret.telegramBotToken ? createTelegram(secret.telegramBotToken) : null;
  const auths = new Map<string, StaffAuth>();
  const deps: TenantDeps = {
    db,
    get telegram() {
      return telegram;
    },
    set telegram(t: Telegram | null) {
      telegram = t;
    },
    appName: tenant.name,
    secret: secret.authSecret,
    auth(origin) {
      let auth = auths.get(origin);
      if (!auth) {
        auth = createStaffAuth({
          db,
          telegram: () => deps.telegram,
          appName: tenant.name,
          secret: secret.authSecret,
          baseURL: origin,
        });
        auths.set(origin, auth);
      }
      return auth;
    },
  };
  entries.set(tenant.slug, { fingerprint: fp, deps });
  return deps;
}

/**
 * Markaz Telegram botini aniqlaydi:
 * 1. Avval maxfiy sozlamadagi (secret.telegramBotToken)
 * 2. Bo'lmasa, baza sozlamalaridagi (settings.telegram_bots dagi teacherBot)
 * Muallif / Agent: Google Gemini
 */
export async function resolveTelegramBot(deps: TenantDeps): Promise<Telegram | null> {
  if (deps.telegram) return deps.telegram;
  const [row] = await deps.db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, TELEGRAM_BOTS_KEY))
    .limit(1)
    .catch(() => []);
  const config = parseTelegramBotsConfig(row?.value);
  const token = config.teacherBot.token?.trim() || config.studentBot.token?.trim();
  if (token) {
    const tg = createTelegram(token);
    deps.telegram = tg;
    return tg;
  }
  return null;
}

/** SPEC 4-bo'lim: mijoz bazasiga ulanish faqat shu orqali olinadi. */
export function getTenantDb(tenant: Tenant): TenantDb {
  const deps = tenantDeps(tenant);
  if (!deps) throw new Error(`Mijoz bazasi sozlanmagan: ${tenant.slug}`);
  return deps.db;
}
