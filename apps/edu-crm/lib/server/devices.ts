import "server-only";
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { deviceHash, revokeSessionsByAgent } from "@ventura/auth/staff";
import type { TenantDb } from "@ventura/db";
import { knownDevices, sessions, users } from "@ventura/db/schema/tenant";
import { deviceLabel } from "@/lib/activity-log";

/*
 * Qurilmalar (E6g, ADR 0040): `known_devices` — har xodim uchun u kirgan brauzerlar (qurilma cookie'sining xeshi).
 * Direktor ro'yxatni ko'radi va qurilmani bloklaydi/ochadi. Cookie'ning o'zi bazaga yozilmaydi (faqat xeshi),
 * shuning uchun "shu qurilma" belgisi joriy cookie xeshini qatordagi bilan solishtirib topiladi.
 */

export const DEVICE_STATUSES = ["active", "blocked"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export const DEVICES_LIMIT = 300;

export interface DeviceRow {
  id: string;
  userId: string;
  userName: string;
  /** "Chrome · Windows" (saqlangan nom, bo'lmasa user-agent'dan); aniqlanmasa null */
  name: string | null;
  ip: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  loginCount: number;
  blockedAt: string | null;
  blockedByName: string | null;
  /** So'rov yuborgan xodim hozir aynan shu qurilmadan ishlayapti */
  current: boolean;
}

export interface DeviceQuery {
  userId?: string | null;
  status?: DeviceStatus | null;
  q?: string;
}

export interface DeviceList {
  rows: DeviceRow[];
  total: number;
  truncated: boolean;
}

const like = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

const iso = (d: Date) => d.toISOString();

/** Direktor uchun: barcha xodimlarning qurilmalari, oxirgi faolligi bo'yicha */
export async function listDevices(
  db: TenantDb,
  query: DeviceQuery,
  currentDeviceId: string | null,
): Promise<DeviceList> {
  const filters: (SQL | undefined)[] = [
    query.userId ? eq(knownDevices.userId, query.userId) : undefined,
    query.status === "blocked" ? isNotNull(knownDevices.blockedAt) : undefined,
    query.status === "active" ? isNull(knownDevices.blockedAt) : undefined,
  ];
  const q = (query.q ?? "").trim().slice(0, 100);
  if (q) {
    filters.push(
      or(
        ilike(users.name, like(q)),
        ilike(knownDevices.deviceName, like(q)),
        ilike(knownDevices.userAgent, like(q)),
        ilike(knownDevices.lastIp, like(q)),
      ),
    );
  }
  const where = and(...filters);
  const [rows, [tot]] = await Promise.all([
    db
      .select({
        id: knownDevices.id,
        userId: knownDevices.userId,
        userName: users.name,
        deviceName: knownDevices.deviceName,
        userAgent: knownDevices.userAgent,
        ip: knownDevices.lastIp,
        hash: knownDevices.deviceHash,
        firstSeenAt: knownDevices.firstSeenAt,
        lastSeenAt: knownDevices.lastSeenAt,
        loginCount: knownDevices.loginCount,
        blockedAt: knownDevices.blockedAt,
        blockedBy: knownDevices.blockedBy,
      })
      .from(knownDevices)
      .innerJoin(users, eq(users.id, knownDevices.userId))
      .where(where)
      .orderBy(desc(knownDevices.lastSeenAt))
      .limit(DEVICES_LIMIT),
    db.select({ n: count() }).from(knownDevices).innerJoin(users, eq(users.id, knownDevices.userId)).where(where),
  ]);
  const blockerIds = [...new Set(rows.flatMap((r) => (r.blockedBy ? [r.blockedBy] : [])))];
  const blockers = new Map(
    blockerIds.length
      ? (await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, blockerIds))).map(
          (u) => [u.id, u.name] as const,
        )
      : [],
  );
  const mine = currentDeviceId ? deviceHash(currentDeviceId) : null;
  return {
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      name: r.deviceName ?? deviceLabel(r.userAgent),
      ip: r.ip,
      firstSeenAt: iso(r.firstSeenAt),
      lastSeenAt: iso(r.lastSeenAt),
      loginCount: r.loginCount,
      blockedAt: r.blockedAt ? iso(r.blockedAt) : null,
      blockedByName: r.blockedBy ? (blockers.get(r.blockedBy) ?? null) : null,
      current: !!mine && r.hash === mine,
    })),
    total: tot?.n ?? 0,
    truncated: (tot?.n ?? 0) > DEVICES_LIMIT,
  };
}

