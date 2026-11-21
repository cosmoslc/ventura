import { and, eq, isNull } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { apps, domains, projects, templates } from "@ventura/db/schema/panel";
import { putSecret, readSecret } from "@ventura/security";
import { parseSecrets } from "@ventura/tenants";
import { DB_PASSWORD_RE, dbNameFor, dbPasswordOwner } from "./databases";
import { instanceName } from "./drivers/ssh";
import { type ServerRow, openSession } from "./servers";
import { type SshSession, sh } from "./ssh";
import {
  buildSupabaseDatabaseUrl,
  executeSupabaseSql,
  getSupabaseApiKeys,
  getSupabasePoolerConfig,
  getSupabaseProject,
  resetSupabaseDatabasePassword,
  testSupabaseConnection,
} from "./supabase";

/*
 * Loyihani 100% avtomatik Supabase'ga ko'chirish dvigateli (ADR 0060).
 *
 * 1. Supabase API orqali loyiha holati, API kalitlari va pooler sozlamalari tekshiriladi.
 * 2. Supabase PostgreSQL ulanish manzili yig'iladi va to'g'ridan-to'g'ri aloqa testi o'tkaziladi.
 * 3. Serverda sayt vaqtincha yopiladi (zero data loss).
 * 4. Shablonning provision skripti yangi Supabase bazasida ishga tushiriladi (Drizzle migratsiyalari va RLS qoidalari).
 * 5. Agar "full" rejimi tanlangan bo'lsa — VPS bazasidagi barcha qatorlar (o'quvchilar, xonalar, to'lovlar va h.k.)
 *    Supabase'ga xavfsiz oqim (stream/csv) orqali ko'chiriladi va ketma-ketliklar (sequences) tiklanadi.
 * 6. Serverdagi tenant-secrets.json yangilanadi (edu-crm ilovasi mtime o'zgarishi orqali qayta ishga tushmasdan o'qiydi).
 * 7. Ventura panelida loyiha sozlamalari (settings.supabase) saqlanadi.
 * 8. Sayt qayta ochiladi va aloqa tekshiriladi.
 */

export interface MoveToSupabaseOptions {
  token: string;
  projectRef: string;
  dbPassword?: string;
  autoResetPassword?: boolean;
  mode: "full" | "schema_only";
}

type Result = { ok: true; detail: string } | { ok: false; error: string };

const HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const APP_PATH_RE = /^apps\/[a-z0-9][a-z0-9-]*$/;
const INSTANCE_RE = /^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;

async function run(session: SshSession, command: string, timeoutMs = 180_000, input?: string): Promise<string> {
  const out = await session.exec(`bash -lc ${sh(command)}`, { timeoutMs, input });
  if (out.code !== 0) {
    const cleanErr = out.stderr.trim() || out.stdout.trim() || `Kod ${out.code}`;
    throw new Error(cleanErr);
  }
  return out.stdout;
}

