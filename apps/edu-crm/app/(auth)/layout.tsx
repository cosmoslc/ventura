import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { TenantLogo } from "@/components/brand";
import { requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";

/** Kirish sahifalari: shell'siz, markazda kartochka, tepada markaz logotipi. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <TenantLogo tenant={tenant} subtitle={uz.app.subtitle} />
        </div>
        {children}
        <p className="mt-6 text-center text-caption text-muted-foreground">{uz.poweredBy}</p>
      </div>
    </div>
  );
}
