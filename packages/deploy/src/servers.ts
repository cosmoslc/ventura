import { eq } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { type ServerInfo, apps, servers } from "@ventura/db/schema/panel";
import { type AuditActor, audit, putSecret, readSecret } from "@ventura/security";
import { SshError, type SshSession, connect, generateKeyPair, sh } from "./ssh";

/* Serverlarni ro'yxatga olish va tekshirish. Yopiq SSH kalit faqat `secrets` jadvalida, shifrlangan. */

const KEY_SECRET = "ssh_private_key";
export type ServerRow = typeof servers.$inferSelect;

export interface NewServer {
  name: string;
  kind: "home" | "online";
  host: string;
  sshPort: number;
  sshUser?: string;
}

/** Serverni qo'shadi va unga yangi kalit jufti yaratadi. Ochiq kalit qaytariladi — uni serverga qo'yish kerak. */
export async function addServer(db: PanelDb, input: NewServer, actor: AuditActor): Promise<ServerRow> {
  const pair = generateKeyPair(`ventura-panel:${input.name}`);
  const [row] = await db
    .insert(servers)
    .values({
      name: input.name,
      kind: input.kind,
      host: input.host,
      sshPort: input.sshPort,
      sshUser: input.sshUser ?? "deploy",
      publicKey: pair.publicKey,
    })
    .returning();
  await putSecret(db, { type: "server", id: row!.id }, KEY_SECRET, pair.privateKey);
  await audit.record(db, {
    actor,
    action: "server.create",
    target: { type: "server", id: row!.id },
    metadata: { name: input.name, kind: input.kind, host: input.host, sshPort: input.sshPort },
  });
  return row!;
}

export async function openSession(db: PanelDb, server: ServerRow): Promise<SshSession> {
  const privateKey = await readSecret(db, { type: "server", id: server.id }, KEY_SECRET);
  if (!privateKey) throw new SshError("Server kaliti topilmadi", "auth");
  return connect({
    host: server.host,
    port: server.sshPort,
    username: server.sshUser,
    privateKey,
    hostKey: server.hostKey,
  });
}

/* Tekshiruv buyruqlari: qat'iy ro'yxat, foydalanuvchi matni qo'shilmaydi. */
const PROBES = {
  os: `. /etc/os-release && printf %s "$PRETTY_NAME"`,
  node: "node --version",
  pnpm: "pnpm --version",
  // Birinchi chaqiruvda PM2 tanishtiruv matnini ham chiqaradi; versiya oxirgi qatorda
  pm2: "pm2 --version 2>/dev/null | tail -n 1",
  // Dastur yo'q bo'lsa "command not found" matni versiya bo'lib qolmasin
  nginx: "command -v nginx >/dev/null && nginx -v 2>&1 | sed 's/.*nginx\\///'",
  postgres: "command -v psql >/dev/null && psql --version | awk '{print $3}'",
  certbot: "command -v certbot >/dev/null && certbot --version 2>&1 | awk '{print $2}'",
  git: "command -v git >/dev/null && git --version | awk '{print $3}'",
  memoryMb: "awk '/MemTotal/ {printf \"%d\", $2/1024}' /proc/meminfo",
  diskFreeGb: 'df -BG --output=avail "$HOME" | tail -1 | tr -dc 0-9',
  cpus: "nproc",
  site: "sudo -n /usr/local/sbin/ventura-site check",
} as const;

/** Deploy uchun shart bo'lgan dasturlar */
const REQUIRED = ["node", "pnpm", "pm2", "nginx", "site"] as const;

export interface CheckResult {
  ok: boolean;
  info: ServerInfo;
  missing: string[];
  error?: string;
  /** Birinchi marta ko'rilgan server kaliti izi */
  hostKey?: string;
}

