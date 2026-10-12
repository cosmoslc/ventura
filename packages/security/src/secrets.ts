import { and, eq } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { secrets } from "@ventura/db/schema/panel";
import { decrypt, encrypt } from "./crypto";

/*
 * Shifrlangan sirlar ombori. Qiymat faqat server ichida ochiladi;
 * brauzerga va logga hech qachon qaytarilmaydi (CLAUDE.md).
 */

export interface SecretOwner {
  type: string;
  id: string;
}

export async function putSecret(db: PanelDb, owner: SecretOwner, name: string, value: string) {
  const enc = encrypt(value);
  await db
    .insert(secrets)
    .values({ ownerType: owner.type, ownerId: owner.id, name, ...enc })
    .onConflictDoUpdate({
      target: [secrets.ownerType, secrets.ownerId, secrets.name],
      set: { ...enc, updatedAt: new Date() },
    });
}

export async function readSecret(db: PanelDb, owner: SecretOwner, name: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.ownerType, owner.type), eq(secrets.ownerId, owner.id), eq(secrets.name, name)))
    .limit(1);
  return row ? decrypt(row) : null;
}

/** Sir bor-yo'qligini qiymatini ochmasdan bilish (interfeysda "saqlangan" belgisi uchun). */
export async function hasSecret(db: PanelDb, owner: SecretOwner, name: string): Promise<boolean> {
  const [row] = await db
    .select({ id: secrets.id })
    .from(secrets)
    .where(and(eq(secrets.ownerType, owner.type), eq(secrets.ownerId, owner.id), eq(secrets.name, name)))
    .limit(1);
  return !!row;
}

/** Egasining barcha sirlarini o'chiradi (masalan, server ro'yxatdan o'chirilganda uning SSH kaliti). */
export async function deleteSecrets(db: PanelDb, owner: SecretOwner): Promise<void> {
  await db.delete(secrets).where(and(eq(secrets.ownerType, owner.type), eq(secrets.ownerId, owner.id)));
}
