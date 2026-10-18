import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { apps, projects, secrets } from "@ventura/db/schema/panel";
import { deleteSecrets } from "@ventura/security";
import { parseRegistry, parseSecrets, removeTenant } from "@ventura/tenants";
import { DB_LIST_COMMAND, DB_NAME_RE, SYSTEM_DATABASES, dbNameFor, parseDbList } from "./databases";
import { instanceName } from "./drivers/ssh";
import { type ServerRow, openSession } from "./servers";
import { type SshSession, sh } from "./ssh";

/*
 * Qaytarib bo'lmaydigan amallar (ADR 0058) — faqat super admin, ishchi jarayonda:
 *  - bazani o'chirish: ishlab turgan (savatda bo'lmagan) loyiha ishlatadigan baza va loyihasi bor umumiy baza rad etiladi;
 *  - savatdagi loyihani butunlay o'chirish: serverda nginx sayti, ilova ro'yxati / alohida ilova va ma'lumotlar
 *    (alohida baza — butunlay, umumiy bazadan — faqat shu mijoz qatorlari), keyin paneldan loyiha va uning sirlari.
 * Server bosqichi yiqilsa loyiha savatda qoladi (qayta urinish mumkin) — panel va server bir-biridan uzilib qolmaydi.
 */

type Result = { ok: true; detail?: string } | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
const INSTANCE_RE = /^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;

const lastLine = (s: string, code: number) => s.trim().split("\n").pop() || `Kod ${code}`;

async function run(session: SshSession, command: string, timeoutMs = 120_000): Promise<string> {
  const out = await session.exec(`bash -lc ${sh(command)}`, { timeoutMs });
  if (out.code !== 0) throw new Error(lastLine(out.stderr, out.code));
  return out.stdout;
}

/** Faylni vaqtinchalik nusxa orqali almashtiradi (ilova yarim yozilgan faylni o'qimasin) */
async function replaceFile(session: SshSession, file: string, content: string) {
  await session.writeFile(`${file}.tmp`, content, 0o600);
  await run(session, `chmod 600 ${sh(`${file}.tmp`)} && mv -f ${sh(`${file}.tmp`)} ${sh(file)}`);
}

/** Bazani va shu nomdagi rolni o'chiradi; server sirlaridagi paroli ham o'chadi */
export async function dropDatabase(db: PanelDb, server: ServerRow, name: string): Promise<Result> {
  if (!DB_NAME_RE.test(name) || SYSTEM_DATABASES.has(name)) return { ok: false, error: "Baza nomi noto'g'ri" };
  const users = await db
    .select({
      slug: projects.slug,
      templateKey: projects.templateKey,
      dbStrategy: projects.dbStrategy,
      deletedAt: projects.deletedAt,
    })
    .from(projects)
    .where(eq(projects.serverId, server.id));
  const mine = users.filter((p) => dbNameFor(p.templateKey, p.slug, p.dbStrategy) === name);
  if (mine.some((p) => !p.deletedAt)) return { ok: false, error: "Bazani ishlab turgan loyiha ishlatadi" };
  // Umumiy bazada boshqa mijozlar bo'lishi mumkin — savatdagisi bo'lsa ham loyihani o'chirish orqali tozalanadi
  if (mine.some((p) => p.dbStrategy === "shared_db")) {
    return { ok: false, error: "Umumiy bazani o'chirib bo'lmaydi: avval undagi loyihalarni o'chiring" };
  }
  let session;
  try {
    session = await openSession(db, server);
    const list = parseDbList(await run(session, DB_LIST_COMMAND, 20_000));
    if (!list.some((d) => d.name === name)) return { ok: false, error: "Bunday baza serverda yo'q" };
    await run(session, `sudo -n /usr/local/sbin/ventura-db drop ${name}`);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    session?.close();
  }
  await db
    .delete(secrets)
    .where(and(eq(secrets.ownerType, "server"), eq(secrets.ownerId, server.id), eq(secrets.name, `db:${name}`)));
  return { ok: true };
}

/**
 * Savatdagi loyihani butunlay o'chiradi. Server bo'lmasa (hech qachon deploy qilinmagan) — faqat paneldan.
 * Tartib: nginx (manzil darhol yopiladi) → ilova → ma'lumotlar → panel.
 */
