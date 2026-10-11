import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { and, asc, eq, max } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { apps, domains, projectFeatures, projects, servers, templates } from "@ventura/db/schema/panel";
import { type Tenant, emptyRegistry, parseRegistry, upsertTenant } from "@ventura/tenants";
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
}

function must(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new StepError(`${what} noto'g'ri: deploy to'xtatildi`);
  return value;
}

export function createSshDriver({ db, repoRoot }: SshDriverDeps): DeployDriver {
  let plan: Plan | null = null;

  /** Buyruqni bajaradi: o'zi `cmd`, natijasi `out` / `err` bo'lib logga tushadi. Nol bo'lmagan kod — xato. */
  async function remote(log: StepLog, command: string, timeoutMs = 2 * MINUTE): Promise<string> {
    log(command, "cmd");
    const result = await plan!.session.exec(`bash -lc ${sh(command)}`, {
      timeoutMs,
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

    // Server: loyihaga biriktirilgani, bo'lmasa birinchi tayyor server
    const ready = await db.select().from(servers).where(eq(servers.status, "ready")).orderBy(asc(servers.createdAt));
    const server = ready.find((s) => s.id === project.serverId) ?? (project.serverId ? undefined : ready[0]);
    if (!server) throw new StepError("Tayyor server yo'q. Avval serverni qo'shing va tekshiring (pnpm server:check).");

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
            VENTURA_COMMIT_FILE: `${p.root}/current/.ventura-commit`,
          },
          max_memory_restart: "512M",
          time: true,
        },
      ],
    };
    await p.session.writeFile(
      `${p.root}/shared/ecosystem.config.cjs`,
      `// Ventura boshqaradi — qo'lda o'zgartirmang\nmodule.exports = ${JSON.stringify(ecosystem, null, 2)};\n`,
      0o600,
    );
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
    `pm2 startOrReload ${sh(`${p.root}/shared/ecosystem.config.cjs`)} --update-env && pm2 save`;
  const pointCurrent = (p: Plan, target: string) =>
    `ln -sfn ${sh(target)} ${sh(`${p.root}/current.new`)} && mv -Tf ${sh(`${p.root}/current.new`)} ${sh(`${p.root}/current`)}`;

  async function release(log: StepLog) {
    const p = plan!;
    if (p.reuse) {
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
    let body: { ok?: boolean; tenant?: string | null; commit?: string | null };
    try {
      body = JSON.parse(out);
    } catch {
      throw new StepError("Ilova kutilmagan javob qaytardi");
    }
    if (body.tenant !== p.slug) throw new StepError(`Ilova bu domenni "${p.slug}" deb tanimadi`);
    if (body.commit !== p.sha) throw new StepError("Ilova eski versiyada ishlayapti");
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

  const steps: Record<Exclude<StepKey, "prepare" | "migrate">, (log: StepLog) => Promise<void>> = {
    fetch,
    env,
    build,
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
      if (step === "migrate") return void log("Mijoz bazasi keyingi qismda (3/4) qo'shiladi.", "info");
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
