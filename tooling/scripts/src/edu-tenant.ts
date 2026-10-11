import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { branches } from "@ventura/db/schema/tenant";
import { createTenantDb } from "@ventura/db";
import { grantTenantApp, migrateTenantDb } from "@ventura/db/migrate";
import { type TemplateModule, parseManifest, upsertTenant, withRequirements } from "@ventura/tenants";
import { ROOT, done, fail } from "./lib";
import { flag, readRegistry, readSecrets, registryFile, secretsFile, writeJsonAtomic } from "./edu-lib";

/*
 * pnpm edu:tenant -- --slug bilim --name "Bilim markazi" --host bilim.localhost \
 *   --database-url postgres://edu_app:...@localhost:5432/db_bilim [--migrate-url postgres://...] \
 *   [--bot-token 123:ABC...] [--color #16a34a] [--logo https://...] [--features students,groups,attendance]
 *
 * edu-crm mijozini mahalliy ro'yxatga qo'shadi yoki yangilaydi: tenants.json, maxfiy sozlamalar fayli,
 * baza migratsiyasi va birinchi filial. Serverda shu ishni panel deploy paytida qiladi.
 * Baza strategiyasi URL bilan tanlanadi: umumiy baza — bir nechta mijozga bir xil URL; alohida baza — har biriga o'z URL.
 */

const slug = flag("slug") ?? "";
if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) fail("--slug noto'g'ri (kichik harf, raqam, -)");
const name = flag("name") ?? slug;
const hosts = (flag("host") ?? `${slug}.localhost`).split(",").map((h) => h.trim().toLowerCase());
const color = flag("color") ?? "#3f6df6";
if (!/^#[0-9a-f]{6}$/i.test(color)) fail("--color noto'g'ri (#rrggbb)");
const databaseUrl = flag("database-url") ?? "";
if (!/^postgres(ql)?:\/\//.test(databaseUrl)) fail("--database-url kerak (postgres://...)");

// Ilovalar bir-birini import qilmaydi: manifest templates:sync kabi fayl sifatida o'qiladi
const mod = (await import(pathToFileURL(resolve(ROOT, "apps/edu-crm/features.ts")).href)) as TemplateModule;
const { features } = parseManifest(mod);
const requested =
  flag("features")
    ?.split(",")
    .map((s) => s.trim()) ?? features.map((f) => f.key);
const unknown = requested.filter((k) => !features.some((f) => f.key === k));
if (unknown.length) fail(`Noma'lum bo'lim: ${unknown.join(", ")}`);
const enabled = [...withRequirements(features, requested)].sort();

// 1. Baza (egasi nomidan); keyin ilova ulanishi bilan birinchi filial
const migrateUrl = flag("migrate-url") ?? databaseUrl;
await migrateTenantDb(migrateUrl);
const appRole = decodeURIComponent(new URL(databaseUrl).username);
if (appRole && appRole !== decodeURIComponent(new URL(migrateUrl).username)) await grantTenantApp(migrateUrl, appRole);
const db = createTenantDb(databaseUrl, slug, { max: 1 });
const existingBranches = await db.select({ id: branches.id }).from(branches).limit(1);
if (!existingBranches.length) await db.insert(branches).values({ name: "Asosiy filial" });
await db.close();

// 2. Maxfiy sozlamalar (bor kalit saqlanadi — kirgan xodimlar chiqib ketmaydi)
const sFile = secretsFile();
const secrets = readSecrets(sFile);
const prev = secrets.tenants[slug];
secrets.tenants[slug] = {
  databaseUrl,
  authSecret: prev?.authSecret ?? randomBytes(32).toString("base64url"),
  telegramBotToken: flag("bot-token") ?? prev?.telegramBotToken,
};
writeJsonAtomic(sFile, secrets);

// 3. Ochiq ro'yxat (sirlarsiz)
const rFile = registryFile();
const logoUrl = flag("logo");
const registry = upsertTenant(readRegistry(rFile), {
  slug,
  name,
  hosts,
  brand: { primary: color, appearance: "light", ...(logoUrl ? { logoUrl } : {}) },
  features: enabled,
});
writeJsonAtomic(rFile, registry);

console.log(`Domen: ${hosts.join(", ")}`);
console.log(`Bo'limlar (${enabled.length}): ${enabled.join(", ")}`);
if (!secrets.tenants[slug]!.telegramBotToken) {
  console.log("Diqqat: Telegram bot tokeni berilmagan — xodimlar kira olmaydi (--bot-token).");
}
done(`Mijoz tayyor: ${slug}. Endi direktor: pnpm edu:staff -- --tenant ${slug} --phone ... --name ...`);