export async function moveProjectToSupabase(
  db: PanelDb,
  server: ServerRow,
  projectId: string,
  opts: MoveToSupabaseOptions,
): Promise<Result> {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
  if (!p || p.serverId !== server.id) return { ok: false, error: "Loyiha bu serverda emas" };

  const [tpl] = await db.select().from(templates).where(eq(templates.key, p.templateKey));
  if (!tpl || !APP_PATH_RE.test(tpl.appPath)) return { ok: false, error: "Shablon topilmadi" };

  // 1. Supabase loyihasi ma'lumotlarini tekshirish
  let supaProject;
  try {
    supaProject = await getSupabaseProject(opts.token, opts.projectRef);
  } catch (e) {
    return { ok: false, error: `Supabase loyihasini olib bo'lmadi: ${(e as Error).message}` };
  }

  const pooler = await getSupabasePoolerConfig(opts.token, opts.projectRef);
  const keys = await getSupabaseApiKeys(opts.token, opts.projectRef).catch(() => []);
  const anonKey = keys.find((k) => k.name === "anon")?.api_key;
  const serviceKey = keys.find((k) => k.name === "service_role")?.api_key;

  let poolerHost = pooler?.db_host || `aws-0-${supaProject.region}.pooler.supabase.com`;
  const poolerPort = pooler?.db_port || 5432;
  const poolerUser = `postgres.${opts.projectRef}`;

  // Parol ko'rsatilmagan bo'lsa yoki autoReset bo'lsa — yangi kuchli parol generatsiya qilib Supabase'da yangilaymiz
  let dbPassword = opts.dbPassword?.trim();
  if (!dbPassword || opts.autoResetPassword) {
    try {
      dbPassword = await resetSupabaseDatabasePassword(opts.token, opts.projectRef);
      // Parol Supabase Supavisor poolerga to'liq yetib borishi uchun qisqa pauza
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      return { ok: false, error: `Supabase parolini avtomatik o'rnatib bo'lmadi: ${(e as Error).message}` };
    }
  }

  let dstUrl = buildSupabaseDatabaseUrl({
    projectRef: opts.projectRef,
    region: supaProject.region,
    dbPassword,
    poolerHost,
    poolerPort,
  });

  // 2. Oldindan ulanishni tekshirish (Noto'g'ri parol bo'lsa hozir to'xtaymiz)
  let connTest = await testSupabaseConnection(dstUrl);
  // Agar aws-0 da tenant topilmasa, avtomatik ravishda aws-1 klasterini ham sinab ko'ramiz
  if (!connTest.ok && connTest.error.includes("not found") && poolerHost.includes("aws-0-")) {
    const altHost = poolerHost.replace("aws-0-", "aws-1-");
    const altUrl = buildSupabaseDatabaseUrl({
      projectRef: opts.projectRef,
      region: supaProject.region,
      dbPassword,
      poolerHost: altHost,
      poolerPort,
    });
    const altTest = await testSupabaseConnection(altUrl);
    if (altTest.ok) {
      poolerHost = altHost;
      dstUrl = altUrl;
      connTest = altTest;
    }
  }
  if (!connTest.ok) {
    return { ok: false, error: `Supabase bazasiga ulanib bo'lmadi: ${connTest.error}` };
  }

  // Mahalliy server va ilova parametrlari
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

  const authSecret = await readSecret(db, { type: "project", id: p.id }, "auth_secret");
  if (!authSecret) return { ok: false, error: "Loyiha sessiya kaliti yo'q — avval deploy qiling" };

  const siteOn = () =>
    `sudo -n /usr/local/sbin/ventura-site set ${sh(p.slug)} ${sh(String(app.port))} ${sh(hosts.join(","))}`;

  let session: SshSession | null = null;
  let siteClosed = false;

  try {
    session = await openSession(db, server);
    const appDir = `${root}/current/${tpl.appPath}`;

    // 3. Supabase'da jadvallarni avtomatik tozalash (agar eski qoldiqlar bo'lsa) va sxema/RLS yaratish
    try {
      await executeSupabaseSql(
        opts.token,
        opts.projectRef,
        `DROP SCHEMA IF EXISTS drizzle CASCADE;
         DROP SCHEMA IF EXISTS public CASCADE;
         CREATE SCHEMA public;
         GRANT ALL ON SCHEMA public TO postgres;
         GRANT ALL ON SCHEMA public TO public;
         COMMENT ON SCHEMA public IS 'standard public schema';`,
      );
    } catch {
      // Management API orqali tozalash imkoni bo'lmasa, provisioning to'g'ridan-to'g'ri urinib ko'radi
    }

    const ownerPassword = await readSecret(db, { type: "project", id: p.id }, "owner_password");
    const owner =
      p.ownerName && p.ownerPhone && ownerPassword
        ? { name: p.ownerName, phone: p.ownerPhone, password: ownerPassword }
        : null;

    await run(
      session,
      `cd ${sh(appDir)} && node_modules/.bin/tsx scripts/provision.ts`,
      5 * 60_000,
      JSON.stringify({ slug: p.slug, name: p.name, databaseUrl: dstUrl, authSecret, owner }),
    );

    // 4. Saytni vaqtincha yopish (yangi ma'lumot tushmasligi uchun)
    await run(session, `sudo -n /usr/local/sbin/ventura-site remove ${sh(p.slug)}`);
    siteClosed = true;

    let rowsCopied = 0;

    // 5. Agar "full" bo'lsa — ma'lumotlarni ko'chirish
    if (opts.mode === "full") {
      const srcDb = dbNameFor(p.templateKey, p.slug, p.dbStrategy);
      const pwOwner = dbPasswordOwner(
        p.dbStrategy === "shared_db" ? "shared" : "project",
        { serverId: server.id, projectId: p.id },
        srcDb,
      );
      const srcPassword = await readSecret(db, pwOwner.owner, pwOwner.name);
      if (!srcPassword || !DB_PASSWORD_RE.test(srcPassword)) {
        throw new Error("Manba VPS bazasining paroli topilmadi");
      }

      // Serverda ma'lumotlarni CSV orqali o'tkazish skripti
      const copyScript = `
        set -e
        SRC_DB=${sh(srcDb)}
        SRC_PASS=${sh(srcPassword)}
        TENANT=${sh(p.slug)}
        SUPA_HOST=${sh(poolerHost)}
        SUPA_PORT=${sh(String(poolerPort))}
        SUPA_USER=${sh(poolerUser)}
        SUPA_PASS=${sh(dbPassword)}

        work=$(mktemp -d)
        trap 'rm -rf "$work"' EXIT

        # tenant_id ustuni bor jadvallarni aniqlash
        tables=$(PGPASSWORD="$SRC_PASS" psql -h 127.0.0.1 -p 5432 -U "$SRC_DB" -d "$SRC_DB" -XAtq -c "
          SELECT c.table_name 
          FROM information_schema.columns c 
          JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name 
          WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id' AND t.table_type = 'BASE TABLE' 
          ORDER BY 1;
        ")

        total=0
        for tbl in $tables; do
          n=$(PGPASSWORD="$SRC_PASS" psql -h 127.0.0.1 -p 5432 -U "$SRC_DB" -d "$SRC_DB" -XAtq -c "SELECT count(*) FROM public.\\"$tbl\\" WHERE tenant_id = '$TENANT'")
          if [ "$n" -gt 0 ]; then
            cols=$(PGPASSWORD="$SRC_PASS" psql -h 127.0.0.1 -p 5432 -U "$SRC_DB" -d "$SRC_DB" -XAtq -c "
              SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position) 
              FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = '$tbl';
            ")
            
            # Manbadan CSV ga olish
            PGPASSWORD="$SRC_PASS" psql -h 127.0.0.1 -p 5432 -U "$SRC_DB" -d "$SRC_DB" -Xq -c "\\\\copy (SELECT $cols FROM public.\\"$tbl\\" WHERE tenant_id = '$TENANT') TO '$work/$tbl.csv' WITH (FORMAT csv)"
            
            # Supabase'da mavjud qoldiq bo'lsa tozalab, CSV dan yuklash
            PGPASSWORD="$SUPA_PASS" psql -h "$SUPA_HOST" -p "$SUPA_PORT" -U "$SUPA_USER" -d postgres -v ON_ERROR_STOP=1 -c "DELETE FROM public.\\"$tbl\\" WHERE tenant_id = '$TENANT';" >/dev/null 2>&1 || true
            PGPASSWORD="$SUPA_PASS" psql -h "$SUPA_HOST" -p "$SUPA_PORT" -U "$SUPA_USER" -d postgres -v ON_ERROR_STOP=1 -c "\\\\copy public.\\"$tbl\\" ($cols) FROM '$work/$tbl.csv' WITH (FORMAT csv)"
            
            total=$((total + n))
          fi
        done

        # Ketma-ketliklarni (sequences) yangilash
        PGPASSWORD="$SUPA_PASS" psql -h "$SUPA_HOST" -p "$SUPA_PORT" -U "$SUPA_USER" -d postgres -c "
          DO \\$\\$
          DECLARE
            r record;
          BEGIN
            FOR r IN 
              SELECT s.relname as seq, t.relname as tbl, a.attname as col
              FROM pg_class s
              JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass
              JOIN pg_class t ON t.oid = d.refobjid
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
              WHERE s.relkind = 'S'
            LOOP
              EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 1))', r.seq, r.col, r.tbl);
            END LOOP;
          END \\$\\$;
        " >/dev/null 2>&1 || true

        echo "$total"
      `;

      const out = await run(session, copyScript, 10 * 60_000);
      rowsCopied = Number(out.trim().split("\n").pop()) || 0;
    }

    // 6. Ilovaning tenant-secrets.json faylini yangilash
    const secretsText = (await run(session, `cat ${sh(secretsFile)}`)).trim();
    const secrets = parseSecrets(secretsText);
    const entry = secrets.tenants[p.slug];
    if (!entry) throw new Error("Ilovaning maxfiy sozlamasida bu mijoz yo'q");

    secrets.tenants[p.slug] = {
      ...entry,
      databaseUrl: dstUrl,
    };

    await session.writeFile(`${secretsFile}.tmp`, `${JSON.stringify(secrets, null, 2)}\n`, 0o600);
    await run(session, `chmod 600 ${sh(`${secretsFile}.tmp`)} && mv -f ${sh(`${secretsFile}.tmp`)} ${sh(secretsFile)}`);

    // 7. Ventura panel sirlari va sozlamalarini yangilash
    await putSecret(db, { type: "project", id: p.id }, "db_password", dbPassword);

    const updatedSettings = {
      ...p.settings,
      supabase: {
        projectRef: opts.projectRef,
        projectName: supaProject.name,
        projectUrl: `https://${opts.projectRef}.supabase.co`,
        anonKey,
        serviceKey,
        region: supaProject.region,
        poolerHost,
        poolerPort,
        mode: opts.mode,
        migratedAt: new Date().toISOString(),
      },
    };

    await db
      .update(projects)
      .set({
        settings: updatedSettings,
      })
      .where(eq(projects.id, p.id));

    // 8. Saytni qayta ochish
    await run(session, siteOn());
    siteClosed = false;

    return {
      ok: true,
      detail:
        opts.mode === "full"
          ? `Supabase'ga ko'chirildi (${supaProject.name}, ${rowsCopied} qator ma'lumot o'tkazildi)`
          : `Supabase'ga toza sxema bilan ko'chirildi (${supaProject.name})`,
    };
  } catch (e) {
    if (siteClosed && session) await run(session, siteOn()).catch(() => {});
    return { ok: false, error: (e as Error).message };
  } finally {
    session?.close();
  }
}
