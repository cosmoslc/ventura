import { randomBytes } from "node:crypto";
import { type DeployDriver, StepError, type StepKey } from "../types";

/*
 * Sinov drayveri: hech qayerga ulanmaydi, haqiqiy deploy qadamlarini vaqt va log bilan taqlid qiladi.
 * Navbat, jonli log va xato holatlarini server tayyor bo'lmasdan ko'rish va test qilish uchun.
 * Haqiqiy deploy — SSH drayveri (2-bosqichning keyingi qismi).
 */

export interface SimOptions {
  /** Bitta qadam davomiyligi (ms) */
  stepMs?: number;
  /** Shu qadamda yiqiladi (xato holatini ko'rish uchun) */
  failStep?: StepKey | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSimDriver(options: SimOptions = {}): DeployDriver {
  const stepMs = options.stepMs ?? Number(process.env.SIM_STEP_MS ?? 900);
  const failStep = options.failStep ?? ((process.env.SIM_FAIL_STEP || null) as StepKey | null);

  const script: Record<StepKey, (slug: string, release: string) => [cmd: string, ...out: string[]]> = {
    prepare: (slug, release) => [`mkdir -p ${release}`, `Reliz papkasi: ${release}`, `Loyiha: ${slug}`],
    fetch: () => ["git clone --depth 1 <repo> .", "Cloning into '.'...", "HEAD is now at (sinov)"],
    env: () => ["write .env", "12 ta o'zgaruvchi yozildi (qiymatlar ko'rsatilmaydi)"],
    build: () => [
      "pnpm install --frozen-lockfile && pnpm turbo build",
      "Lockfile is up to date, resolution step is skipped",
      "Packages: +612",
      "▲ Next.js build",
      "✓ Compiled successfully",
      "✓ Generating static pages",
    ],
    migrate: () => ["pnpm db:migrate", "[✓] migrations applied successfully!"],
    release: (slug) => [`ln -sfn <reliz> current && pm2 reload ${slug}`, `[PM2] [${slug}](0) ✓`],
    health: (slug) => [`curl -fsS http://127.0.0.1:<port>/health`, `200 OK — ${slug} javob beryapti`],
    route: (slug) => [
      `sudo ventura-site set ${slug} <port> ${slug}.ventura.uz`,
      `ventura-site: ${slug} -> 127.0.0.1:<port>`,
    ],
    cleanup: () => ["eski relizlarni tozalash (oxirgi 5 tasi qoladi)", "0 ta reliz o'chirildi"],
  };

  return {
    kind: "sim",
    async run(step, ctx, log) {
      const release =
        ctx.releasePath ??
        `/home/deploy/apps/${ctx.project.slug}/releases/${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
      const [cmd, ...out] = script[step](ctx.project.slug, release);
      if (step === "prepare") log("Sinov rejimi: buyruqlar bajarilmaydi, faqat ko'rsatiladi.", "info");
      log(cmd, "cmd");
      const pause = stepMs / (out.length + 1);
      for (const line of out) {
        await sleep(pause);
        log(line);
      }
      await sleep(pause);
      if (step === failStep) throw new StepError(`Sinov xatosi: "${step}" qadami ataylab yiqitildi`, 1);
      if (step === "prepare") return { releasePath: release };
      if (step === "fetch") return { commitSha: randomBytes(20).toString("hex") };
    },
    async rollback(ctx, log) {
      log(`ln -sfn <oldingi reliz> current && pm2 reload ${ctx.project.slug}`, "cmd");
      await sleep(stepMs / 2);
      log(`[PM2] [${ctx.project.slug}](0) ✓`);
    },
  };
}
