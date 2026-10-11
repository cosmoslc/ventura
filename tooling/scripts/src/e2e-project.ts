import { eq } from "drizzle-orm";
import { clients, domains, projectFeatures, projects } from "@ventura/db/schema/panel";
import { context, done, fail } from "./lib";

/*
 * pnpm --filter @ventura/scripts e2e:project -- --slug demo-a --name "Demo A" [--color #059669]
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

const { db } = context();
const [existing] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).limit(1);
if (existing) done(`Loyiha bor: ${slug}`);

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
    ownerLogin: "admin",
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
done(`Loyiha yaratildi: ${slug}`);
