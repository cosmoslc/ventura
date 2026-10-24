import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { type PanelDb, createTenantDb } from "@ventura/db";
import { projects } from "@ventura/db/schema/panel";
import { users } from "@ventura/db/schema/tenant";
import { WORKER_ACTOR, dbNameFor, dbPasswordOwner } from "@ventura/deploy";
import { type Telegram, escapeHtml } from "@ventura/integrations";
import { audit, readSecret } from "@ventura/security";

/*
 * Loyihalarning oylik obuna va 7 kunlik sinov muddatini tekshirish:
 * 1. Muddat tugashiga 1 kun qolganda rahbar botiga va superadminga eslatma yuborish.
 * 2. Muddat tugaganda tizimni avtomatik muzlatish (status = 'paused').
 * Muallif / Agent: Google Gemini
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function findDirectorChatId(
  panelDb: PanelDb,
  project: { id: string; templateKey: string; slug: string; dbStrategy: string; serverId: string | null },
): Promise<string | null> {
  try {
    const dbName = dbNameFor(project.templateKey, project.slug, project.dbStrategy);
    const pwOwner = dbPasswordOwner(
      project.dbStrategy === "shared_db" ? "shared" : "project",
      { serverId: project.serverId ?? "", projectId: project.id },
      dbName,
    );
    const dbPassword = await readSecret(panelDb, pwOwner.owner, pwOwner.name);
    if (!dbPassword) return null;
    const databaseUrl = `postgres://${dbName}:${encodeURIComponent(dbPassword)}@127.0.0.1:5432/${dbName}`;
    const tenantDb = createTenantDb(databaseUrl, project.slug, { max: 1 });
    const [row] = await tenantDb
      .select({ telegramChatId: users.telegramChatId })
      .from(users)
      .where(and(isNotNull(users.telegramChatId), isNull(users.archivedAt)))
      .limit(1);
    return row?.telegramChatId ?? null;
  } catch {
    return null;
  }
}

export async function checkTrialExpirations(
  db: PanelDb,
  notify: (html: string) => Promise<void>,
  telegram?: Telegram,
) {
  try {
    const activeProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        templateKey: projects.templateKey,
        dbStrategy: projects.dbStrategy,
        serverId: projects.serverId,
        settings: projects.settings,
      })
      .from(projects)
      .where(and(eq(projects.status, "active"), isNull(projects.deletedAt)));

    const now = Date.now();
    for (const p of activeProjects) {
      const s = (p.settings ?? {}) as Record<string, unknown>;
      const sub = s.subscription as
        | {
            active?: boolean;
            paidUntil?: string;
            monthlyPrice?: number;
            reminderSentFor?: string | null;
            plan?: string;
          }
        | undefined;
      const trial = s.trial as
        | {
            active?: boolean;
            expiresAt?: string;
            reminderSentFor?: string | null;
          }
        | undefined;

      let kind: "subscription" | "trial" | null = null;
      let expTime: number | null = null;
      let expDateStr: string | null = null;
      let reminderSent = false;
      let monthlyPrice = 300_000;

      if (sub?.active && sub.paidUntil) {
        kind = "subscription";
        expDateStr = sub.paidUntil;
        expTime = new Date(sub.paidUntil).getTime();
        reminderSent = sub.reminderSentFor === sub.paidUntil;
        monthlyPrice = typeof sub.monthlyPrice === "number" ? sub.monthlyPrice : 300_000;
      } else if (trial?.active && trial.expiresAt) {
        kind = "trial";
        expDateStr = trial.expiresAt;
        expTime = new Date(trial.expiresAt).getTime();
        reminderSent = trial.reminderSentFor === trial.expiresAt;
      }

      if (!kind || !expTime || isNaN(expTime) || !expDateStr) {
        continue;
      }

      const timeLeftMs = expTime - now;

      // 1. Muddat tugashiga 1 kun (yoki undan kam) qolganda ogohlantirish (eslatma)
      if (timeLeftMs > 0 && timeLeftMs <= ONE_DAY_MS && !reminderSent) {
        const nextSettings = {
          ...s,
          ...(kind === "subscription"
            ? { subscription: { ...sub, reminderSentFor: expDateStr } }
            : { trial: { ...trial, reminderSentFor: expDateStr } }),
        };

        await db.update(projects).set({ settings: nextSettings }).where(eq(projects.id, p.id));

        const expFormatted = new Date(expTime).toLocaleDateString("uz-UZ");

        // Super adminga xabar
        await notify(
          `⚠️ <b>${escapeHtml(p.name)} (<code>${escapeHtml(p.slug)}</code>)</b> loyihasining ${
            kind === "subscription" ? "oylik to'lov" : "7 kunlik sinov"
          } muddati ertaga (<b>${expFormatted}</b>) tugaydi. 1 kun qoldi.`,
        ).catch(() => {});

        // Rahbarga Telegram orqali eslatma
        const directorChatId = await findDirectorChatId(db, p);
        if (directorChatId && telegram) {
          const userMsg =
            kind === "subscription"
              ? `🔔 <b>Hurmatli rahbar!</b>\n\n` +
                `<b>${escapeHtml(p.name)}</b> o'quv markazingiz tizimining oylik obuna muddati ertaga (<b>${expFormatted}</b>) tugaydi.\n\n` +
                `💳 Oylik to'lov summasi: <b>${monthlyPrice.toLocaleString("uz-UZ")} so'm</b>\n` +
                `Tizim uzluksiz ishlashi uchun to'lovni o'z vaqtida amalga oshirishingizni so'raymiz.`
              : `🔔 <b>Hurmatli rahbar!</b>\n\n` +
                `<b>${escapeHtml(p.name)}</b> o'quv markazingizning 7 kunlik bepul sinov muddati ertaga (<b>${expFormatted}</b>) tugaydi.\n\n` +
                `Tizim to'xtab qolmasligi uchun doimiy tarifga o'tishingizni so'raymiz.`;

          await telegram.sendMessage(directorChatId, userMsg).catch((err) => {
            console.log(`[worker] could not send telegram reminder to ${p.slug}:`, (err as Error).message);
          });
        }
        console.log(`[worker] sent 1-day reminder for ${p.slug}`);
      }

      // 2. Muddat tugaganda avtomatik muzlatish (to'xtatish)
      if (expTime <= now) {
        await db.update(projects).set({ status: "paused" }).where(eq(projects.id, p.id));
        await audit.record(db, {
          actor: WORKER_ACTOR,
          action: kind === "subscription" ? "project.subscription_expired" : "project.trial_expired",
          target: { type: "project", id: p.id },
          metadata: { name: p.name, slug: p.slug, expiresAt: expDateStr },
        });

        await notify(
          `❄️ <b>${escapeHtml(p.name)} (<code>${escapeHtml(p.slug)}</code>)</b> loyihasining to'lov muddati tugadi va tizim avtomatik <b>muzlatildi (to'xtatildi)</b>.`,
        ).catch(() => {});

        const directorChatId = await findDirectorChatId(db, p);
        if (directorChatId && telegram) {
          const freezeMsg =
            `❄️ <b>Diqqat: Tizim to'xtatildi!</b>\n\n` +
            `<b>${escapeHtml(p.name)}</b> o'quv markazingiz tizimining to'lov muddati tugagani sababli tizim vaqtincha muzlatildi.\n\n` +
            `Tizimni qayta faollashtirish uchun abonent to'lovini amalga oshiring va ma'muriyat bilan bog'laning.`;
          await telegram.sendMessage(directorChatId, freezeMsg).catch(() => {});
        }
        console.log(`[worker] ${kind} expired for ${p.slug} → paused`);
      }
    }
  } catch (err: any) {
    console.error("[worker] checkTrialExpirations error:", err.message);
  }
}
