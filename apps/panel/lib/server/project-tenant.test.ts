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
  }, 20000);
});
