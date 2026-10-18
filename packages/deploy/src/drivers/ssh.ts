import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { and, asc, eq, isNotNull, isNull, max, ne } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { apps, domains, projectFeatures, projects, servers, templates } from "@ventura/db/schema/panel";
import { readSecret, putSecret } from "@ventura/security";
import {
  type Tenant,
  emptyRegistry,
  emptySecrets,
  parseRegistry,
  parseSecrets,
  removeTenant,
  upsertTenant,
} from "@ventura/tenants";
import { openSession } from "../servers";
import { type SshSession, sh } from "../ssh";
import { type DeployContext, type DeployDriver, StepError, type StepKey, type StepLog } from "../types";

/*
 * SSH drayveri (SPEC 6: "SSH drayveri: bitta deploy qadamlari"). Ikki rejim (ADR 0048):
 *  - `shared`: serverda shablonning bitta ilovasi (`edu-crm`) shu serverdagi hamma mijozga xizmat qiladi;
 *    mijoz domen bo'yicha aniqlanadi;
 *  - `dedicated`: mijozga o'z ilova nusxasi (`edu-crm-<slug>`): o'z papkasi, PM2 jarayoni, porti va faqat o'zi
 *    yozilgan mijozlar ro'yxati. `dedicated_server` bazasida server butunlay shu mijozniki.
 * Baza nomi rejimga bog'liq emas (shablon + slug): rejim almashganda ma'lumot o'sha bazada qoladi.
 *
 * Buyruqlar faqat shu fayldagi qoliplardan tuziladi. O'zgaruvchi qismlar (slug, port, yo'l, commit) avval
 * qat'iy tekshiriladi va har doim `sh()` bilan qo'shtirnoqlanadi; foydalanuvchi matni buyruqqa qo'shilmaydi.
 */

const run = promisify(execFile);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
/** Ilova nusxasi nomi: `shared` — shablon kaliti, `dedicated` — `<shablon>-<slug>` */
const INSTANCE_RE = /^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;
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
/** Yiqilgan buyruqdan qizil bo'lib ko'rsatiladigan stderr qatorlari soni */
const ERR_TAIL = 20;
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
  /** Shablon kaliti (`edu-crm`): baza nomi va bir xil shablondagi boshqa mijozlar shu bo'yicha */
  templateKey: string;
  /** Ilova nusxasi: papka va PM2 jarayoni nomi (`edu-crm` yoki `edu-crm-<slug>`) */
  appName: string;
  /** `dedicated` rejim: nusxada faqat shu mijoz */
  dedicated: boolean;
  /** Serverdagi umumiy papka (`servers.deploy_root`) */
  deployRoot: string;
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

/** Ilova nusxasi nomi: shared — shablon kaliti, dedicated — `<shablon>-<slug>`. */
export function instanceName(templateKey: string, slug: string, dedicated: boolean): string {
  return dedicated ? `${templateKey}-${slug}` : templateKey;
}

/**
 * Loyiha shu serverga qo'yilishi mumkinmi (alohida server bazasi qoidasi): `null` — mumkin, aks holda sabab.
 * `neighbours` — shu loyihadan boshqa, serverga biriktirilgan loyihalar.
 */
export function serverFit(
  dbStrategy: string,
  neighbours: readonly { serverId: string | null; dbStrategy: string }[],
): (serverId: string) => string | null {
  return (serverId) => {
    const here = neighbours.filter((n) => n.serverId === serverId);
    if (here.some((n) => n.dbStrategy === "dedicated_server"))
      return "Bu server boshqa mijozga alohida server sifatida berilgan: unga loyiha qo'shib bo'lmaydi";
    if (dbStrategy === "dedicated_server" && here.length)
      return "Alohida server bazasi uchun server bo'sh bo'lishi kerak: unda boshqa loyihalar bor";
    return null;
  };
}

