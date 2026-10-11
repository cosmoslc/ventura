import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { templates } from "@ventura/db/schema/panel";
import { audit } from "@ventura/security";
import { type TemplateModule, parseManifest } from "@ventura/tenants";
import { ROOT, context, done, fail } from "./lib";

/*
 * pnpm templates:sync — apps/<shablon>/features.ts manifestlarini o'qib, templates jadvaliga yozadi.
 * Yangi shablon qo'shish panel kodini o'zgartirmaydi (SPEC 13, 8-bosqich qabuli).
 */

const { db } = context();
const appsDir = resolve(ROOT, "apps");
const synced: string[] = [];

for (const dir of readdirSync(appsDir)) {
  const file = resolve(appsDir, dir, "features.ts");
  if (!existsSync(file)) continue;
  const mod = (await import(pathToFileURL(file).href)) as TemplateModule;
  let parsed;
  try {
    parsed = parseManifest(mod);
  } catch (e) {
    fail(`apps/${dir}/features.ts: ${(e as Error).message}`);
  }
  const { template, features } = parsed;
  const row = {
    name: template.name,
    category: template.category,
    description: template.description ?? null,
    appPath: `apps/${dir}`,
    version: template.version,
    manifest: features,
    syncedAt: new Date(),
  };
  await db
    .insert(templates)
    .values({ key: template.key, ...row })
    .onConflictDoUpdate({ target: templates.key, set: row });
  await audit.record(db, {
    actor: { type: "cli", name: "pnpm templates:sync" },
    action: "template.sync",
    target: { type: "template", id: template.key },
    metadata: { version: template.version, features: features.length },
  });
  synced.push(`${template.key}@${template.version} (${features.length} bo'lim)`);
}

if (!synced.length) fail("apps/*/features.ts topilmadi");
done(`Sinxronlandi: ${synced.join(", ")}`);
