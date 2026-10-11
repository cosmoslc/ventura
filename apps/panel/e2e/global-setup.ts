import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MASTER_KEY_FILE, TMP_DIR, appEnv } from "./env";

/* Har ishga tushishda: vaqtinchalik kalit, migratsiyalar, shablon manifesti va test foydalanuvchisi. */

const ROOT = resolve(import.meta.dirname, "../../..");

export default function globalSetup() {
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(MASTER_KEY_FILE, randomBytes(32).toString("base64"));

  const env = { ...process.env, ...appEnv() };
  const run = (command: string) => execSync(command, { cwd: ROOT, env, stdio: "inherit" });
  run("pnpm db:migrate");
  run("pnpm templates:sync");
  run("pnpm --filter @ventura/scripts e2e:seed");
}
