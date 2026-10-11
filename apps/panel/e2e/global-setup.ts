import { type ChildProcess, execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MASTER_KEY_FILE, TMP_DIR, appEnv } from "./env";

/*
 * Har ishga tushishda: vaqtinchalik kalit, migratsiyalar, shablon manifesti, test foydalanuvchisi
 * va ishchi jarayon (navbatdagi deploylarni bajaradi). Ishchi migratsiyadan keyin ishga tushishi kerak,
 * shuning uchun u webServer ro'yxatida emas, shu yerda boshlanadi va testlar tugagach to'xtatiladi.
 */

const ROOT = resolve(import.meta.dirname, "../../..");

function startWorker(env: NodeJS.ProcessEnv): Promise<ChildProcess> {
  const child = spawn("pnpm --filter @ventura/worker start", {
    cwd: ROOT,
    env,
    shell: true,
    stdio: ["ignore", "pipe", "inherit"],
    // Unix'da butun jarayonlar guruhini to'xtatish uchun
    detached: process.platform !== "win32",
  });
  return new Promise((done, fail) => {
    let output = "";
    const timer = setTimeout(() => fail(new Error("Ishchi jarayon 60 soniyada tayyor bo'lmadi")), 60_000);
    child.stdout!.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      output += chunk.toString();
      if (output.includes("[worker] tayyor")) {
        clearTimeout(timer);
        done(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`Ishchi jarayon to'xtab qoldi (kod ${code})`));
    });
  });
}

function stopWorker(child: ChildProcess) {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    // allaqachon to'xtagan
  }
}

export default async function globalSetup() {
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(MASTER_KEY_FILE, randomBytes(32).toString("base64"));

  const env = { ...process.env, ...appEnv() };
  const run = (command: string) => execSync(command, { cwd: ROOT, env, stdio: "inherit" });
  run("pnpm db:migrate");
  run("pnpm templates:sync");
  run("pnpm --filter @ventura/scripts e2e:seed");

  const worker = await startWorker(env);
  return () => stopWorker(worker);
}
