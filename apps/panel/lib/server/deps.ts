import "server-only";
import { type Auth, createAuth } from "@ventura/auth";
import { type PanelDb, createPanelDb } from "@ventura/db";
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

const g = globalThis as unknown as { __venturaDeps?: Deps };

export function deps(): Deps {
  if (!g.__venturaDeps) {
    const db = createPanelDb();
    const telegram = createTelegram();
    g.__venturaDeps = { db, telegram, auth: createAuth({ db, telegram }) };
  }
  return g.__venturaDeps;
}
