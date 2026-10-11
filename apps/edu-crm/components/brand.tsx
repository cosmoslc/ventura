import { Logo } from "@ventura/ui/logo";
import type { Tenant } from "@ventura/tenants";

/** Markaz logotipi (brenddan); berilmasa Logo o'zining belgisini chizadi. */
export function brandMark(tenant: Pick<Tenant, "brand">): React.ReactNode {
  const src = tenant.brand.logoUrl;
  // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, o'lchami Logo ichida qat'iy
  return src ? <img src={src} alt="" /> : undefined;
}

export function TenantLogo({ tenant, subtitle }: { tenant: Pick<Tenant, "brand" | "name">; subtitle?: string }) {
  return <Logo name={tenant.name} mark={brandMark(tenant)} subtitle={subtitle} />;
}
