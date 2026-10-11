import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { normalizeHost } from "@ventura/tenants";
import { Badge } from "@ventura/ui/badge";
import { Card, CardContent } from "@ventura/ui/card";
import { Logo } from "@ventura/ui/logo";
import { commit, tenantForHost } from "@/lib/tenant";
import { uz } from "@/lib/uz";

/* Boshlang'ich sahifa: deploy ishlaganini va mijoz to'g'ri aniqlanganini ko'rsatadi. Haqiqiy bo'limlar — E0 dan. */
export default async function HomePage() {
  const host = (await headers()).get("host");
  const tenant = tenantForHost(host);
  if (!tenant) notFound();

  const rows: [string, string][] = [
    [uz.slug, tenant.slug],
    [uz.domain, normalizeHost(host)],
    [uz.features, String(tenant.features.length)],
    [uz.version, commit()?.slice(0, 7) ?? "—"],
  ];

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo name={tenant.name} />
        </div>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div>
              <Badge tone="info" dot>
                {uz.preparing}
              </Badge>
              <p className="mt-3 text-body text-muted-foreground">{uz.preparingHint}</p>
            </div>
            <dl className="space-y-2 text-body">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-border-soft pb-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate font-mono font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-caption text-muted-foreground">{uz.poweredBy}</p>
      </div>
    </main>
  );
}
