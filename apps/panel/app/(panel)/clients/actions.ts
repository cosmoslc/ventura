"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeUzPhone } from "@ventura/auth";
import { CLIENT_STATUSES, clients } from "@ventura/db/schema/panel";
import { audit } from "@ventura/security";
import { deps } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

export type ClientResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z.object({
  name: z.string().trim().min(2, uz.clients.nameRequired).max(120),
  phone: z.string().trim(),
  company: z.string().trim().max(120),
  note: z.string().trim().max(1000),
  status: z.enum(CLIENT_STATUSES),
});

function parse(form: FormData) {
  const r = schema.safeParse({
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    company: String(form.get("company") ?? ""),
    note: String(form.get("note") ?? ""),
    status: String(form.get("status") ?? "active"),
  });
  if (!r.success) return { error: r.error.issues[0]?.message ?? uz.common.loadError } as const;
  // Telefon ixtiyoriy, lekin kiritilgan bo'lsa to'g'ri bo'lishi kerak
  const phone = r.data.phone ? normalizeUzPhone(r.data.phone) : null;
  if (r.data.phone && !phone) return { error: uz.clients.phoneInvalid } as const;
  return {
    data: {
      name: r.data.name,
      phone,
      company: r.data.company || null,
      note: r.data.note || null,
      status: r.data.status,
    },
  } as const;
}

export async function saveClientAction(form: FormData): Promise<ClientResult> {
  const viewer = await requireViewer("clients.write");
  const { db } = deps();
  const parsed = parse(form);
  if ("error" in parsed) return { ok: false, error: parsed.error ?? uz.common.loadError };
  const id = String(form.get("id") ?? "");
  const actor = { type: "user" as const, id: viewer.id, name: viewer.name };
  const meta = await requestMeta();

  if (id) {
    const [before] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!before) return { ok: false, error: uz.common.loadError };
    await db.update(clients).set(parsed.data).where(eq(clients.id, id));
    await audit.record(db, {
      actor,
      action: "client.update",
      target: { type: "client", id },
      ...meta,
      metadata: {
        before: { name: before.name, phone: before.phone, company: before.company, status: before.status },
        after: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          company: parsed.data.company,
          status: parsed.data.status,
        },
      },
    });
    revalidatePath("/clients");
    return { ok: true, id };
  }

  const [row] = await db.insert(clients).values(parsed.data).returning({ id: clients.id });
  await audit.record(db, {
    actor,
    action: "client.create",
    target: { type: "client", id: row!.id },
    ...meta,
    metadata: { name: parsed.data.name },
  });
  revalidatePath("/clients");
  return { ok: true, id: row!.id };
}
