import { and, eq, isNull } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { projects } from "@ventura/db/schema/panel";
import { escapeHtml } from "@ventura/integrations";
import { audit } from "@ventura/security";
import { WORKER_ACTOR } from "@ventura/deploy";

/*
 * 7 kunlik sinov muddati tugagan loyihalarni avtomatik to'xtatish (muzlatish).
 * Muallif / Agent: Google Gemini
 */

export async function checkTrialExpirations(db: PanelDb, notify: (html: string) => Promise<void>) {
  try {
    const activeProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        settings: projects.settings,
      })
      .from(projects)
      .where(and(eq(projects.status, "active"), isNull(projects.deletedAt)));

    const now = Date.now();
    for (const p of activeProjects) {
      const s = (p.settings ?? {}) as Record<string, unknown>;
      const trial = s.trial as { active?: boolean; expiresAt?: string } | undefined;
      if (trial?.active && trial.expiresAt) {
        const expTime = new Date(trial.expiresAt).getTime();
        if (!isNaN(expTime) && expTime <= now) {
          await db.update(projects).set({ status: "paused" }).where(eq(projects.id, p.id));
          await audit.record(db, {
            actor: WORKER_ACTOR,
            action: "project.trial_expired",
            target: { type: "project", id: p.id },
            metadata: { name: p.name, slug: p.slug, expiresAt: trial.expiresAt },
          });
          await notify(
            `⏳ <b>${escapeHtml(p.name)} (<code>${escapeHtml(p.slug)}</code>)</b> loyihasining 7 kunlik bepul sinov muddati tugadi va tizim avtomatik muzlatildi (to'xtatildi).`,
          ).catch(() => {});
          console.log(`[worker] trial expired for ${p.slug} → paused`);
        }
      }
    }
  } catch (err: any) {
    console.error("[worker] checkTrialExpirations error:", err.message);
  }
}
