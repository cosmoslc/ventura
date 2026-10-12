"use server";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addServer, deleteServer, enqueueServerJob, findServer, updateServer } from "@ventura/deploy";
import { SERVER_ACTIONS, servers } from "@ventura/db/schema/panel";
import { deps, queue } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

/*
 * Serverlar: qo'shish va o'chirish — super admin (`servers.manage`); tekshirish va ilovani qayta yuklash —
 * deploy ruxsati borlar. Serverga ulanish so'rov ichida emas: buyruq navbatga qo'yiladi, ishchi jarayon bajaradi.
 */

export type ServerResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const newServerSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/, uz.servers.invalid.name),
  host: z
    .string()
    .trim()
    .regex(/^[a-z0-9.-]{1,253}$/i, uz.servers.invalid.host),
  sshPort: z.number().int().min(1, uz.servers.invalid.port).max(65535, uz.servers.invalid.port),
  sshUser: z
    .string()
    .regex(/^[a-z_][a-z0-9_-]{0,31}$/, uz.servers.invalid.user)
    .refine((u) => u !== "root", uz.servers.rootUser),
  kind: z.enum(["home", "online"]),
});

export async function addServerAction(input: unknown): Promise<ServerResult<{ id: string }>> {
  const viewer = await requireViewer("servers.manage");
  const parsed = newServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  const { db } = deps();
  if (await findServer(db, parsed.data.name)) return { ok: false, error: uz.servers.nameTaken };
  const server = await addServer(db, parsed.data, { type: "user", id: viewer.id, name: viewer.name });
  revalidatePath("/servers");
  return { ok: true, id: server.id };
}

const editSchema = newServerSchema.extend({
  deployRoot: z
    .string()
    .trim()
    .regex(/^\/[A-Za-z0-9._/-]+$/, uz.servers.invalid.deployRoot),
  capacity: z.number().int().min(1, uz.servers.invalid.capacity).max(1000, uz.servers.invalid.capacity).nullable(),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
});

const UPDATE_ERRORS = {
  not_found: uz.common.loadError,
  name_taken: uz.servers.nameTaken,
  root_user: uz.servers.rootUser,
  root_in_use: uz.servers.rootInUse,
} as const;

export async function updateServerAction(
  serverId: string,
  input: unknown,
): Promise<ServerResult<{ reconnect: boolean }>> {
  const viewer = await requireViewer("servers.manage");
  if (!z.uuid().safeParse(serverId).success) return { ok: false, error: uz.common.loadError };
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  const res = await updateServer(deps().db, serverId, parsed.data, { type: "user", id: viewer.id, name: viewer.name });
  if (!res.ok) return { ok: false, error: UPDATE_ERRORS[res.reason] };
  revalidatePath("/servers");
  revalidatePath(`/servers/${serverId}`);
  return { ok: true, reconnect: res.reconnect };
}

const jobSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("check") }),
  z.object({ kind: z.enum(["reload", "stop", "start"]), app: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/) }),
]);

export async function serverJobAction(serverId: string, input: unknown): Promise<ServerResult> {
  const parsed = jobSchema.safeParse(input);
  if (!z.uuid().safeParse(serverId).success || !parsed.success) return { ok: false, error: uz.common.loadError };
  // To'xtatish va ishga tushirish saytni o'chirib qo'yishi mumkin — faqat super admin
  const viewer = await requireViewer(
    parsed.data.kind === "stop" || parsed.data.kind === "start" ? "servers.manage" : "projects.deploy",
  );
  if (!SERVER_ACTIONS.includes(parsed.data.kind)) return { ok: false, error: uz.common.loadError };
  const { db } = deps();
  const [server] = await db.select({ id: servers.id }).from(servers).where(eq(servers.id, serverId));
  if (!server) return { ok: false, error: uz.common.loadError };
  try {
    await enqueueServerJob(db, await queue(), {
      serverId,
      kind: parsed.data.kind,
      ...("app" in parsed.data ? { app: parsed.data.app } : {}),
      actor: { type: "user", id: viewer.id, name: viewer.name },
    });
  } catch (e) {
    console.error("[servers] navbat:", (e as Error).message);
    return { ok: false, error: uz.servers.queueError };
  }
  revalidatePath(`/servers/${serverId}`);
  return { ok: true };
}

export async function deleteServerAction(serverId: string): Promise<ServerResult> {
  const viewer = await requireViewer("servers.manage");
  if (!z.uuid().safeParse(serverId).success) return { ok: false, error: uz.common.loadError };
  const res = await deleteServer(deps().db, serverId, { type: "user", id: viewer.id, name: viewer.name });
  if (!res.ok) return { ok: false, error: res.reason === "in_use" ? uz.servers.inUse : uz.common.loadError };
  revalidatePath("/servers");
  return { ok: true };
}

/**
 * O'rnatish buyrug'i: setup.sh mazmuni va panel kaliti bitta nusxalanadigan matnda (serverga terminaldan
 * qo'yiladi). Skript va ochiq kalit maxfiy emas; yopiq kalit bu yerda yo'q.
 */
export async function setupCommandAction(serverId: string): Promise<ServerResult<{ command: string }>> {
  await requireViewer("servers.manage");
  if (!z.uuid().safeParse(serverId).success) return { ok: false, error: uz.common.loadError };
  const [server] = await deps()
    .db.select({ publicKey: servers.publicKey, kind: servers.kind })
    .from(servers)
    .where(eq(servers.id, serverId));
  if (!server) return { ok: false, error: uz.common.loadError };
  const script = readFileSync(resolve(process.cwd(), "../../tooling/server/setup.sh"), "utf8");
  const command = [
    "cat > /tmp/ventura-setup.sh <<'VENTURA_SETUP_EOF'",
    script.trimEnd(),
    "VENTURA_SETUP_EOF",
    `sudo bash /tmp/ventura-setup.sh --key "${server.publicKey}"`,
  ].join("\n");
  return { ok: true, command };
}
