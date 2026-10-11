import "server-only";
import { type Auth, createAuth } from "@ventura/auth";
import { type PanelDb, createPanelDb } from "@ventura/db";
import { type Queue, startQueue } from "@ventura/deploy";
import { type Telegram, createTelegram } from "@ventura/integrations";

/*
 * Server bog'liqliklari: baza, Telegram, Better Auth. Dev rejimida HMR har safar yangi ulanish
 * ochmasligi uchun globalThis da saqlanadi. Bu modul client komponentga hech qachon tushmaydi.
 */

interface Deps {
  db: PanelDb;
  telegram: Telegram;
  auth: Auth;
}

const g = globalThis as unknown as { __venturaDeps?: Deps; __venturaQueue?: Promise<Queue> };

export function deps(): Deps {
  if (!g.__venturaDeps) {
    const db = createPanelDb();
    const telegram = createTelegram();
    g.__venturaDeps = { db, telegram, auth: createAuth({ db, telegram }) };
  }
  return g.__venturaDeps;
}

/**
 * Vazifalar navbati (pg-boss). Panel faqat vazifa qo'shadi; bajarish — apps/worker.
 * Birinchi chaqiruvda ulanadi; ulanish yiqilsa, keyingi chaqiruv qayta urinadi.
 */
export function queue(): Promise<Queue> {
  g.__venturaQueue ??= startQueue().catch((e) => {
    g.__venturaQueue = undefined;
    throw e;
  });
  return g.__venturaQueue;
}
