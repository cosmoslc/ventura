import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { apps, domains, projects, templates } from "@ventura/db/schema/panel";
import { putSecret, readSecret } from "@ventura/security";
import { parseSecrets } from "@ventura/tenants";
import { DB_LIST_COMMAND, DB_NAME_RE, DB_PASSWORD_RE, dbNameFor, dbPasswordOwner, parseDbList } from "./databases";
import { instanceName } from "./drivers/ssh";
import { type ServerRow, openSession } from "./servers";
import { type SshSession, sh } from "./ssh";

/*
 * Markazni boshqa bazaga ko'chirish (ADR 0059): umumiy baza → alohida baza yoki aksincha. Ishchi jarayonda, faqat
 * super admin navbatga qo'yadi. Tartib:
 *   1. maqsad baza (rol, parol) va uning sxemasi (shablonning provision skripti, direktorsiz);
 *   2. sayt vaqtincha yopiladi (nginx) — ko'chirish paytida yozuv yo'qolmasin;
 *   3. `ventura-db copy-tenant` — bitta tranzaksiya, har jadvalda soni tekshiriladi;
 *   4. ilova yangi bazaga ulanadi (tenant-secrets.json), panelda loyiha baza turi o'zgaradi;
 *   5. sayt qayta ochiladi; manbadagi eski ma'lumot tozalanadi (umumiy — shu mijoz qatorlari, alohida — baza).
 * 2–4 da xato bo'lsa sayt qayta ochiladi, ilova eski bazada qoladi, manbaga tegilmaydi.
 */

type Result = { ok: true; detail: string } | { ok: false; error: string };

const HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const APP_PATH_RE = /^apps\/[a-z0-9][a-z0-9-]*$/;
const INSTANCE_RE = /^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;

async function run(session: SshSession, command: string, timeoutMs = 120_000, input?: string): Promise<string> {
  const out = await session.exec(`bash -lc ${sh(command)}`, { timeoutMs, input });
  if (out.code !== 0) throw new Error(out.stderr.trim().split("\n").pop() || `Kod ${out.code}`);
  return out.stdout;
}

async function passwordFor(db: PanelDb, owner: { type: string; id: string }, name: string): Promise<string> {
  const existing = await readSecret(db, owner, name);
  if (existing) return existing;
  const value = randomBytes(32).toString("base64url");
  await putSecret(db, owner, name, value);
  return value;
}

