// Muallif / Agent: Google Gemini
"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { normalizeUzPhone, notifySuperAdmins } from "@ventura/auth";
import {
  clients,
  domains,
  projectFeatures,
  projects,
  servers,
  templates,
} from "@ventura/db/schema/panel";
import { requestDeployment } from "@ventura/deploy";
import { escapeHtml } from "@ventura/integrations";
import { audit, putSecret } from "@ventura/security";
import { type Feature, withRequirements } from "@ventura/tenants";
import { BASE_DOMAIN } from "@/lib/project-rules";
import { deps, queue } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const RESERVED_SLUGS = new Set([
  "admin",
  "crm",
  "panel",
  "api",
  "app",
  "auth",
  "login",
  "www",
  "mail",
  "smtp",
  "imap",
  "pop",
  "ns1",
  "ns2",
  "dns",
  "root",
  "support",
  "help",
  "billing",
  "status",
  "test",
  "dev",
  "staging",
  "prod",
  "ventura",
  "edu",
  "dashboard",
  "internal",
  "vps",
  "server",
  "demo",
  "sample",
  "static",
  "assets",
  "public",
  "file",
  "files",
  "storage",
]);

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export async function checkCrmSlugAvailability(rawSlug: string): Promise<{ available: boolean; error?: string }> {
  const slug = rawSlug.trim().toLowerCase();
  if (!slug) {
    return { available: false, error: "Subdomen nomini kiriting" };
  }
  if (slug.length < 3) {
    return { available: false, error: "Subdomen kamida 3 ta belgidan iborat bo'lishi kerak" };
  }
  if (slug.length > 40) {
    return { available: false, error: "Subdomen 40 ta belgidan oshmasligi kerak" };
  }
  if (!SLUG_REGEX.test(slug)) {
    return {
      available: false,
      error: "Faqat kichik lotin harflari, raqamlar va chiziqcha (-) ishlatilishi mumkin",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { available: false, error: "Ushbu subdomen tizim tomonidan band qilingan" };
  }

  const { db } = deps();
  const [takenProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
    .limit(1);

  if (takenProject) {
    return { available: false, error: "Bu subdomen allaqachon band qilingan" };
  }

  const hostname = `${slug}.${BASE_DOMAIN}`;
  const [takenDomain] = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.hostname, hostname))
    .limit(1);

  if (takenDomain) {
    return { available: false, error: "Bu manzil allaqachon band qilingan" };
  }

  return { available: true };
}

const trialInputSchema = z.object({
  centerName: z
    .string()
    .trim()
    .min(2, "O'quv markaz nomi kamida 2 ta belgidan iborat bo'lishi kerak")
    .max(100, "Markaz nomi 100 ta belgidan oshmasligi kerak"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      SLUG_REGEX,
      "Subdomen faqat kichik lotin harflari, raqamlar va o'rtadagi chiziqchadan iborat bo'lishi kerak (3-40 belgi)",
    ),
  ownerName: z
    .string()
    .trim()
    .min(2, "Rahbar ismi kamida 2 ta belgidan iborat bo'lishi kerak")
    .max(100, "Ism 100 ta belgidan oshmasligi kerak"),
  ownerPhone: z.string().trim().min(9, "Telefon raqami noto'g'ri kiritildi"),
  ownerPassword: z
    .string()
    .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak")
    .max(128, "Parol 128 ta belgidan oshmasligi kerak"),
});

