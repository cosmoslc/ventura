import { z } from "zod";

/*
 * Mijozlar ro'yxati (tenant registry): `shared` rejimdagi bitta ilova qaysi domen qaysi mijozniki ekanini
 * shu fayldan biladi. Panel deploy paytida yozadi, ilova o'qiydi. Faylda sirlar bo'lmaydi.
 */

export const tenantSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  /** Shu mijozga tegishli domenlar (kichik harflarda, portsiz) */
  hosts: z.array(z.string().min(1)).min(1),
  brand: z.object({
    primary: z.string().regex(/^#[0-9a-f]{6}$/i),
    appearance: z.enum(["light", "dark", "system"]),
    /** Logotip: https manzil yoki ilova ichidagi yo'l. Berilmasa Ventura belgisi. */
    logoUrl: z
      .string()
      .regex(/^(https:\/\/|\/(?!\/))\S+$/, "logo: https:// yoki / bilan boshlanadi")
      .optional(),
  }),
  /** Yoqilgan bo'limlar kalitlari */
  features: z.array(z.string()),
  /** Xotira limiti (MB da). Belgilanmagan bo'lsa standart 5120 MB (5 GB) */
  storageLimitMb: z.number().int().positive().optional(),
  /** Loyiha holati: faol yoki to'xtatilgan/muzlatilgan */
  status: z.enum(["draft", "active", "paused"]).default("active").optional(),
});

export const tenantRegistrySchema = z.object({
  version: z.literal(1),
  tenants: z.array(tenantSchema),
});

export type Tenant = z.infer<typeof tenantSchema>;
export type TenantRegistry = z.infer<typeof tenantRegistrySchema>;

/** `Host` sarlavhasidan domen: kichik harf, portsiz. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function findTenant(registry: TenantRegistry, host: string | null | undefined): Tenant | null {
  const name = normalizeHost(host);
  if (!name) return null;
  return registry.tenants.find((t) => t.hosts.includes(name)) ?? null;
}

/** Mijozni qo'shadi yoki yangilaydi (slug bo'yicha). Bitta domen ikki mijozga tegishli bo'lolmaydi. */
export function upsertTenant(registry: TenantRegistry, tenant: Tenant): TenantRegistry {
  const others = registry.tenants.filter((t) => t.slug !== tenant.slug);
  const taken = others.find((t) => t.hosts.some((h) => tenant.hosts.includes(h)));
  if (taken) throw new Error(`Domen boshqa mijozga tegishli: ${taken.slug}`);
  return { version: 1, tenants: [...others, tenant].sort((a, b) => a.slug.localeCompare(b.slug)) };
}

export function removeTenant(registry: TenantRegistry, slug: string): TenantRegistry {
  return { version: 1, tenants: registry.tenants.filter((t) => t.slug !== slug) };
}

export const emptyRegistry = (): TenantRegistry => ({ version: 1, tenants: [] });

/** Fayl mazmunini o'qiydi; bo'sh yoki buzilgan bo'lsa xato tashlaydi (jim o'tib ketmaydi). */
export function parseRegistry(text: string): TenantRegistry {
  return tenantRegistrySchema.parse(JSON.parse(text));
}