export async function moveProjectDb(
  db: PanelDb,
  server: ServerRow,
  projectId: string,
  target: "own" | "shared",
): Promise<Result> {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
  if (!p || p.serverId !== server.id) return { ok: false, error: "Loyiha bu serverda emas" };
  const from = p.dbStrategy;
  if ((target === "shared") === (from === "shared_db"))
    return { ok: false, error: "Loyiha allaqachon shu turdagi bazada" };
  const [tpl] = await db.select().from(templates).where(eq(templates.key, p.templateKey));
  if (!tpl || !APP_PATH_RE.test(tpl.appPath)) return { ok: false, error: "Shablon topilmadi" };

  const nextStrategy = target === "shared" ? "shared_db" : "db_per_tenant";
  const src = dbNameFor(p.templateKey, p.slug, from);
  const dst = dbNameFor(p.templateKey, p.slug, nextStrategy);
  if (!DB_NAME_RE.test(src) || !DB_NAME_RE.test(dst)) return { ok: false, error: "Baza nomi noto'g'ri" };
  const appName = instanceName(p.templateKey, p.slug, p.mode === "dedicated");
  if (!INSTANCE_RE.test(appName)) return { ok: false, error: "Ilova nomi noto'g'ri" };
  const root = `${server.deployRoot}/${appName}`;
  const secretsFile = `${root}/shared/tenant-secrets.json`;

  const [app] = await db
    .select({ port: apps.port })
    .from(apps)
    .where(and(eq(apps.serverId, server.id), eq(apps.name, appName)));
  if (!app) return { ok: false, error: "Ilova serverda topilmadi — avval deploy qiling" };
  const hosts = [
    ...new Set(
      (await db.select({ hostname: domains.hostname }).from(domains).where(eq(domains.projectId, p.id))).map((d) =>
        d.hostname.toLowerCase(),
      ),
    ),
  ];
  if (server.kind === "home") hosts.push(`${p.slug}.localhost`);
  if (!hosts.length || hosts.some((h) => !HOST_RE.test(h))) return { ok: false, error: "Loyiha domenlari noto'g'ri" };

  const pw = dbPasswordOwner(target === "shared" ? "shared" : "project", { serverId: server.id, projectId: p.id }, dst);
  const password = await passwordFor(db, pw.owner, pw.name);
  if (!DB_PASSWORD_RE.test(password)) return { ok: false, error: "Baza paroli noto'g'ri" };
  const dstUrl = `postgres://${dst}:${password}@127.0.0.1:5432/${dst}`;
  const authSecret = await readSecret(db, { type: "project", id: p.id }, "auth_secret");
  if (!authSecret) return { ok: false, error: "Loyiha sessiya kaliti yo'q — avval deploy qiling" };

  const siteOn = () =>
    `sudo -n /usr/local/sbin/ventura-site set ${sh(p.slug)} ${sh(String(app.port))} ${sh(hosts.join(","))}`;
  let session;
  let siteClosed = false;
  try {
    session = await openSession(db, server);
    const list = parseDbList(await run(session, DB_LIST_COMMAND, 20_000));
    if (!list.some((d) => d.name === src)) return { ok: false, error: `Manba baza (${src}) serverda yo'q` };
    // Alohida bazaga: shu nomdagi baza bo'lsa (qoldiq) — xavfsizlik uchun to'xtatamiz
    if (target === "own" && list.some((d) => d.name === dst)) {
      return { ok: false, error: `${dst} bazasi serverda allaqachon bor — avval uni tekshiring yoki o'chiring` };
    }

    // 1. Maqsad baza va sxema (provision: migratsiyalar; direktor yaratilmaydi — owner null)
    await run(session, `sudo -n /usr/local/sbin/ventura-db ensure ${dst} ${dst}`, 60_000, `${password}\n`);
    const appDir = `${root}/current/${tpl.appPath}`;
    await run(
      session,
      `cd ${sh(appDir)} && node_modules/.bin/tsx scripts/provision.ts`,
      5 * 60_000,
      JSON.stringify({ slug: p.slug, name: p.name, databaseUrl: dstUrl, authSecret, owner: null }),
    );

    // 2. Sayt yopiladi
    await run(session, `sudo -n /usr/local/sbin/ventura-site remove ${sh(p.slug)}`);
    siteClosed = true;

    // 3. Nusxa (bitta tranzaksiya, sonlar tekshiriladi)
    const copied = (
      await run(session, `sudo -n /usr/local/sbin/ventura-db copy-tenant ${src} ${dst} ${sh(p.slug)}`, 30 * 60_000)
    ).trim();

    // 4. Ilova yangi bazaga: tenant-secrets.json (ilova faylni o'zi qayta o'qiydi)
    const secretsText = (await run(session, `cat ${sh(secretsFile)}`)).trim();
    const secrets = parseSecrets(secretsText);
    const entry = secrets.tenants[p.slug];
    if (!entry) throw new Error("Ilovaning maxfiy sozlamasida bu mijoz yo'q");
    secrets.tenants[p.slug] = { ...entry, databaseUrl: dstUrl };
    await session.writeFile(`${secretsFile}.tmp`, `${JSON.stringify(secrets, null, 2)}\n`, 0o600);
    await run(session, `chmod 600 ${sh(`${secretsFile}.tmp`)} && mv -f ${sh(`${secretsFile}.tmp`)} ${sh(secretsFile)}`);
    await db.update(projects).set({ dbStrategy: nextStrategy }).where(eq(projects.id, p.id));

    // 5. Sayt qayta ochiladi, keyin manba tozalanadi
    await run(session, siteOn());
    siteClosed = false;
    let cleanup = "";
    try {
      if (from === "shared_db") {
        await run(session, `sudo -n /usr/local/sbin/ventura-db purge ${src} ${sh(p.slug)}`, 300_000);
        cleanup = `${src} dan eski qatorlar tozalandi`;
      } else {
        await run(session, `sudo -n /usr/local/sbin/ventura-db drop ${src}`);
        cleanup = `${src} o'chirildi`;
      }
    } catch (e) {
      cleanup = `eski ma'lumotni tozalab bo'lmadi (qo'lda): ${(e as Error).message}`;
    }
    return { ok: true, detail: `${src} → ${dst}; ${copied}; ${cleanup}` };
  } catch (e) {
    // Ilova eski bazada qoldi — sayt qayta ochiladi
    if (siteClosed && session) await run(session, siteOn()).catch(() => {});
    return { ok: false, error: (e as Error).message };
  } finally {
    session?.close();
  }
}