export async function purgeProject(db: PanelDb, server: ServerRow | null, projectId: string): Promise<Result> {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNotNull(projects.deletedAt)));
  if (!p) return { ok: false, error: "Loyiha savatda emas yoki topilmadi" };
  if (!SLUG_RE.test(p.slug)) return { ok: false, error: "Loyiha nomi noto'g'ri" };

  const steps: string[] = [];
  if (server && p.serverId === server.id) {
    const dedicated = p.mode === "dedicated";
    const appName = instanceName(p.templateKey, p.slug, dedicated);
    if (!INSTANCE_RE.test(appName)) return { ok: false, error: "Ilova nomi noto'g'ri" };
    const dbName = dbNameFor(p.templateKey, p.slug, p.dbStrategy);
    if (!DB_NAME_RE.test(dbName)) return { ok: false, error: "Baza nomi noto'g'ri" };
    let session;
    try {
      session = await openSession(db, server);
      // 1. Manzil: nginx sayti (bo'lmasa ham xato emas)
      await run(session, `sudo -n /usr/local/sbin/ventura-site remove ${sh(p.slug)} || true`);
      steps.push("nginx");

      // 2. Ilova
      if (dedicated) {
        await run(session, `(pm2 delete ${sh(appName)} || true) && pm2 save`);
        await run(session, `rm -rf -- ${sh(`${server.deployRoot}/${appName}`)}`);
        await db.delete(apps).where(and(eq(apps.serverId, server.id), eq(apps.name, appName)));
        steps.push("alohida ilova");
      } else {
        const dir = `${server.deployRoot}/${p.templateKey}/shared`;
        const registryText = (await run(session, `cat ${sh(`${dir}/tenants.json`)} 2>/dev/null || true`)).trim();
        if (registryText) {
          const registry = parseRegistry(registryText);
          if (registry.tenants.some((t) => t.slug === p.slug)) {
            await replaceFile(
              session,
              `${dir}/tenants.json`,
              `${JSON.stringify(removeTenant(registry, p.slug), null, 2)}\n`,
            );
          }
        }
        const secretsText = (await run(session, `cat ${sh(`${dir}/tenant-secrets.json`)} 2>/dev/null || true`)).trim();
        if (secretsText) {
          const sec = parseSecrets(secretsText);
          if (sec.tenants[p.slug]) {
            delete sec.tenants[p.slug];
            await replaceFile(session, `${dir}/tenant-secrets.json`, `${JSON.stringify(sec, null, 2)}\n`);
          }
        }
        steps.push("umumiy ilova ro'yxati");
      }

      // 3. Ma'lumotlar
      const list = parseDbList(await run(session, DB_LIST_COMMAND, 20_000));
      if (list.some((d) => d.name === dbName)) {
        if (p.dbStrategy === "shared_db") {
          await run(session, `sudo -n /usr/local/sbin/ventura-db purge ${dbName} ${sh(p.slug)}`, 300_000);
          steps.push(`${dbName}: mijoz qatorlari`);
        } else {
          await run(session, `sudo -n /usr/local/sbin/ventura-db drop ${dbName}`);
          steps.push(`${dbName}: baza`);
        }
      }
    } catch (e) {
      return { ok: false, error: `${steps.length ? `${steps.join(", ")} tozalandi; ` : ""}${(e as Error).message}` };
    } finally {
      session?.close();
    }
  }

  // 4. Panel: loyiha (domenlar, bo'limlar, deploylar — cascade) va uning sirlari
  await db.delete(projects).where(and(eq(projects.id, p.id), isNotNull(projects.deletedAt)));
  await deleteSecrets(db, { type: "project", id: p.id });
  steps.push("panel");
  return { ok: true, detail: steps.join(", ") };
}

/** Panel uchun: savatdagi loyiha qaysi serverda (yo'q bo'lsa — darhol paneldan o'chiriladi) */
export async function trashedProject(db: PanelDb, projectId: string) {
  const [p] = await db
    .select({ id: projects.id, name: projects.name, slug: projects.slug, serverId: projects.serverId })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNotNull(projects.deletedAt)));
  return p ?? null;
}

/** Ishlab turgan loyihalar (savatda emas) — bazani o'chirish oldidan panel tekshiruvi uchun */
export async function activeProjectsOn(db: PanelDb, serverId: string) {
  return db
    .select({ slug: projects.slug, templateKey: projects.templateKey, dbStrategy: projects.dbStrategy })
    .from(projects)
    .where(and(eq(projects.serverId, serverId), isNull(projects.deletedAt)));
}