export async function startFreeTrialAction(input: unknown): Promise<Result<{ slug: string; url: string; centerName: string }>> {
  const parsed = trialInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri kiritildi" };
  }
  const v = parsed.data;

  // 1. Slug availability
  const check = await checkCrmSlugAvailability(v.slug);
  if (!check.available) {
    return { ok: false, error: check.error ?? "Subdomen band" };
  }

  // 2. Normalize phone
  const normalizedPhone = normalizeUzPhone(v.ownerPhone);
  if (!normalizedPhone) {
    return { ok: false, error: "Telefon raqami O'zbekiston formati bo'lishi kerak (+998 ...)" };
  }

  const { db, telegram } = deps();
  const meta = await requestMeta();

  // 3. Find active server (vps1)
  const [server] = await db
    .select({ id: servers.id, name: servers.name })
    .from(servers)
    .where(eq(servers.status, "ready"))
    .limit(1);

  if (!server) {
    return { ok: false, error: "Hozirda serverda texnik ishlar olib borilmoqda. Iltimos, keyinroq urinib ko'ring." };
  }

  // 4. Resolve template features for edu-crm
  const [tpl] = await db.select().from(templates).where(eq(templates.key, "edu-crm")).limit(1);
  if (!tpl) {
    return { ok: false, error: "Tizim shabloni topilmadi" };
  }
  const manifest = tpl.manifest as Feature[];
  const allFeatureKeys = manifest.map((f) => f.key);
  const enabledFeatures = withRequirements(manifest, allFeatureKeys);
  const featuresToInsert = manifest
    .filter((f) => f.type !== "mode")
    .map((f) => ({ featureKey: f.key, enabled: enabledFeatures.has(f.key) }));

  // 5. 7-day trial timing
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const primaryHostname = `${v.slug}.${BASE_DOMAIN}`;
  const localHostname = `${v.slug}.localhost`;

  const projectId = await db.transaction(async (tx) => {
    // A. Create Client
    const [client] = await tx
      .insert(clients)
      .values({
        name: v.centerName,
        phone: normalizedPhone,
        company: v.centerName,
        note: "crm.ventura.uz orqali 7 kunlik bepul sinov",
        status: "active",
      })
      .returning({ id: clients.id });

    // B. Create Project
    const [project] = await tx
      .insert(projects)
      .values({
        clientId: client!.id,
        templateKey: "edu-crm",
        slug: v.slug,
        name: v.centerName,
        mode: "shared",
        target: "home",
        dbStrategy: "shared_db",
        status: "draft",
        brand: {
          primary: "#4f46e5",
          appearance: "light",
        },
        settings: {
          trial: {
            active: true,
            days: 7,
            startedAt: now.toISOString(),
            expiresAt: trialEndsAt.toISOString(),
          },
          storageLimitMb: 10240, // 10 GB trial storage
        },
        ownerName: v.ownerName,
        ownerPhone: normalizedPhone,
        serverId: server.id,
      })
      .returning({ id: projects.id });

    const pId = project!.id;

    // C. Insert Features
    if (featuresToInsert.length) {
      await tx.insert(projectFeatures).values(featuresToInsert.map((f) => ({ ...f, projectId: pId })));
    }

    // D. Insert Domains
    await tx.insert(domains).values([
      { projectId: pId, hostname: primaryHostname, kind: "subdomain", isPrimary: true, status: "active" },
      { projectId: pId, hostname: localHostname, kind: "subdomain", isPrimary: false, status: "active" },
    ]);

    return pId;
  });

  // 6. Put secret owner_password
  await putSecret(db, { type: "project", id: projectId }, "owner_password", v.ownerPassword);

  // 7. Queue deployment job
  let queueError: string | null = null;
  try {
    const q = await queue();
    const deployRes = await requestDeployment(db, q, {
      projectId,
      actor: { type: "system", name: "crm-trial" },
      ...meta,
    });
    if (!deployRes.ok) {
      queueError = deployRes.reason;
    }
  } catch (err) {
    console.error("[crm-trial] Deploy navbatiga qo'shishda xato:", err);
    queueError = (err as Error).message;
  }

  // 8. Record audit
  await audit.record(db, {
    actor: { type: "system", name: "crm-trial" },
    action: "crm.trial_registered",
    target: { type: "project", id: projectId },
    ...meta,
    metadata: {
      centerName: v.centerName,
      slug: v.slug,
      ownerName: v.ownerName,
      phone: normalizedPhone,
      trialEndsAt: trialEndsAt.toISOString(),
      queueError,
    },
  });

  // 9. Notify SuperAdmins via Telegram
  const trialEndFormatted = trialEndsAt.toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  await notifySuperAdmins(
    { db, telegram },
    `🚀 <b>Yangi 7 kunlik bepul sinov boshlandi!</b>\n\n🏢 <b>O'quv markaz:</b> ${escapeHtml(v.centerName)}\n🌐 <b>Manzil:</b> https://${escapeHtml(primaryHostname)}\n👤 <b>Rahbar:</b> ${escapeHtml(v.ownerName)} (<code>${escapeHtml(normalizedPhone)}</code>)\n⏳ <b>Muddat:</b> 7 kun (${escapeHtml(trialEndFormatted)} gacha)\n💾 <b>Ajratilgan xotira:</b> 10 GB`,
  );

  return {
    ok: true,
    slug: v.slug,
    url: `https://${primaryHostname}`,
    centerName: v.centerName,
  };
}
