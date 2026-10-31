import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createPcCrmDb } from "@ventura/db";
import { migratePcCrmDb } from "@ventura/db/migrate/pc-crm";
import { settings, shippingRates } from "@ventura/db/schema/pc-crm";
import { type TemplateModule, parseManifest, withRequirements } from "@ventura/tenants";
import { ROOT, done, fail } from "./lib";
import { flag } from "./edu-lib";

/*
 * pnpm pc:tenant -- --slug titan-pc --name "Titan PC Store" \
 *   --database-url postgres://postgres:postgres@localhost:5432/db_titan_pc
 *
 * Dedicated (Silo) model bo'yicha yangi PC-CRM mijozini ishga tushiradi:
 * 1. Alohida mijoz bazasida Drizzle migratsiyalarini yurgizadi (36 ta jadval).
 * 2. Standart boshlang'ich sozlamalarni (USD kursi, bepul yetkazish chegarasi, viloyatlar tariflari) yozadi.
 */

const slug = flag("slug") ?? "";
if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
  fail("--slug noto'g'ri (faqat kichik harf, raqam va defis: masalan 'titan-pc')");
}

const name = flag("name") ?? slug;
const databaseUrl = flag("database-url") ?? "";
if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  fail("--database-url kerak (masalan: postgres://user:pass@host:5432/db_name)");
}

// 1. Manifest bo'limlarini tekshirish
const mod = (await import(pathToFileURL(resolve(ROOT, "apps/pc-crm/features.ts")).href)) as TemplateModule;
const { features } = parseManifest(mod);
const requested =
  flag("features")
    ?.split(",")
    .map((s) => s.trim()) ?? features.map((f) => f.key);
const unknown = requested.filter((k) => !features.some((f) => f.key === k));
if (unknown.length) fail(`Noma'lum bo'lim: ${unknown.join(", ")}`);
const enabled = [...withRequirements(features, requested)].sort();

// 2. Alohida mijoz bazasiga migratsiya yurgizish
console.log(`[pc-tenant] Migratsiya boshlandi: ${slug}...`);
await migratePcCrmDb(databaseUrl);
console.log(`[pc-tenant] 36 ta jadval muvaffaqiyatli yaratildi.`);

// 3. Standart sozlamalarni yozish
const db = createPcCrmDb(databaseUrl, { max: 1 });

try {
  await db
    .insert(settings)
    .values([
      { key: "store_branding", value: { storeName: name, slug } },
      { key: "usd_rate", value: { rate: 12850 } },
      { key: "tax_percent", value: { percent: 0 } },
      { key: "free_shipping_from", value: { amount: "1000000" } },
      {
        key: "store_contacts",
        value: {
          phone: "+998 71 200 00 00",
          telegram: "@venturapc_operator",
          address: "Toshkent sh., Bunyodkor shoh ko'chasi 42",
        },
      },
      { key: "modules", value: { enabledFeatures: enabled } },
    ])
    .onConflictDoNothing();

  // Standart viloyatlar yetkazib berish narxlari
  await db
    .insert(shippingRates)
    .values([
      { region: "Toshkent shahri", price: 35_000n, estimatedDays: "1 kun", enabled: true },
      { region: "Toshkent viloyati", price: 40_000n, estimatedDays: "1-2 kun", enabled: true },
      { region: "Samarqand viloyati", price: 50_000n, estimatedDays: "2-3 kun", enabled: true },
      { region: "Farg'ona vodiysi", price: 50_000n, estimatedDays: "2-3 kun", enabled: true },
    ])
    .onConflictDoNothing();
} finally {
  await db.close();
}

done(`PC-CRM dedicated mijozi tayyor: ${slug} (${name})!`);