export function createSshDriver({ db, repoRoot }: SshDriverDeps): DeployDriver {
  let plan: Plan | null = null;

  /**
   * Buyruqni bajaradi: o'zi `cmd`, natijasi logga tushadi. Nol bo'lmagan kod — xato.
   * Ko'p dasturlar (pnpm, PM2, next) oddiy xabarni ham stderr'ga yozadi: ular bajarilish paytida oddiy qator bo'lib
   * chiqadi, buyruq yiqilgandagina stderr'ning oxirgi qatorlari qizil (`err`) bo'lib takrorlanadi.
   * `input` — stdin (sirlar shu yo'l bilan beriladi; logga yozilmaydi).
   */
  async function remote(log: StepLog, command: string, timeoutMs = 2 * MINUTE, input?: string): Promise<string> {
    log(command, "cmd");
    const stderr: string[] = [];
    const result = await plan!.session.exec(`bash -lc ${sh(command)}`, {
      timeoutMs,
      input,
      onLine: (line, stream) => {
        if (stream === "err") {
          stderr.push(line);
          if (stderr.length > ERR_TAIL) stderr.shift();
        }
        log(line, "out");
      },
    });
    if (result.code !== 0) {
      for (const line of stderr) log(line, "err");
      throw new StepError(`Buyruq ${result.code} kodi bilan tugadi`, result.code);
    }
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
    if (project.mode !== "shared" && project.mode !== "dedicated")
      throw new StepError(`"${project.mode}" rejimi qo'llab-quvvatlanmaydi`);
    const dedicated = project.mode === "dedicated";
    if (project.dbStrategy === "dedicated_server" && !dedicated)
      throw new StepError("Alohida server bazasi faqat dedicated rejimda ishlaydi");
    if (project.dbStrategy === "shared_db" && dedicated)
      throw new StepError("Umumiy baza faqat shared rejimda ishlaydi");
    const [template] = await db.select().from(templates).where(eq(templates.key, project.templateKey)).limit(1);
    if (!template) throw new StepError("Shablon topilmadi");

    // Server: loyihaga biriktirilgani, bo'lmasa loyiha manziliga mos (uydagi / online VPS) birinchi tayyor server
    const kind = project.target === "home" ? "home" : project.target === "vps" ? "online" : null;
    if (!kind) throw new StepError(`"${project.target}" manzili SSH orqali deploy qilinmaydi`);
    const ready = await db.select().from(servers).where(eq(servers.status, "ready")).orderBy(asc(servers.createdAt));
    // Alohida server bazasi: server butunlay bitta mijozniki — unda boshqa loyiha bo'lmaydi va unga boshqasi qo'shilmaydi
    const neighbours = await db
      .select({ serverId: projects.serverId, dbStrategy: projects.dbStrategy })
      .from(projects)
      .where(and(ne(projects.id, project.id), isNull(projects.deletedAt), isNotNull(projects.serverId)));
    const fit = serverFit(project.dbStrategy, neighbours);
    const where = kind === "home" ? "uydagi server" : "online VPS";
    const server =
      ready.find((s) => s.id === project.serverId) ??
      (project.serverId ? undefined : ready.find((s) => s.kind === kind && fit(s.id) === null));
    if (!server) {
      throw new StepError(
        project.dbStrategy === "dedicated_server"
          ? `Bo'sh ${where} yo'q: alohida server bazasi uchun boshqa loyihasi yo'q server kerak.`
          : `Tayyor ${where} yo'q. Serverlar bo'limida server qo'shing va "Tekshirish"ni bosing.`,
      );
    }
    const problem = fit(server.id);
    if (problem) throw new StepError(problem);

    const slug = must(project.slug, SLUG_RE, "Loyiha nomi (slug)");
    const templateKey = must(template.key, SLUG_RE, "Shablon kaliti");
    const appName = must(instanceName(templateKey, slug, dedicated), INSTANCE_RE, "Ilova nomi");
    const appPath = must(template.appPath, APP_PATH_RE, "Shablon papkasi");
    const deployRoot = must(server.deployRoot, ROOT_RE, "Server papkasi");
    const root = `${deployRoot}/${appName}`;

    // Ilova nusxasi: shared — shu serverda shu shablon uchun bitta, dedicated — loyihaga bitta; porti birinchi marta ajratiladi
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
    log(dedicated ? `Rejim: dedicated — alohida ilova ${appName}` : `Rejim: shared — umumiy ilova ${appName}`, "info");
    const session = await openSession(db, server);
    plan = {
      session,
      projectId: project.id,
      serverId: server.id,
      dbStrategy: project.dbStrategy,
      owner: { name: project.ownerName, phone: project.ownerPhone },
      slug,
      templateKey,
      appName,
      dedicated,
      deployRoot,
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
    // Alohida ilovada ro'yxat har safar noldan: unda faqat shu mijoz bo'ladi
    if (existing && !p.dedicated) {
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
    // Ilova ishga tushguncha jim kutiladi; hammasi o'tmasa oxirgi urinish xatoni ko'rsatadi
    const probe = `-H ${sh(`Host: ${p.hosts[0]}`)} ${sh(`http://127.0.0.1:${p.port}/health`)}`;
    const out = await remote(
      log,
      `curl -fs --retry 20 --retry-delay 1 --retry-connrefused --max-time 5 ${probe} || curl -fsS --max-time 5 ${probe}`,
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
      const probe = `-o /dev/null -H ${sh(`Host: ${host}`)} http://127.0.0.1/health`;
      await remote(
        log,
        `curl -fs --retry 15 --retry-delay 1 --retry-all-errors --max-time 5 ${probe} || curl -fsS --max-time 5 ${probe}`,
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
    // Alohida server bazasi ham shu serverning PostgreSQL'ida (ilova va baza bitta VPS'da); server boshqa loyihaga berilmaydi
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
    const kindLabel = shared ? "umumiy baza" : p.dbStrategy === "dedicated_server" ? "alohida server" : "alohida baza";
    log(`Baza: ${dbName} (${kindLabel})`, "info");

    const project = { type: "project", id: p.projectId };
    const databaseUrl = `postgres://${dbName}:${dbPassword}@127.0.0.1:5432/${dbName}`;
    const authSecret = await ensureSecret(project, "auth_secret");
    // Ventura SMS paketi (ADR 0056): markaz panelga imzolangan so'rov yuboradi — panel manzili va loyiha kaliti
    const panelUrl = process.env.VENTURA_PANEL_URL || process.env.BETTER_AUTH_URL || "";
    const smsRelay = /^https?:\/\//.test(panelUrl)
      ? { url: panelUrl.replace(/\/+$/, ""), key: await ensureSecret(project, "sms_relay_key") }
      : null;
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
    if (existing && !p.dedicated) {
      try {
        secrets = parseSecrets(existing);
      } catch {
        throw new StepError(
          "Serverdagi maxfiy sozlamalar fayli (tenant-secrets.json) buzilgan — qo'lda tekshirish kerak",
        );
      }
    }
    secrets.tenants[p.slug] = {
      databaseUrl,
      authSecret,
      ...(botToken ? { telegramBotToken: botToken } : {}),
      ...(smsRelay ? { smsRelay } : {}),
    };
    await p.session.writeFile(`${file}.tmp`, `${JSON.stringify(secrets, null, 2)}\n`, 0o600);
    await remote(log, `chmod 600 ${sh(`${file}.tmp`)} && mv -f ${sh(`${file}.tmp`)} ${sh(file)}`);
    p.provisioned = true;
    log("Maxfiy sozlamalar yozildi: baza, sessiya kaliti, bot (qiymatlar ko'rsatilmaydi)", "info");
    if (!botToken) log("Diqqat: loyihada Telegram bot tokeni yo'q — xodimlar tizimga kira olmaydi.", "info");
    if (!smsRelay) log("Diqqat: VENTURA_PANEL_URL berilmagan — Ventura SMS paketi bu markazda ishlamaydi.", "info");
    if (!owner) log("Diqqat: ega (telefon, ism, parol) to'liq emas — direktor yaratilmadi.", "info");

    // Yangi kod shu serverdagi hamma mijozga birdan tushadi (bitta ilova): ularning bazalari ham yangilanadi.
    // Biri yiqilsa deploy shu yerda to'xtaydi — reliz almashtirilmaydi, eski versiya ishlashda davom etadi.
    if (!p.reuse) await migrateOthers(log, appDir);
  }

  /** Baza nomi va paroli qayerda saqlanishi: umumiy baza — server sirlari, alohida baza — loyiha sirlari. */
  function dbFor(strategy: string, slug: string, projectId: string) {
    const p = plan!;
    const shared = strategy === "shared_db";
    const base = p.templateKey.replace(/-/g, "_");
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
    // Alohida ilova faqat o'z mijoziga xizmat qiladi: boshqalar o'z versiyasida qoladi
    if (p.dedicated) return;
    const others = await db
      .select({ id: projects.id, slug: projects.slug, name: projects.name, dbStrategy: projects.dbStrategy })
      .from(projects)
      .where(
        and(
          eq(projects.serverId, p.serverId),
          eq(projects.templateKey, p.templateKey),
          eq(projects.mode, "shared"),
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

  /** Faylni vaqtinchalik nusxa orqali almashtiradi: ilova hech qachon yarim yozilgan faylni o'qimaydi */
  async function replaceFile(log: StepLog, file: string, content: string) {
    await plan!.session.writeFile(`${file}.tmp`, content, 0o600);
    await remote(log, `chmod 600 ${sh(`${file}.tmp`)} && mv -f ${sh(`${file}.tmp`)} ${sh(file)}`);
  }

  /**
   * Rejim almashganda eski nusxadan chiqish (nginx allaqachon yangisiga ulangan, shuning uchun uzilish yo'q):
   *  - dedicated bo'ldi: umumiy ilova ro'yxati va maxfiy faylidan shu mijoz olib tashlanadi;
   *  - shared bo'ldi: alohida nusxaning PM2 jarayoni to'xtatiladi (papkasi joyida qoladi, logda yo'li yoziladi).
   * Xato deploy'ni yiqitmaydi: yangi versiya ishlab turibdi, faqat logga yoziladi.
   */
  async function handover(log: StepLog) {
    const p = plan!;
    try {
      if (p.dedicated) {
        const dir = `${p.deployRoot}/${p.templateKey}/shared`;
        const registryText = await probe(`cat ${sh(`${dir}/tenants.json`)}`);
        if (!registryText) return;
        const registry = parseRegistry(registryText);
        if (!registry.tenants.some((t) => t.slug === p.slug)) return;
        await replaceFile(log, `${dir}/tenants.json`, `${JSON.stringify(removeTenant(registry, p.slug), null, 2)}\n`);
        const secretsText = await probe(`cat ${sh(`${dir}/tenant-secrets.json`)}`);
        if (secretsText) {
          const secrets = parseSecrets(secretsText);
          delete secrets.tenants[p.slug];
          await replaceFile(log, `${dir}/tenant-secrets.json`, `${JSON.stringify(secrets, null, 2)}\n`);
        }
        log(`Mijoz umumiy ilovadan (${p.templateKey}) olib tashlandi: endi alohida ilovada.`, "info");
        return;
      }
      const old = must(instanceName(p.templateKey, p.slug, true), INSTANCE_RE, "Ilova nomi");
      const [row] = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.serverId, p.serverId), eq(apps.name, old)))
        .limit(1);
      if (!row) return;
      await remote(log, `(pm2 delete ${sh(old)} || true) && pm2 save`);
      await db.delete(apps).where(eq(apps.id, row.id));
      log(`Alohida ilova (${old}) to'xtatildi; fayllari ${p.deployRoot}/${old} da qoldi.`, "info");
    } catch (error) {
      log(`Eski nusxani tozalab bo'lmadi (qo'lda tekshiring): ${(error as Error).message}`, "err");
    }
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
        await handover(log);
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
