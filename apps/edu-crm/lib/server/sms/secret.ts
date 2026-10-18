import "server-only";
import { hkdfSync } from "node:crypto";
import { type Encrypted, decrypt, encrypt } from "@ventura/security";

/*
 * SMS provayder sirlarini shifrlash (docs/EDU-CRM-SMS.md, 4.2). Panel asosiy kaliti tenant serverida yo'q, shuning
 * uchun kalit tenantning `authSecret`idan HKDF bilan olinadi: shu markaz serverida ochiladi, boshqasida — yo'q.
 * `authSecret` almashsa saqlangan kalit ochilmaydi — markaz Eskiz'ni qayta ulaydi (sahifa shuni ko'rsatadi).
 */

const keys = new Map<string, Buffer>();

function keyFor(authSecret: string): Buffer {
  let key = keys.get(authSecret);
  if (!key) {
    key = Buffer.from(hkdfSync("sha256", authSecret, "ventura-sms", "sms-provider-v1", 32));
    keys.set(authSecret, key);
  }
  return key;
}

export function sealSecret(value: string, authSecret: string): string {
  return JSON.stringify(encrypt(value, keyFor(authSecret)));
}

/** Ochib bo'lmasa (kalit almashgan yoki ma'lumot buzilgan) — null. */
export function openSecret(sealed: string | null, authSecret: string): string | null {
  if (!sealed) return null;
  try {
    return decrypt(JSON.parse(sealed) as Encrypted, keyFor(authSecret));
  } catch {
    return null;
  }
}
