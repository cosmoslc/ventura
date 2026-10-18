import type { ServerDatabase } from "@ventura/db/schema/panel";

/*
 * Serverlardagi PostgreSQL bazalari (ADR 0057): nomlash qoidasi (deploy va "Bazalar" sahifasi bir xil hisoblaydi),
 * serverdagi `ventura-db list` chiqishini o'qish va hajm ogohlantirishi. Ro'yxat har daqiqalik metrika so'rovi bilan
 * olinadi; yordamchi eski bo'lsa (setup.sh yangilanmagan) ro'yxat bo'lmaydi, qolgan metrika ishlayveradi.
 */

export const DB_NAME_RE = /^[a-z][a-z0-9_]{2,62}$/;
export const DB_PASSWORD_RE = /^[A-Za-z0-9_-]{24,128}$/;

/** Tizim bazalari — ro'yxatda ko'rsatilmaydi va yaratib bo'lmaydi */
export const SYSTEM_DATABASES = new Set(["postgres", "template0", "template1"]);

/** Baza shu hajmdan oshsa ogohlantiriladi (PostgreSQL'da bazaga qat'iy limit yo'q) */
export const DB_SIZE_ALERT_BYTES = 5 * 1024 ** 3;

export const DB_LIST_COMMAND = "sudo -n /usr/local/sbin/ventura-db list";

export type DbStrategy = "shared_db" | "db_per_tenant" | "dedicated_server";

/**
 * Loyiha bazasining nomi: umumiy baza — `<shablon>_shared` (serverdagi hamma mijoz), aks holda `<shablon>_<slug>`.
 * Rol nomi baza nomi bilan bir xil (`ventura-db ensure <baza> <baza>`).
 */
export function dbNameFor(templateKey: string, slug: string, strategy: DbStrategy | string): string {
  const base = templateKey.replace(/-/g, "_");
  return strategy === "shared_db" ? `${base}_shared` : `${base}_${slug.replace(/-/g, "_")}`;
}

/** Parol qayerda: umumiy va qo'lda yaratilgan baza — server sirlari (`db:<nom>`), loyiha bazasi — loyiha sirlari */
export function dbPasswordOwner(
  kind: "shared" | "project" | "manual",
  ids: { serverId: string; projectId?: string },
  dbName: string,
): { owner: { type: string; id: string }; name: string } {
  return kind === "project" && ids.projectId
    ? { owner: { type: "project", id: ids.projectId }, name: "db_password" }
    : { owner: { type: "server", id: ids.serverId }, name: `db:${dbName}` };
}

/** `ventura-db list`: har qatorda `nom<TAB>egasi<TAB>hajm_bayt<TAB>ulanishlar` */
export function parseDbList(stdout: string): ServerDatabase[] {
  const out: ServerDatabase[] = [];
  for (const line of stdout.split("\n")) {
    const [name, owner, size, conns] = line.trim().split("\t");
    if (!name || !DB_NAME_RE.test(name) || SYSTEM_DATABASES.has(name)) continue;
    out.push({
      name,
      owner: owner ?? "",
      sizeBytes: Math.max(0, Number(size) || 0),
      connections: Math.max(0, Number(conns) || 0),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Chegaradan oshgan bazalar va yangi oshganlari (ogohlantirish faqat o'zgarganda) */
export function nextDbAlerts(
  prev: readonly string[] | undefined,
  dbs: readonly ServerDatabase[],
  limit = DB_SIZE_ALERT_BYTES,
): { over: string[]; newly: ServerDatabase[] } {
  const before = new Set(prev ?? []);
  const big = dbs.filter((d) => d.sizeBytes >= limit);
  return { over: big.map((d) => d.name), newly: big.filter((d) => !before.has(d.name)) };
}
