import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { STAFF_ROLE_HINTS, STAFF_ROLE_LABELS, can } from "@ventura/auth/staff/policy";
import { navFor } from "@ventura/tenants";
import { Card, CardContent } from "@ventura/ui/card";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { features } from "@/lib/manifest";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { FeatureIcon } from "./crm-shell";

export const metadata = { title: uz.home.title };

/** Bosh sahifa (E0): kim kirgani, qaysi filiallar va qaysi bo'limlar ochiq. Ko'rsatkichlar — E5. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ ruxsat?: string }> }) {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  const { ruxsat } = await searchParams;
  const links = navFor(features, tenant.features, (key) => can(staff.role, `${key}.view`)).flatMap((g) => g.links);
  const branches = staff.scope === "all" ? uz.home.allBranches : uz.home.branchCount(staff.scope.length);

  return (
    <div className="space-y-6">
      <PageHeader title={uz.home.greeting(staff.name)} description={tenant.name} />
      {ruxsat === "yoq" ? <Notice tone="warning">{uz.home.noPermission}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <ShieldCheck className="mt-0.5 size-5 text-primary-text" />
            <div>
              <div className="text-caption text-muted-foreground">{uz.home.role}</div>
              <div className="text-body font-bold text-foreground">{STAFF_ROLE_LABELS[staff.role]}</div>
              <div className="text-caption text-muted-foreground">{STAFF_ROLE_HINTS[staff.role]}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <Building2 className="mt-0.5 size-5 text-primary-text" />
            <div>
              <div className="text-caption text-muted-foreground">{uz.home.branches}</div>
              <div className="text-body font-bold text-foreground">{branches}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="type-heading text-title text-foreground">{uz.home.sections}</h2>
        <p className="mt-1 text-body text-muted-foreground">{uz.home.sectionsHint}</p>
        {links.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="group">
                <Card className="transition-shadow group-hover:shadow-card-hover">
                  <CardContent className="flex items-center gap-3 pt-6">
                    <FeatureIcon feature={l.feature} href={l.href} className="size-5" />
                    <span className="flex-1 text-body font-semibold text-foreground">{l.label}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <EmptyState icon={<ShieldCheck />} title={uz.home.noSections} description={uz.home.noSectionsHint} />
          </Card>
        )}
      </section>
    </div>
  );
}