/** Qurilmasi bor xodimlar (filtr uchun) */
export async function deviceOwners(db: TenantDb): Promise<{ id: string; name: string }[]> {
  return db
    .selectDistinct({ id: users.id, name: users.name })
    .from(knownDevices)
    .innerJoin(users, eq(users.id, knownDevices.userId))
    .orderBy(users.name);
}

export type BlockFailure = "not_found" | "self" | "unchanged";

export interface BlockResult {
  ok: boolean;
  failure?: BlockFailure;
  /** Auditga: qurilma egasi va nomi */
  userId?: string;
  device?: string | null;
  endedSessions?: number;
}

/**
 * Qurilmani bloklash yoki ochish. Direktor o'zi hozir ishlayotgan qurilmani bloklay olmaydi (o'zini qulflab
 * qo'ymasligi uchun); joriy qurilma aniqlanmasa (cookie yo'q) — o'z hisobining hech bir qurilmasi bloklanmaydi.
 * Bloklanganda xodimning shu brauzer belgisi bilan ochilgan sessiyalari ham yopiladi.
 */
export async function setDeviceBlocked(
  db: TenantDb,
  input: { id: string; blocked: boolean; actorId: string; actorSessionId: string; currentDeviceId: string | null },
): Promise<BlockResult> {
  const [row] = await db.select().from(knownDevices).where(eq(knownDevices.id, input.id)).limit(1);
  if (!row) return { ok: false, failure: "not_found" };
  const device = row.deviceName ?? deviceLabel(row.userAgent);
  if (input.blocked) {
    if (row.blockedAt) return { ok: false, failure: "unchanged" };
    const own = row.userId === input.actorId;
    const isCurrent = !!input.currentDeviceId && row.deviceHash === deviceHash(input.currentDeviceId);
    if (own && (isCurrent || !input.currentDeviceId)) return { ok: false, failure: "self" };
    // Xodimning shu qurilma xeshi bilan boshqa qatori ham bo'lsa (poyga), hammasi bloklanadi
    await db
      .update(knownDevices)
      .set({ blockedAt: new Date(), blockedBy: input.actorId })
      .where(and(eq(knownDevices.userId, row.userId), eq(knownDevices.deviceHash, row.deviceHash)));
    const ended = await revokeSessionsByAgent(db, row.userId, row.userAgent, own ? input.actorSessionId : undefined);
    return { ok: true, userId: row.userId, device, endedSessions: ended };
  }
  if (!row.blockedAt) return { ok: false, failure: "unchanged" };
  await db
    .update(knownDevices)
    .set({ blockedAt: null, blockedBy: null })
    .where(and(eq(knownDevices.userId, row.userId), eq(knownDevices.deviceHash, row.deviceHash)));
  return { ok: true, userId: row.userId, device };
}

export interface OwnDevice {
  id: string;
  name: string | null;
  ip: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  loginCount: number;
  current: boolean;
}

/** Xodimning o'z qurilmalari (bloklanmaganlari) va ochiq sessiyalari soni */
export async function ownDevices(
  db: TenantDb,
  userId: string,
  currentDeviceId: string | null,
): Promise<{ devices: OwnDevice[]; sessionCount: number }> {
  const [rows, [sess]] = await Promise.all([
    db
      .select()
      .from(knownDevices)
      .where(and(eq(knownDevices.userId, userId), isNull(knownDevices.blockedAt)))
      .orderBy(desc(knownDevices.lastSeenAt))
      .limit(50),
    db
      .select({ n: count() })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), sql`${sessions.expiresAt} > now()`)),
  ]);
  const mine = currentDeviceId ? deviceHash(currentDeviceId) : null;
  return {
    devices: rows.map((r) => ({
      id: r.id,
      name: r.deviceName ?? deviceLabel(r.userAgent),
      ip: r.lastIp,
      firstSeenAt: iso(r.firstSeenAt),
      lastSeenAt: iso(r.lastSeenAt),
      loginCount: r.loginCount,
      current: !!mine && r.deviceHash === mine,
    })),
    sessionCount: sess?.n ?? 0,
  };
}