/** Serverga ulanib, o'rnatilgan dasturlarni tekshiradi va natijani saqlaydi. */
export async function checkServer(db: PanelDb, server: ServerRow, actor: AuditActor): Promise<CheckResult> {
  let session: SshSession | null = null;
  let result: CheckResult;
  try {
    session = await openSession(db, server);
    const values: Record<string, string> = {};
    for (const [key, command] of Object.entries(PROBES)) {
      // Kirish qobig'i orqali: PATH (npm global dasturlari) to'g'ri bo'lishi uchun
      const out = await session.exec(`bash -lc ${sh(command)}`, { timeoutMs: 15_000 });
      values[key] = out.code === 0 ? out.stdout.trim() : "";
    }
    const missing = REQUIRED.filter((key) => !values[key]);
    const info: ServerInfo = {
      os: values.os || undefined,
      node: values.node || undefined,
      pnpm: values.pnpm || undefined,
      pm2: values.pm2 || undefined,
      nginx: values.nginx || undefined,
      postgres: values.postgres || undefined,
      certbot: values.certbot || undefined,
      git: values.git || undefined,
      memoryMb: Number(values.memoryMb) || undefined,
      diskFreeGb: Number(values.diskFreeGb) || undefined,
      cpus: Number(values.cpus) || undefined,
    };
    result = { ok: missing.length === 0, info, missing, hostKey: session.hostKey };
  } catch (e) {
    result = { ok: false, info: {}, missing: [], error: (e as Error).message };
  } finally {
    session?.close();
  }

  await db
    .update(servers)
    .set({
      status: result.ok ? "ready" : "error",
      info: result.error ? server.info : result.info,
      lastError: result.error ?? (result.missing.length ? `Yetishmaydi: ${result.missing.join(", ")}` : null),
      ...(result.hostKey ? { hostKey: server.hostKey ?? result.hostKey, lastSeenAt: new Date() } : {}),
    })
    .where(eq(servers.id, server.id));
  await audit.record(db, {
    actor,
    action: "server.check",
    target: { type: "server", id: server.id },
    metadata: { ok: result.ok, missing: result.missing, ...(result.error ? { error: result.error } : {}) },
  });
  return result;
}

export async function findServer(db: PanelDb, name: string): Promise<ServerRow | null> {
  const [row] = await db.select().from(servers).where(eq(servers.name, name)).limit(1);
  return row ?? null;
}

/* ---------- Tahrirlash ---------- */

export interface ServerPatch {
  name: string;
  kind: "home" | "online";
  host: string;
  sshPort: number;
  sshUser: string;
  deployRoot: string;
  capacity: number | null;
  note: string | null;
  /** Uydagi WSL server distributivi (yoqish va o'chirish uchun) */
  wslDistro: string | null;
}

export type UpdateServerResult =
  { ok: true; reconnect: boolean } | { ok: false; reason: "not_found" | "name_taken" | "root_user" | "root_in_use" };

/**
 * Server ma'lumotini o'zgartiradi. Manzil (host yoki port) o'zgarsa — bu boshqa mashina bo'lishi mumkin:
 * eslab qolingan server kaliti va holat tiklanadi, keyingi "Tekshirish" yangisini qabul qiladi.
 * Deploy papkasi serverda ilova bo'lsa o'zgartirilmaydi (relizlar eski joyda qoladi). Root bilan ulanish taqiqlangan.
 */
export async function updateServer(
  db: PanelDb,
  serverId: string,
  patch: ServerPatch,
  actor: AuditActor,
): Promise<UpdateServerResult> {
  const [server] = await db.select().from(servers).where(eq(servers.id, serverId));
  if (!server) return { ok: false, reason: "not_found" };
  if (patch.sshUser === "root") return { ok: false, reason: "root_user" };
  if (patch.name !== server.name) {
    const [dup] = await db.select({ id: servers.id }).from(servers).where(eq(servers.name, patch.name));
    if (dup) return { ok: false, reason: "name_taken" };
  }
  if (patch.deployRoot !== server.deployRoot) {
    const [app] = await db.select({ id: apps.id }).from(apps).where(eq(apps.serverId, serverId)).limit(1);
    if (app) return { ok: false, reason: "root_in_use" };
  }
  const reconnect = patch.host !== server.host || patch.sshPort !== server.sshPort || patch.sshUser !== server.sshUser;
  await db
    .update(servers)
    .set({
      ...patch,
      ...(reconnect
        ? { hostKey: null, status: "new", probeError: null, metricsAt: null, alerts: {}, lastError: null }
        : {}),
    })
    .where(eq(servers.id, serverId));
  const changed = (Object.keys(patch) as (keyof ServerPatch)[]).filter((k) => patch[k] !== server[k]);
  await audit.record(db, {
    actor,
    action: "server.update",
    target: { type: "server", id: serverId },
    metadata: {
      changed,
      before: Object.fromEntries(changed.map((k) => [k, server[k]])),
      after: Object.fromEntries(changed.map((k) => [k, patch[k]])),
      ...(reconnect ? { reconnect: true } : {}),
    },
  });
  return { ok: true, reconnect };
}
