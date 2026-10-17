import { and, eq, isNull } from "drizzle-orm";
import { clients, domains, projectFeatures, projects } from "@ventura/db/schema/panel";
import { putSecret } from "@ventura/security";
import { context, done, fail } from "./lib";

/*
 * pnpm --filter @ventura/scripts e2e:project -- --slug demo-a --name "Demo A" [--color #059669]
 *   [--db shared_db|db_per_tenant|dedicated_server] [--mode shared|dedicated] [--owner-phone +998901234567]
 * Loyiha bor bo'lsa va --mode berilsa — faqat rejimi o'zgartiriladi (rejim almashishini sinash uchun).
 * Sinov loyihasi (CI'dagi haqiqiy deploy sinovi uchun). Faqat test bazasida ishlaydi:
 * E2E_DATABASE_URL bo'lmasa to'xtaydi, shuning uchun haqiqiy bazaga tegmaydi.
 */

if (!process.env.E2E_DATABASE_URL || process.env.PANEL_DATABASE_URL !== process.env.E2E_DATABASE_URL) {
  fail("e2e:project faqat test bazasida ishlaydi (E2E_DATABASE_URL)");
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const slug = flag("slug") ?? "";
const name = flag("name") ?? slug;
const color = flag("color") ?? "#3f6df6";
if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) fail("--slug noto'g'ri");
if (!/^#[0-9a-f]{6}$/i.test(color)) fail("--color noto'g'ri");
const DB = ["shared_db", "db_per_tenant", "dedicated_server"] as const;
const MODES = ["shared", "dedicated"] as const;
const dbStrategy = (flag("db") ?? "db_per_tenant") as (typeof DB)[number];
const mode = flag("mode") as (typeof MODES)[number] | undefined;
if (!DB.includes(dbStrategy)) fail("--db: shared_db, db_per_tenant yoki dedicated_server");
if (mode && !MODES.includes(mode)) fail("--mode: shared yoki dedicated");

const { db } = context();
const [existing] = await db
  .select({ id: projects.id })
  .from(projects)
  .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
  .limit(1);
if (existing) {
  if (!mode) done(`Loyiha bor: ${slug}`);
  await db.update(projects).set({ mode }).where(eq(projects.id, existing.id));
  done(`Loyiha rejimi o'zgardi: ${slug} → ${mode}`);
}

const [client] = await db
  .insert(clients)
  .values({ name: `Sinov mijozi (${slug})` })
  .returning({ id: clients.id });
const [project] = await db
  .insert(projects)
  .values({
    clientId: client!.id,
    templateKey: "edu-crm",
    slug,
    name,
    brand: { primary: color, appearance: "light" },
    ownerName: `Direktor ${name}`,
    ownerPhone: flag("owner-phone") ?? "+998901234567",
    dbStrategy,
    mode: mode ?? "shared",
  })
  .returning({ id: projects.id });
await db
  .insert(domains)
  .values({ projectId: project!.id, hostname: `${slug}.ventura.uz`, kind: "subdomain", isPrimary: true });
await db.insert(projectFeatures).values(
  ["students", "courses", "teachers", "groups"].map((featureKey) => ({
    projectId: project!.id,
    featureKey,
    enabled: true,
  })),
);
// Ega (direktor) vaqtinchalik paroli — Yangi loyiha formasi kabi shifrlangan holda
await putSecret(
  db,
  { type: "project", id: project!.id },
  "owner_password",
  flag("owner-password") ?? "E2eVaqtincha123",
);
done(`Loyiha yaratildi: ${slug}`);
