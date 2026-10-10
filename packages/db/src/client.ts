import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as panelSchema from "./schema/panel";

/**
 * Panel bazasiga ulanish. Faqat server kodida ishlatiladi (CLAUDE.md: baza va sirlar client'ga tushmaydi).
 * Ulanish import paytida emas, birinchi chaqiruvda ochiladi.
 */
export function createPanelDb(url: string = process.env.PANEL_DATABASE_URL ?? "") {
  if (!url) throw new Error("PANEL_DATABASE_URL berilmagan");
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema: panelSchema });
}

export type PanelDb = ReturnType<typeof createPanelDb>;
