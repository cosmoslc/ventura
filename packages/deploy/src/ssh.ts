import { createHash } from "node:crypto";
import ssh2 from "ssh2";

// ssh2 — CommonJS paket: nomli eksportlar Node ESM'da ko'rinmaydi, shuning uchun standart importdan olinadi
const { Client, utils } = ssh2;

/*
 * Serverga SSH ulanish. Qoidalar (CLAUDE.md, SPEC 11):
 *  - faqat kalit bilan; parol ishlatilmaydi;
 *  - serverning o'z kaliti (host key) birinchi ulanishda eslab qolinadi va keyin o'zgarsa ulanish rad etiladi;
 *  - buyruqlar shu paketdagi belgilangan ro'yxatdan tuziladi, argumentlar har doim qo'shtirnoqlanadi (`sh`).
 */

export interface SshTarget {
  host: string;
  port: number;
  username: string;
  privateKey: string;
  /** Avval eslab qolingan iz (`SHA256:...`). Bo'lmasa, birinchi ulanishda qabul qilinadi. */
  hostKey?: string | null;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  /** Har chiqish qatori uchun chaqiriladi (jonli log) */
  onLine?: (line: string, stream: "out" | "err") => void;
  timeoutMs?: number;
  /** Buyruqqa stdin orqali beriladigan ma'lumot (sirlar shu yo'l bilan: buyruq satriga va logga tushmaydi) */
  input?: string;
}

export interface SshSession {
  /** Server kaliti izi — birinchi ulanishdan keyin saqlab qo'yish uchun */
  readonly hostKey: string;
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  /** Fayl yozish (masalan .env): mazmun buyruq satriga tushmaydi */
  writeFile(path: string, content: string | Buffer, mode?: number): Promise<void>;
  close(): void;
}

export class SshError extends Error {
  constructor(
    message: string,
    readonly kind: "connect" | "auth" | "host_key" | "timeout" | "exec",
  ) {
    super(message);
    this.name = "SshError";
  }
}

/** Bitta argumentni shell uchun xavfsiz qiladi: 'a'\''b' */
export function sh(value: string | number): string {
  const text = String(value);
  if (/^[A-Za-z0-9_\-./:=@%+,]+$/.test(text)) return text;
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

export const fingerprint = (key: Buffer) =>
  `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;

/** Yangi ed25519 kalit jufti (OpenSSH formatida). Yopiq qismi shifrlanib saqlanadi. */
export function generateKeyPair(comment: string): { privateKey: string; publicKey: string } {
  const pair = utils.generateKeyPairSync("ed25519", { comment });
  return { privateKey: pair.private, publicKey: pair.public.trim() };
}

function lineSplitter(emit: (line: string) => void) {
  let rest = "";
  return {
    push(chunk: Buffer | string) {
      rest += chunk.toString();
      const parts = rest.split(/\r?\n/);
      rest = parts.pop() ?? "";
      for (const part of parts) emit(part);
    },
    end() {
      if (rest) emit(rest);
      rest = "";
    },
  };
}

export function connect(target: SshTarget, { timeoutMs = 20_000 } = {}): Promise<SshSession> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let seenKey = "";
    let settled = false;
    const fail = (error: SshError) => {
      if (settled) return;
      settled = true;
      client.end();
      reject(error);
    };

    client
      .on("ready", () => {
        if (settled) return;
        settled = true;
        resolve({
          hostKey: seenKey,
          exec(command, options = {}) {
            return new Promise((done, failed) => {
              client.exec(command, (error, channel) => {
                if (error) return failed(new SshError(error.message, "exec"));
                let stdout = "";
                let stderr = "";
                const out = lineSplitter((line) => options.onLine?.(line, "out"));
                const err = lineSplitter((line) => options.onLine?.(line, "err"));
                const timer = options.timeoutMs
                  ? setTimeout(() => {
                      channel.close();
                      failed(
                        new SshError(`Buyruq ${Math.round(options.timeoutMs! / 1000)} soniyada tugamadi`, "timeout"),
                      );
                    }, options.timeoutMs)
                  : null;
                channel.on("data", (chunk: Buffer) => {
                  stdout += chunk.toString();
                  out.push(chunk);
                });
                channel.stderr.on("data", (chunk: Buffer) => {
                  stderr += chunk.toString();
                  err.push(chunk);
                });
                if (options.input !== undefined) channel.end(options.input);
                channel.on("close", (code: number | null) => {
                  if (timer) clearTimeout(timer);
                  out.end();
                  err.end();
                  done({ code: code ?? 1, stdout, stderr });
                });
              });
            });
          },
          writeFile(path, content, mode = 0o600) {
            return new Promise((done, failed) => {
              client.sftp((error, sftp) => {
                if (error) return failed(new SshError(error.message, "exec"));
                sftp.writeFile(path, content, { mode }, (writeError) => {
                  sftp.end();
                  if (writeError) failed(new SshError(writeError.message, "exec"));
                  else done();
                });
              });
            });
          },
          close: () => client.end(),
        });
      })
      .on("error", (error: Error & { level?: string }) => {
        if (error.level === "client-authentication") {
          fail(new SshError("Server kalitni qabul qilmadi (ochiq kalit serverga qo'yilganmi?)", "auth"));
        } else if (seenKey && target.hostKey && seenKey !== target.hostKey) {
          fail(new SshError("Serverning kaliti o'zgargan — ulanish rad etildi", "host_key"));
        } else if (error.level === "client-timeout") {
          fail(new SshError("Server javob bermadi", "timeout"));
        } else {
          fail(new SshError(error.message || "Serverga ulanib bo'lmadi", "connect"));
        }
      })
      .connect({
        host: target.host,
        port: target.port,
        username: target.username,
        privateKey: target.privateKey,
        readyTimeout: timeoutMs,
        keepaliveInterval: 15_000,
        hostVerifier: (key: Buffer) => {
          seenKey = fingerprint(key);
          return !target.hostKey || target.hostKey === seenKey;
        },
      });
  });
}
