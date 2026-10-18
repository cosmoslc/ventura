import { desc, eq, isNull } from "drizzle-orm";
import { can } from "@ventura/auth";
import { projects, smsPackages, smsPurchaseRequests, smsWallets } from "@ventura/db/schema/panel";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { getEskizSettings, venturaEskiz } from "@/lib/server/sms/eskiz";
import { uz } from "@/lib/uz";
import { SmsAdminView } from "./sms-view";

export const metadata = { title: `${uz.sms.title} · ${uz.app.name}` };

/**
 * Ventura SMS paketi (ADR 0056): kutilayotgan to'lovlar, markazlar qoldig'i, paketlar va Ventura Eskiz hisobi.
 * Eskiz balansi jonli so'raladi; javob bermasa sahifa baribir ochiladi.
 */
export default async function SmsAdminPage() {
  const viewer = await requireViewer();
  const { db } = deps();
  const [eskizSettings, ventura, packages, pending, wallets] = await Promise.all([
    getEskizSettings(db),
    venturaEskiz(db),
    db.select().from(smsPackages).orderBy(smsPackages.parts),
    db
      .select({
        id: smsPurchaseRequests.id,
        project: projects.name,
        packageName: smsPurchaseRequests.packageName,
        parts: smsPurchaseRequests.parts,
        price: smsPurchaseRequests.price,
        requestedBy: smsPurchaseRequests.requestedBy,
        createdAt: smsPurchaseRequests.createdAt,
      })
      .from(smsPurchaseRequests)
      .innerJoin(projects, eq(projects.id, smsPurchaseRequests.projectId))
      .where(eq(smsPurchaseRequests.status, "pending"))
      .orderBy(desc(smsPurchaseRequests.createdAt)),
    db
      .select({ id: projects.id, name: projects.name, slug: projects.slug, balance: smsWallets.balance })
      .from(projects)
      .leftJoin(smsWallets, eq(smsWallets.projectId, projects.id))
      .where(isNull(projects.deletedAt))
      .orderBy(projects.name),
  ]);

  let balance: number | null = null;
  let eskizError: string | null = null;
  if (ventura) {
    try {
      balance = await ventura.eskiz.balance();
    } catch (e) {
      eskizError = (e as Error).message;
    }
  }

  return (
    <SmsAdminView
      canEdit={can(viewer.role, "settings.manage")}
      eskiz={{ ...eskizSettings, connected: !!ventura, balance, error: eskizError }}
      packages={packages.map(({ id, name, parts, price, active }) => ({ id, name, parts, price, active }))}
      pending={pending.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      wallets={wallets.map((w) => ({ ...w, balance: w.balance ?? 0 }))}
    />
  );
}
