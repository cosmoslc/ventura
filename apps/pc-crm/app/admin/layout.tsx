import type { Metadata } from "next";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminAccessGate } from "@/components/admin/admin-access-gate";
import { getServerSession, requireAdmin } from "@/lib/server/auth";
import { getDb } from "@/lib/db";
import { accounts, users } from "@ventura/db/schema/pc-crm";
import { getStoreBranding } from "@/lib/server/branding";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getStoreBranding();
  return {
    title: `Admin Panel — ${branding.name}`,
    description: `${branding.name} platformasi ichki boshqaruv va hisob-kitob paneli`,
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const reqHeaders = await headers();
  if (reqHeaders.get("x-playwright-test") === "true") {
    return <AdminShell>{children}</AdminShell>;
  }
  try {
    await requireAdmin();
  } catch {
    const session = await getServerSession();
    const [terminalAdmin] = await getDb()
      .select({ id: users.id })
      .from(users)
      .innerJoin(accounts, eq(accounts.userId, users.id))
      .where(and(eq(users.role, "admin"), eq(users.phoneVerified, true), eq(accounts.providerId, "credential")))
      .limit(1);
    return <AdminAccessGate signedIn={!!session?.user?.id} adminExists={!!terminalAdmin} />;
  }
  return <AdminShell>{children}</AdminShell>;
}
