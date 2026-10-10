import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { createAuth } from "@ventura/auth";
import { createPanelDb } from "@ventura/db";
import { createTelegram } from "@ventura/integrations";

/** Repo ildizi va .env — buyruq qaysi papkadan ishga tushirilishidan qat'i nazar. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function loadEnv() {
  const file = resolve(ROOT, ".env");
  if (existsSync(file)) process.loadEnvFile(file);
  // Kalit fayli yo'li repo ildiziga nisbatan
  process.chdir(ROOT);
}

export function context() {
  loadEnv();
  const db = createPanelDb();
  const telegram = createTelegram();
  const auth = createAuth({ db, telegram });
  return { db, telegram, auth };
}

const rl = () => createInterface({ input: process.stdin, output: process.stdout });

export async function ask(question: string): Promise<string> {
  const r = rl();
  try {
    return (await r.question(question)).trim();
  } finally {
    r.close();
  }
}

/** Kiritilgan belgilar ekranda ko'rinmaydi (parol uchun). */
export async function askHidden(question: string): Promise<string> {
  process.stdout.write(question);
  const stdin = process.stdin;
  return new Promise((resolvePromise, reject) => {
    let value = "";
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolvePromise(value);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          reject(new Error("Bekor qilindi"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode?.(wasRaw ?? false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

export async function confirm(question: string): Promise<boolean> {
  return /^(h|ha|y|yes)$/i.test(await ask(`${question} [ha/yo'q]: `));
}

export function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

export function done(message: string): never {
  console.log(`\n✔ ${message}`);
  process.exit(0);
}
