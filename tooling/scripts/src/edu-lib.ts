import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createStaffAuth } from "@ventura/auth/staff";
import { createTenantDb } from "@ventura/db";
import { createTelegram } from "@ventura/integrations";
import {
  type Tenant,
  type TenantRegistry,
  type TenantSecrets,
  emptyRegistry,
  emptySecrets,
  parseRegistry,
  parseSecrets,
} from "@ventura/tenants";
import { ROOT, fail, loadEnv } from "./lib";

/*
 * edu-crm mijozlari bilan terminaldan ishlash: ro'yxat (tenants.json) va maxfiy sozlamalar fayli.
 * Serverda bu fayllarni panel deploy paytida yozadi; bu yerdagi buyruqlar mahalliy ishlab chiqish,
 * sinov va favqulodda holatlar uchun.
 */

export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function filePath(env: string): string {
  loadEnv();
  const value = process.env[env];
  if (!value) fail(`${env} berilmagan (.env ga yozing, .env.example ga qarang)`);
  return resolve(ROOT, value);
}

export const registryFile = () => filePath("VENTURA_TENANTS_FILE");
export const secretsFile = () => filePath("VENTURA_TENANT_SECRETS_FILE");

export function readRegistry(file: string): TenantRegistry {
  return existsSync(file) ? parseRegistry(readFileSync(file, "utf8")) : emptyRegistry();
}

export function readSecrets(file: string): TenantSecrets {
  return existsSync(file) ? parseSecrets(readFileSync(file, "utf8")) : emptySecrets();
}

/** Avval vaqtinchalik faylga, keyin almashtirish: ilova yarim yozilgan faylni o'qimaydi. Faqat egasi o'qiydi. */
export function writeJsonAtomic(file: string, value: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

/** Mijoz va uning bazasi, boti, Better Auth'i — xuddi ilovadagidek (lib/server/deps.ts). */
export function tenantContext(slug: string) {
  const tenant = readRegistry(registryFile()).tenants.find((t) => t.slug === slug);
  if (!tenant) fail(`Mijoz topilmadi: ${slug} (avval pnpm edu:tenant)`);
  const secret = readSecrets(secretsFile()).tenants[slug];
  if (!secret) fail(`Mijozning maxfiy sozlamasi yo'q: ${slug}`);
  const db = createTenantDb(secret.databaseUrl, slug, { max: 2 });
  const telegram = secret.telegramBotToken ? createTelegram(secret.telegramBotToken) : null;
  const auth = createStaffAuth({
    db,
    telegram,
    appName: tenant.name,
    secret: secret.authSecret,
    baseURL: `http://${tenant.hosts[0]}`,
  });
  return { tenant: tenant satisfies Tenant, db, telegram, auth };
}
