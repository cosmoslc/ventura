import "server-only";
import { createHash } from "node:crypto";
import { type SawmillDb, createSawmillDb } from "@ventura/db";
import { type Telegram, createTelegram } from "@ventura/integrations";
import type { Tenant } from "@ventura/tenants";
import { type SawmillAuth, createSawmillAuth } from "./auth";
import { tenantSecret } from "./tenant";

export interface SawmillTenantDeps {
  db: SawmillDb;
  telegram: Telegram | null;
  appName: string;
  secret: string;
  auth(origin: string): SawmillAuth;
}

interface Entry {
  fingerprint: string;
  deps: SawmillTenantDeps;
}

const g = globalThis as unknown as { __sawmillDeps?: Map<string, Entry> };
const entries = (g.__sawmillDeps ??= new Map());

const fingerprint = (...parts: (string | undefined)[]) =>
  createHash("sha256")
    .update(parts.map((p) => p ?? "").join("\n"))
    .digest("hex");

export function sawmillDeps(tenant: Tenant): SawmillTenantDeps | null {
  const secret = tenantSecret(tenant);
  if (!secret) return null;
  const fp = fingerprint(secret.databaseUrl, secret.authSecret, secret.telegramBotToken, tenant.name);
  const existing = entries.get(tenant.slug);
  if (existing?.fingerprint === fp) return existing.deps;
  if (existing) void existing.deps.db.close().catch(() => {});

  const db = createSawmillDb(secret.databaseUrl, tenant.slug);
  const telegram = secret.telegramBotToken ? createTelegram(secret.telegramBotToken) : null;
  const auths = new Map<string, SawmillAuth>();

  const deps: SawmillTenantDeps = {
    db,
    telegram,
    appName: tenant.name,
    secret: secret.authSecret,
    auth(origin) {
      let auth = auths.get(origin);
      if (!auth) {
        auth = createSawmillAuth({
          db,
          telegram,
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
