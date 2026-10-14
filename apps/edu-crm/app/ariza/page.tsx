import { notFound } from "next/navigation";
import { Card, CardContent } from "@ventura/ui/card";
import { cn } from "@ventura/ui/lib/utils";
import { hasFeature } from "@ventura/tenants";
import { TenantLogo } from "@/components/brand";
import { makeStamp } from "@/lib/apply-stamp";
import { applyPageData, getApplyForm } from "@/lib/server/apply";
import { tenantDeps } from "@/lib/server/deps";
import { requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";
export const metadata = { title: uz.apply.pageTitle, robots: { index: false } };

/**
 * Tashqi ariza sahifasi (E4c, ADR 0026): kirishsiz, markaz logotipi bilan. `?embed=1` — saytdagi iframe uchun:
 * logotip va fon yo'q, forma joyni to'liq egallaydi.
 */
export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const tenant = await requireTenant();
  if (!(await hasFeature(tenant, "leads"))) notFound();
  const deps = tenantDeps(tenant);
  if (!deps) notFound();
  const embed = (await searchParams).embed === "1";
  const form = await getApplyForm(deps.db);
  const data = form.enabled ? await applyPageData(deps.db, form) : null;

  const body = (
    <Card className={cn(embed && "border-0 bg-transparent shadow-none")}>
      <CardContent className={embed ? "p-1" : "p-6"}>
        <h1 className="type-heading text-lg text-foreground">{form.title || uz.apply.defaultTitle}</h1>
        {data ? (
          <>
            <p className="mt-1 whitespace-pre-line text-body text-muted-foreground">
              {form.intro || uz.apply.defaultIntro}
            </p>
            <div className="mt-5">
              <ApplyForm
                stamp={makeStamp(deps.secret, tenant.slug)}
                branches={form.askBranch && data.branches.length > 1 ? data.branches : []}
                defaultBranch={form.branchId}
                courses={form.askCourse ? data.courses : null}
                fields={data.fields}
                success={form.success || uz.apply.defaultSuccess}
              />
            </div>
          </>
        ) : (
          <p className="mt-1 text-body text-muted-foreground">{uz.apply.closed}</p>
        )}
      </CardContent>
    </Card>
  );

  if (embed)
    return (
      <div className="mx-auto w-full max-w-lg">
        {/* Saytdagi iframe: fon saytniki bo'lib qoladi */}
        <style>{"html,body{background:transparent}"}</style>
        {body}
      </div>
    );
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <TenantLogo tenant={tenant} />
        </div>
        {body}
        <p className="mt-6 text-center text-caption text-muted-foreground">{uz.poweredBy}</p>
      </div>
    </div>
  );
}
