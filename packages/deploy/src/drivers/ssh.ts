import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { and, asc, eq, isNull, max, ne } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { apps, domains, projectFeatures, projects, servers, templates } from "@ventura/db/schema/panel";
import { readSecret, putSecret } from "@ventura/security";
import { type Tenant, emptyRegistry, emptySecrets, parseRegistry, parseSecrets, upsertTenant } from "@ventura/tenants";
import { openSession } from "../servers";
import { type SshSession, sh } from "../ssh";
import { type DeployContext, type DeployDriver, StepError, type StepKey, type StepLog } from "../types";

/*
 * SSH drayveri (SPEC 6: "SSH drayveri: bitta deploy qadamlari"), `shared` rejim: serverda shablonning bitta
 * ilovasi ishlaydi va shu serverdagi hamma mijozga xizmat qiladi; mijoz domen bo'yicha aniqlanadi.
 *
 * Buyruqlar faqat shu fayldagi qoliplardan tuziladi. O'zgaruvchi qismlar (slug, port, yo'l, commit) avval
 * qat'iy tekshiriladi va har doim `sh()` bilan qo'shtirnoqlanadi; foydalanuvchi matni buyruqqa qo'shilmaydi.
 */

const run = promisify(execFile);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const APP_PATH_RE = /^apps\/[a-z0-9][a-z0-9-]*$/;
const ROOT_RE = /^\/[A-Za-z0-9._/-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const RELEASE_RE = /^\d{14}-[0-9a-f]{7}$/;
const DB_NAME_RE = /^[a-z][a-z0-9_]{2,62}$/;
const DB_PASSWORD_RE = /^[A-Za-z0-9_-]{24,128}$/;
/** Shablon o'z bazasini tayyorlaydigan skript (bo'lmasa, baza qadami o'tkazib yuboriladi) */
const PROVISION_SCRIPT = "scripts/provision.ts";
const FIRST_PORT = 4100;
const KEEP_RELEASES = 5;
const MINUTE = 60_000;

export interface SshDriverDeps {
  db: PanelDb;
  /** Kod olinadigan repozitoriy (ishchi jarayon turgan joy). Aynan commit qilingan holat yuboriladi. */
  repoRoot: string;
}

interface Plan {
  session: SshSession;
  projectId: string;
  serverId: string;
  dbStrategy: string;
  owner: { name: string | null; phone: string | null };
  slug: string;
  appName: string;
  appPath: string;
  appId: string;
  port: number;
  /** `<deployRoot>/<appName>` */
  root: string;
  hosts: string[];
  tenant: Tenant;
  sha: string;
  /** Server allaqachon shu commit'da: kod va build qayta bajarilmaydi */
  reuse: boolean;
  release: string;
  previous: string | null;
  /** PM2 sozlamasining xeshi. Ilovaga oxirgi qo'llangani `ecosystem.applied` faylida saqlanadi */
  envHash: string;
  /** Ishlab turgan ilovaga qo'llangan sozlama bundan farq qiladi: ilova qayta yuklanishi kerak */
  envChanged: boolean;
  /** Mijoz bazasi va maxfiy sozlama shu deploy'da tayyorlandi: ilova ularni ko'rishi shart */
  provisioned: boolean;
}

function must(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new StepError(`${what} noto'g'ri: deploy to'xtatildi`);
  return value;
}

export function createSshDriver({ db, repoRoot }: SshDriverDeps): DeployDriver {
  let plan: Plan | null = null;

  /**
   * Buyruqni bajaradi: o'zi `cmd`, natijasi `out` / `err` bo'lib logga tushadi. Nol bo'lmagan kod — xato.
   * `input` — stdin (sirlar shu yo'l bilan beriladi; logga yozilmaydi).
   */
  async function remote(log: StepLog, command: string, timeoutMs = 2 * MINUTE, input?: string): Promise<string> {
    log(command, "cmd");
    const result = await plan!.session.exec(`bash -lc ${sh(command)}`, {
      timeoutMs,
      input,
      onLine: (line, stream) => log(line, stream === "err" ? "err" : "out"),
    });
    if (result.code !== 0) throw new StepError(`Buyruq ${result.code} kodi bilan tugadi`, result.code);
    return result.stdout.trim();
  }

  /** Natijasi logga yozilmaydigan yordamchi so'rov (masalan fayl o'qish). */
  async function probe(command: string): Promise<string> {
    const result = await plan!.session.exec(`bash -lc ${sh(command)}`, { timeoutMs: 30_000 });
    return result.code === 0 ? result.stdout.trim() : "";
  }

  async function prepare(ctx: DeployContext, log: StepLog) {
    const [project] = await db.select().from(projects).where(eq(projects.id, ctx.project.id)).limit(1);
    if (!project) throw new StepError("Loyiha topilmadi");
    if (project.mode !== "shared")
      throw new StepError(`"${project.mode}" rejimi hali qo'llab-quvvatlanmaydi (3-bosqich)`);
    const [template] = await db.select().from(templates).where(eq(templates.key, project.templateKey)).limit(1);
    if (!template) throw new StepError("Shablon topilmadi");

    // Server: loyihaga biriktirilgani, bo'lmasa loyiha manziliga mos (uydagi / online VPS) birinchi tayyor server
    const kind = project.target === "home" ? "home" : project.target === "vps" ? "online" : null;
    if (!kind) throw new StepError(`"${project.target}" manzili SSH orqali deploy qilinmaydi`);
    const ready = await db.select().from(servers).where(eq(servers.status, "ready")).orderBy(asc(servers.createdAt));
    const server =
      ready.find((s) => s.id === project.serverId) ??
      (project.serverId ? undefined : ready.find((s) => s.kind === kind));
    if (!server) {
      throw new StepError(
        `Tayyor ${kind === "home" ? "uydagi server" : "online VPS"} yo'q. Serverlar bo'limida server qo'shing va "Tekshirish"ni bosing.`,
      );
    }

    const slug = must(project.slug, SLUG_RE, "Loyiha nomi (slug)");
    const appName = must(template.key, SLUG_RE, "Shablon kaliti");
    const appPath = must(template.appPath, APP_PATH_RE, "Shablon papkasi");
    const root = `${must(server.deployRoot, ROOT_RE, "Server papkasi")}/${appName}`;

    // Ilova nusxasi: shu serverda shu shablon uchun bitta; porti birinchi marta ajratiladi
    let [app] = await db
      .select()
      .from(apps)
      .where(and(eq(apps.serverId, server.id), eq(apps.name, appName)))
      .limit(1);
    if (!app) {
      const [last] = await db
        .select({ port: max(apps.port) })
        .from(apps)
        .where(eq(apps.serverId, server.id));
      [app] = await db
        .insert(apps)
        .values({
          serverId: server.id,
          templateKey: template.key,
          name: appName,
          port: (last?.port ?? FIRST_PORT - 1) + 1,
        })
        .returning();
    }
    if (!project.serverId) await db.update(projects).set({ serverId: server.id }).where(eq(projects.id, project.id));

    const [domainRows, featureRows] = await Promise.all([
      db.select({ hostname: domains.hostname }).from(domains).where(eq(domains.projectId, project.id)),
      db
        .select({ key: projectFeatures.featureKey })
        .from(projectFeatures)
        .where(and(eq(projectFeatures.projectId, project.id), eq(projectFeatures.enabled, true))),
    ]);
    const hosts = [...new Set(domainRows.map((d) => d.hostname.toLowerCase()))];
    // Uydagi serverda sinash uchun: brauzer `<slug>.localhost` ni shu kompyuterga yo'naltiradi
    if (server.kind === "home") hosts.push(`${slug}.localhost`);
    if (!hosts.length) throw new StepError("Loyihada domen yo'q");
    for (const host of hosts) must(host, HOST_RE, "Domen");

    const { stdout } = await run("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
    const sha = must(stdout.trim(), SHA_RE, "Commit");

    log(`Server: ${server.name} (${server.sshUser}@${server.host}:${server.sshPort})`, "info");
    const session = await openSession(db, server);
    plan = {
      session,
      projectId: project.id,
      serverId: server.id,
      dbStrategy: project.dbStrategy,
      owner: { name: project.ownerName, phone: project.ownerPhone },
      slug,
      appName,
      appPath,
      appId: app!.id,
      port: app!.port,
      root,
      hosts,
      tenant: {
        slug,
        name: project.name,
        hosts,
        brand: project.brand,
        features: featureRows.map((f) => f.key).sort(),
      },
      sha,
      reuse: false,
      release: "",
      previous: null,
      envHash: "",
      envChanged: false,
      provisioned: false,
    };

    await remote(log, `mkdir -p ${sh(`${root}/releases`)} ${sh(`${root}/shared`)}`);
    const current = await probe(`readlink -f ${sh(`${root}/current`)}`);
    const deployed = await probe(`cat ${sh(`${root}/current/.ventura-commit`)}`);
    plan.previous = current.startsWith(`${root}/releases/`) ? current : null;
    if (plan.previous && deployed === sha) {
      plan.reuse = true;
      plan.release = plan.previous;
      log(`Server allaqachon shu versiyada (${sha.slice(0, 7)}): kod va build qayta bajarilmaydi.`, "info");
    } else {
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
      plan.release = `${root}/releases/${stamp}-${sha.slice(0, 7)}`;
      log(`Yangi reliz: ${plan.release}`, "info");
    }
    return { releasePath: plan.release, commitSha: sha };
  }

  async function fetch(log: StepLog) {
    const p = plan!;
    if (p.reuse) return void log("O'tkazib yuborildi: kod serverda bor.", "info");
    // Aynan commit qilingan holat arxivlanadi (ishchi papkadagi saqlanmagan o'zgarishlar kirmaydi)
    log(`git archive ${p.sha.slice(0, 7)} (mahalliy)`, "cmd");
    const { stdout: archive } = await run("git", ["archive", "--format=tar.gz", p.sha], {
      cwd: repoRoot,
      encoding: "buffer",
      maxBuffer: 200 * 1024 * 1024,
    });
    log(`Arxiv: ${(archive.length / 1024).toFixed(0)} KB — serverga yuborilmoqda`, "info");
    const tarball = `${p.release}.tar.gz`;
    await p.session.writeFile(tarball, archive, 0o600);
    await remote(
      log,
      `mkdir -p ${sh(p.release)} && tar -xzf ${sh(tarball)} -C ${sh(p.release)} && rm -f ${sh(tarball)} && printf %s ${sh(p.sha)} > ${sh(`${p.release}/.ventura-commit`)}`,
    );
  }

  async function env(log: StepLog) {
    const p = plan!;
    const file = `${p.root}/shared/tenants.json`;
    const existing = await probe(`cat ${sh(file)}`);
    let registry = emptyRegistry();
    if (existing) {
      try {
        registry = parseRegistry(existing);
      } catch {
        throw new StepError("Serverdagi mijozlar ro'yxati (tenants.json) buzilgan — qo'lda tekshirish kerak");
      }
    }
    registry = upsertTenant(registry, p.tenant);
    // Avval vaqtinchalik faylga, keyin almashtirish: ilova hech qachon yarim yozilgan faylni o'qimaydi
    await p.session.writeFile(`${file}.tmp`, `${JSON.stringify(registry, null, 2)}\n`, 0o600);
    await remote(log, `mv -f ${sh(`${file}.tmp`)} ${sh(file)}`);
    log(
      `Mijozlar ro'yxati yangilandi: ${registry.tenants.length} ta mijoz, shu loyiha — ${p.hosts.join(", ")}`,
      "info",
    );

    const ecosystem = {
      apps: [
        {
          name: p.appName,
          cwd: `${p.root}/current/${p.appPath}`,
          script: "node_modules/next/dist/bin/next",
          args: ["start", "-p", String(p.port), "-H", "127.0.0.1"],
          env: {
            NODE_ENV: "production",
            NEXT_TELEMETRY_DISABLED: "1",
            VENTURA_TENANTS_FILE: file,
            VENTURA_TENANT_SECRETS_FILE: `${p.root}/shared/tenant-secrets.json`,
            VENTURA_COMMIT_FILE: `${p.root}/current/.ventura-commit`,
          },
          max_memory_restart: "512M",
          time: true,
        },
      ],
    };
    const ecosystemFile = `${p.root}/shared/ecosystem.config.cjs`;
    const content = `// Ventura boshqaradi — qo'lda o'zgartirmang\nmodule.exports = ${JSON.stringify(ecosystem, null, 2)};\n`;
    p.envHash = createHash("sha256").update(content).digest("hex");
    // Fayl bilan emas, ilovaga qo'llangan sozlama bilan solishtiriladi: fayl yangilanib, ilova qayta yuklanmay
    // qolgan bo'lsa (oldingi deploy shu yerda to'xtagan) ham keyingi deploy buni sezadi
    p.envChanged = (await probe(`cat ${sh(`${p.root}/shared/ecosystem.applied`)}`)) !== p.envHash;
    await p.session.writeFile(ecosystemFile, content, 0o600);
    log(`PM2 sozlamasi yozildi: ${p.appName} → 127.0.0.1:${p.port}`, "info");
  }

  async function build(log: StepLog) {
    const p = plan!;
    if (p.reuse) return void log("O'tkazib yuborildi: shu versiya allaqachon yig'ilgan.", "info");
    const filter = sh(`{${p.appPath}}...`);
    await remote(log, `cd ${sh(p.release)} && pnpm install --frozen-lockfile --filter ${filter}`, 15 * MINUTE);
    await remote(
      log,
      `cd ${sh(p.release)} && NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 pnpm --filter ${sh(`{${p.appPath}}`)} build`,
      15 * MINUTE,
    );
  }

  const pm2Reload = (p: Plan) =>
    `pm2 startOrReload ${sh(`${p.root}/shared/ecosystem.config.cjs`)} --update-env && pm2 save && printf %s ${sh(p.envHash)} > ${sh(`${p.root}/shared/ecosystem.applied`)}`;
  const pointCurrent = (p: Plan, target: string) =>
    `ln -sfn ${sh(target)} ${sh(`${p.root}/current.new`)} && mv -Tf ${sh(`${p.root}/current.new`)} ${sh(`${p.root}/current`)}`;

  async function release(log: StepLog) {
    const p = plan!;
    if (p.reuse) {
      if (p.envChanged) {
        // Masalan yangi muhit o'zgaruvchisi qo'shilgan: ishlab turgan jarayon uni o'zi ko'rmaydi
        log("PM2 sozlamasi o'zgardi — ilova yangi muhit bilan qayta yuklanadi.", "info");
        await remote(log, pm2Reload(p));
        return;
      }
      // Ilova ishlab turgan bo'lsa tegilmaydi: yangi mijozni u ro'yxat faylidan o'zi o'qiydi
      await remote(log, `pm2 describe ${sh(p.appName)} >/dev/null 2>&1 || (${pm2Reload(p)})`);
      return;
    }
    await remote(log, `${pointCurrent(p, p.release)} && ${pm2Reload(p)}`);
  }

  async function health(log: StepLog) {
    const p = plan!;
    const out = await remote(
      log,
      `curl -fsS --retry 20 --retry-delay 1 --retry-connrefused --max-time 5 -H ${sh(`Host: ${p.hosts[0]}`)} ${sh(`http://127.0.0.1:${p.port}/health`)}`,
      MINUTE,
    );
    let body: { ok?: boolean; tenant?: string | null; commit?: string | null; configured?: boolean };
    try {
      body = JSON.parse(out);
    } catch {
      throw new StepError("Ilova kutilmagan javob qaytardi");
    }
    if (body.tenant !== p.slug) throw new StepError(`Ilova bu domenni "${p.slug}" deb tanimadi`);
    if (body.commit !== p.sha) throw new StepError("Ilova eski versiyada ishlayapti");
    if (p.provisioned && body.configured !== true) {
      throw new StepError("Ilova mijozning baza sozlamasini ko'rmayapti (VENTURA_TENANT_SECRETS_FILE)");
    }
  }

  async function route(log: StepLog) {
    const p = plan!;
    await remote(log, `sudo -n /usr/local/sbin/ventura-site set ${sh(p.slug)} ${sh(p.port)} ${sh(p.hosts.join(","))}`);
    // nginx qayta yuklanishi bir zumda emas, shuning uchun bir necha marta uriniladi
    for (const host of p.hosts) {
      await remote(
        log,
        `curl -fsS -o /dev/null --retry 15 --retry-delay 1 --retry-all-errors --max-time 5 -H ${sh(`Host: ${host}`)} http://127.0.0.1/health`,
        MINUTE,
      );
    }
    log(`Manzillar ulandi: ${p.hosts.map((h) => `http://${h}`).join(", ")}`, "info");
  }

  /** Panel sirlaridan o'qiydi; bo'lmasa yaratib saqlaydi (keyingi deploylarda o'sha qiymat). */
  async function ensureSecret(owner: { type: string; id: string }, name: string): Promise<string> {
    const existing = await readSecret(db, owner, name);
    if (existing) return existing;
    const value = randomBytes(32).toString("base64url");
    await putSecret(db, owner, name, value);
    return value;
  }

  /**
   * Mijoz bazasi (SPEC 4, ADR 0007): serverda baza va uning roli (`ventura-db`), migratsiyalar va birinchi direktor
   * (shablonning `scripts/provision.ts`), keyin ilova uchun maxfiy fayl. Sirlar faqat stdin va SFTP orqali.
   */
  async function migrate(log: StepLog) {
    const p = plan!;
    const appDir = `${p.release}/${p.appPath}`;
    if (!(await probe(`test -f ${sh(`${appDir}/${PROVISION_SCRIPT}`)} && echo bor`))) {
      return void log("Shablonda mijoz bazasi yo'q — o'tkazib yuborildi.", "info");
    }
    if (p.dbStrategy === "dedicated_server") {
      throw new StepError("Alohida baza serveri (dedicated_server) hali qo'llab-quvvatlanmaydi (3-bosqich)");
    }
    const { shared, dbName, passwordOwner, passwordName } = dbFor(p.dbStrategy, p.slug, p.projectId);

    const helper = await p.session.exec(`bash -lc ${sh("sudo -n /usr/local/sbin/ventura-db check")}`, {
      timeoutMs: 30_000,
    });
    if (helper.code !== 0) {
      throw new StepError(
        "Serverda ventura-db yordamchisi yo'q: serverda setup.sh ni qayta ishga tushiring (yangi versiyasi bazani ham tayyorlaydi)",
      );
    }

    // Umumiy baza — server sirlari ichida (shu serverdagi hamma mijoz bitta baza); alohida baza — loyiha sirlari ichida
    const dbPassword = await ensureSecret(passwordOwner, passwordName);
    must(dbPassword, DB_PASSWORD_RE, "Baza paroli");
    await remote(
      log,
      `sudo -n /usr/local/sbin/ventura-db ensure ${sh(dbName)} ${sh(dbName)}`,
      MINUTE,
      `${dbPassword}\n`,
    );
    log(`Baza: ${dbName} (${shared ? "umumiy baza" : "alohida baza"})`, "info");

    const project = { type: "project", id: p.projectId };
    const databaseUrl = `postgres://${dbName}:${dbPassword}@127.0.0.1:5432/${dbName}`;
    const authSecret = await ensureSecret(project, "auth_secret");
    const [ownerPassword, botToken] = await Promise.all([
      readSecret(db, project, "owner_password"),
      readSecret(db, project, "telegram_bot_token"),
    ]);
    const owner =
      p.owner.name && p.owner.phone && ownerPassword
        ? { name: p.owner.name, phone: p.owner.phone, password: ownerPassword }
        : null;
    await remote(
      log,
      `cd ${sh(appDir)} && node_modules/.bin/tsx ${PROVISION_SCRIPT}`,
      5 * MINUTE,
      JSON.stringify({ slug: p.slug, name: p.tenant.name, databaseUrl, authSecret, owner }),
    );

    // Ilova uchun maxfiy fayl: boshqa mijozlar yozuvlari saqlanadi; mazmuni logga chiqmaydi
    const file = `${p.root}/shared/tenant-secrets.json`;
    const existing = await probe(`cat ${sh(file)}`);
    let secrets = emptySecrets();
    if (existing) {
      try {
        secrets = parseSecrets(existing);
      } catch {
        throw new StepError(
          "Serverdagi maxfiy sozlamalar fayli (tenant-secrets.json) buzilgan — qo'lda tekshirish kerak",
        );
      }
    }
    secrets.tenants[p.slug] = { databaseUrl, authSecret, ...(botToken ? { telegramBotToken: botToken } : {}) };
    await p.session.writeFile(`${file}.tmp`, `${JSON.stringify(secrets, null, 2)}\n`, 0o600);
    await remote(log, `chmod 600 ${sh(`${file}.tmp`)} && mv -f ${sh(`${file}.tmp`)} ${sh(file)}`);
    p.provisioned = true;
    log("Maxfiy sozlamalar yozildi: baza, sessiya kaliti, bot (qiymatlar ko'rsatilmaydi)", "info");
    if (!botToken) log("Diqqat: loyihada Telegram bot tokeni yo'q — xodimlar tizimga kira olmaydi.", "info");
    if (!owner) log("Diqqat: ega (telefon, ism, parol) to'liq emas — direktor yaratilmadi.", "info");

    // Yangi kod shu serverdagi hamma mijozga birdan tushadi (bitta ilova): ularning bazalari ham yangilanadi.
    // Biri yiqilsa deploy shu yerda to'xtaydi — reliz almashtirilmaydi, eski versiya ishlashda davom etadi.
    if (!p.reuse) await migrateOthers(log, appDir);
  }

  /** Baza nomi va paroli qayerda saqlanishi: umumiy baza — server sirlari, alohida baza — loyiha sirlari. */
  function dbFor(strategy: string, slug: string, projectId: string) {
    const p = plan!;
    const shared = strategy === "shared_db";
    const base = p.appName.replace(/-/g, "_");
    const dbName = must(shared ? `${base}_shared` : `${base}_${slug.replace(/-/g, "_")}`, DB_NAME_RE, "Baza nomi");
    return {
      shared,
      dbName,
      passwordOwner: shared ? { type: "server", id: p.serverId } : { type: "project", id: projectId },
      passwordName: shared ? `db:${dbName}` : "db_password",
    };
  }

  async function migrateOthers(log: StepLog, appDir: string) {
    const p = plan!;
    const others = await db
      .select({ id: projects.id, slug: projects.slug, name: projects.name, dbStrategy: projects.dbStrategy })
      .from(projects)
      .where(
        and(
          eq(projects.serverId, p.serverId),
          eq(projects.templateKey, p.appName),
          ne(projects.id, p.projectId),
          isNull(projects.deletedAt),
        ),
      );
    let done = 0;
    for (const other of others) {
      if (other.dbStrategy === "dedicated_server" || !SLUG_RE.test(other.slug)) continue;
      const { dbName, passwordOwner, passwordName } = dbFor(other.dbStrategy, other.slug, other.id);
      const [dbPassword, authSecret] = await Promise.all([
        readSecret(db, passwordOwner, passwordName),
        readSecret(db, { type: "project", id: other.id }, "auth_secret"),
      ]);
      // Hali deploy qilinmagan loyiha: bazasi yo'q, o'z deploy'ida yaratiladi
      if (!dbPassword || !authSecret) continue;
      log(`Mijoz bazasi yangilanmoqda: ${other.slug}`, "info");
      await remote(
        log,
        `cd ${sh(appDir)} && node_modules/.bin/tsx ${PROVISION_SCRIPT}`,
        5 * MINUTE,
        JSON.stringify({
          slug: other.slug,
          name: other.name,
          databaseUrl: `postgres://${dbName}:${dbPassword}@127.0.0.1:5432/${dbName}`,
          authSecret,
          owner: null,
        }),
      );
      done++;
    }
    if (done) log(`Shu serverdagi boshqa mijozlar bazasi ham yangilandi: ${done} ta`, "info");
  }

  async function cleanup(log: StepLog) {
    const p = plan!;
    const listing = await probe(`ls -1t ${sh(`${p.root}/releases`)}`);
    const current = p.release.split("/").pop();
    const old = listing
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => RELEASE_RE.test(name) && name !== current)
      .slice(KEEP_RELEASES - 1);
    if (!old.length) return void log(`Tozalash shart emas (oxirgi ${KEEP_RELEASES} ta reliz saqlanadi).`, "info");
    await remote(log, `rm -rf -- ${old.map((name) => sh(`${p.root}/releases/${name}`)).join(" ")}`);
  }

  const steps: Record<Exclude<StepKey, "prepare">, (log: StepLog) => Promise<void>> = {
    fetch,
    env,
    build,
    migrate,
    release,
    health,
    route,
    cleanup,
  };

  return {
    kind: "ssh",
    async run(step, ctx, log) {
      if (step === "prepare") return prepare(ctx, log);
      if (!plan) throw new StepError("Deploy rejasi tuzilmagan");
      await steps[step](log);
      // Oxirgi majburiy qadam o'tdi: ilova holati eslab qolinadi
      if (step === "route") {
        await db.update(apps).set({ commitSha: plan.sha, releasePath: plan.release }).where(eq(apps.id, plan.appId));
      }
    },
    async rollback(_ctx, log) {
      const p = plan;
      if (!p) return;
      if (p.reuse) return void log("Kod almashtirilmagan — qaytaradigan narsa yo'q.", "info");
      if (p.previous) {
        await remote(log, `${pointCurrent(p, p.previous)} && ${pm2Reload(p)}`);
      } else {
        // Birinchi deploy edi: oldingi versiya yo'q, yiqilgan ilova to'xtatiladi
        await remote(log, `pm2 delete ${sh(p.appName)} || true`);
      }
    },
    async dispose() {
      plan?.session.close();
      plan = null;
    },
  };
}
