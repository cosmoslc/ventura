import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/*
 * Sirlarni shifrlash (SPEC 11-bo'lim): AES-256-GCM.
 * Asosiy kalit bazada emas, alohida faylda (VENTURA_MASTER_KEY_FILE) — 32 bayt, base64.
 * Kalit versiyasi saqlanadi: kalitni almashtirish (rotatsiya) uchun.
 */

export const KEY_VERSION = "v1";

export interface Encrypted {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
}

let cachedKey: Buffer | null = null;

/** Repo ildizidan nisbiy yo'lni ham qabul qiladi (masalan `.secrets/master.key`). */
export function loadMasterKey(file = process.env.VENTURA_MASTER_KEY_FILE, cwd = process.cwd()): Buffer {
  if (cachedKey) return cachedKey;
  if (!file) throw new Error("VENTURA_MASTER_KEY_FILE berilmagan");
  const path = isAbsolute(file) ? file : findUp(file, cwd);
  const key = Buffer.from(readFileSync(path, "utf8").trim(), "base64");
  if (key.length !== 32) throw new Error("Asosiy kalit 32 bayt (base64) bo'lishi kerak");
  cachedKey = key;
  return key;
}

/** Monorepo ichida ishga tushirilgan joydan yuqoriga qarab faylni qidiradi (apps/panel, packages/*). */
function findUp(rel: string, cwd: string): string {
  let dir = cwd;
  for (let i = 0; i < 4; i++) {
    const p = resolve(dir, rel);
    try {
      readFileSync(p);
      return p;
    } catch {
      dir = resolve(dir, "..");
    }
  }
  return resolve(cwd, rel);
}

export function encrypt(plaintext: string, key: Buffer = loadMasterKey()): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

/** Ma'lumot o'zgartirilgan bo'lsa (authTag mos kelmasa) xato tashlaydi. */
export function decrypt(data: Encrypted, key: Buffer = loadMasterKey()): string {
  if (data.keyVersion !== KEY_VERSION) throw new Error(`Noma'lum kalit versiyasi: ${data.keyVersion}`);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(data.iv, "base64"));
  decipher.setAuthTag(Buffer.from(data.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
