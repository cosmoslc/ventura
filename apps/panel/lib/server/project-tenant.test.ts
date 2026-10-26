import { describe, it, expect } from "vitest";
import { createPanelDb } from "@ventura/db";
import { projects } from "@ventura/db/schema/panel";
import { readSecret } from "@ventura/security";
import { getProjectDirectorInfo, getProjectTenantDb, resetProjectDirectorPassword } from "./project-tenant";
import { eq } from "drizzle-orm";

const live = Boolean(process.env.VENTURA_MASTER_KEY_FILE && process.env.PANEL_DATABASE_URL);

describe.skipIf(!live)("project-tenant director management", () => {
  it("fetches director info and resets password for Supabase tenant", async () => {
    const db = createPanelDb(process.env.PANEL_DATABASE_URL || "postgres://ventura_app:svjVhAShSnkUHhtfmUBA8WBn@localhost:5432/ventura_panel");
    const [p] = await db.select().from(projects).where(eq(projects.slug, "kun-uz"));
    if (!p) throw new Error("kun-uz not found");

    const info = await getProjectDirectorInfo(db, p);
    expect(info).not.toBeNull();
    expect(info?.name).toBe("Alisher uzbek");
    expect(info?.phone).toBe("+998900000000");

    const res = await resetProjectDirectorPassword(
      db,
      p.id,
      "20102010",
      { type: "user", id: "00000000-0000-0000-0000-000000000000", name: "Super Admin" },
      { ip: "127.0.0.1" },
    );
    expect(res.ok).toBe(true);

    const updatedOwnerPw = await readSecret(db, { type: "project", id: p.id }, "owner_password");
    expect(updatedOwnerPw).toBe("20102010");

    // Verify password verification works
    const tenantDb = await getProjectTenantDb(db, p);
    expect(tenantDb).not.toBeNull();
    const authSecret = await readSecret(db, { type: "project", id: p.id }, "auth_secret");
    const { createStaffAuth, verifyStaffPassword } = await import("@ventura/auth/staff");
    const auth = createStaffAuth({
      db: tenantDb!,
      telegram: null,
      appName: p.name,
      secret: authSecret!,
      baseURL: "http://localhost",
    });
    const verified = await verifyStaffPassword(auth, info!.id, "20102010");
    expect(verified).toBe(true);

    // Test verifications table standalone operations and Telegram token flow
    const { verifications } = await import("@ventura/db/schema/tenant");
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(9).toString("base64url");
    const LINK_PREFIX = "tg-link:";

    await tenantDb!.delete(verifications).where(eq(verifications.identifier, LINK_PREFIX + info!.id));
    const [inserted] = await tenantDb!.insert(verifications).values({
      identifier: LINK_PREFIX + info!.id,
      value: token,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    }).returning();
    expect(inserted).toBeDefined();
    expect(inserted?.tenantId).toBe("kun-uz");
    expect(inserted?.value).toBe(token);

    const [selected] = await tenantDb!.select().from(verifications).where(eq(verifications.identifier, LINK_PREFIX + info!.id));
    expect(selected).toBeDefined();
    expect(selected?.value).toBe(token);

    await tenantDb!.delete(verifications).where(eq(verifications.identifier, LINK_PREFIX + info!.id));
    const [afterDel] = await tenantDb!.select().from(verifications).where(eq(verifications.identifier, LINK_PREFIX + info!.id));
    expect(afterDel).toBeUndefined();

    // Verify Telegram bot getMe()
    const botToken = await readSecret(db, { type: "project", id: p.id }, "telegram_bot_token");
    if (botToken) {
      const { createTelegram } = await import("@ventura/integrations");
      const tg = createTelegram(botToken);
      const me = await tg.getMe();
      expect(me?.username).toBe("ventura_uz_bot");
    }
  }, 25000);
});
