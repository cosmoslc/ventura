import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { TENANT_SLUG, TMP_DIR, appEnv, databaseUrls } from "./env";

/*
 * Har ishga tushishda: sinov markazi (ro'yxat, maxfiy sozlamalar, baza migratsiyasi, birinchi filial) va test
 * ma'lumoti (direktor, kurs, o'qituvchi, guruh). Ikkalasi ham qayta ishga tushirishga chidamli.
 */

const ROOT = resolve(import.meta.dirname, "../../..");

export default function globalSetup() {
  mkdirSync(TMP_DIR, { recursive: true });
  const { app, migrate } = databaseUrls();
  const env = { ...process.env, ...appEnv() };
  // Argumentlar shell'siz uzatiladi (URL ichidagi belgilar buzilmasin)
  const pnpm = (args: string[]) =>
    execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
      cwd: ROOT,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  pnpm([
    "--filter",
    "@ventura/scripts",
    "edu:tenant",
    "--slug",
    TENANT_SLUG,
    "--name",
    "E2E markaz",
    "--host",
    "localhost,127.0.0.1",
    "--database-url",
    app,
    "--migrate-url",
    migrate,
    // Soxta bot: format @BotFather tokeniga mos (maxfiy sozlamalar tekshiruvi), so'rovlar soxta serverga ketadi
    "--bot-token",
    "1000000001:e2e-soxta-token-faqat-test-uchun",
  ]);
  pnpm(["--filter", "@ventura/scripts", "edu:e2e-seed", "--tenant", TENANT_SLUG]);
}
