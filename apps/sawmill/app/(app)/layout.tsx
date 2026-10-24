import { requireUser } from "@/lib/server/session";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireUser();

  return (
    <Shell
      tenantName={tenant.name}
      user={user}
      enabledFeatures={tenant.features}
    >
      {children}
    </Shell>
  );
}
