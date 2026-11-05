import "server-only";
import { allTenants, currentTenant } from "./tenant";
import { getDbSettings } from "./settings";
import type { StoreBranding } from "../store-context";

export async function getStoreBranding(): Promise<StoreBranding> {
  let tenant = null;
  try {
    tenant = (await currentTenant()) ?? null;
  } catch {
    tenant = null;
  }

  // Agar bitta tenant bo'lsa (masalan dedicated rejimda), lekin host mos kelmagan bo'lsa (IP yoki boshqa port bilan kirilganda)
  if (!tenant) {
    try {
      const all = allTenants();
      if (all.length === 1) {
        tenant = all[0];
      }
    } catch {
      tenant = null;
    }
  }

  // Agar aniqlangan tenant PC CRM ga tegishli bo'lmasa (masalan: boshqa sawmill yoki edu loyihasi bo'lsa),
  // uni qabul qilmaymiz, toza Ventura PC brendini saqlaymiz.
  if (
    tenant &&
    tenant.slug !== "ventura-pc" &&
    tenant.slug !== "pc-crm" &&
    !tenant.features?.includes("catalog") &&
    !tenant.features?.includes("inventory") &&
    !tenant.features?.includes("pc_builder") &&
    !tenant.features?.includes("products")
  ) {
    tenant = null;
  }

  let name = tenant?.name || "Ventura PC Store";
  let slug = tenant?.slug || "ventura-pc";
  let logoUrl = tenant?.brand?.logoUrl ?? null;
  let primary = tenant?.brand?.primary ?? null;
  let appearance: "light" | "dark" | "system" = tenant?.brand?.appearance ?? "system";
  let storeMode: "financial" | "inventory" =
    (tenant?.storeMode as "financial" | "inventory" | undefined) ?? "financial";
  let phone = "+998 71 200 00 00";
  let telegram = "@venturapc_operator";
  let address = "Toshkent shahri, Yunusobod tumani";
  let email = "info@venturapc.uz";

  try {
    const settings = await getDbSettings();
    const branding = settings.store_branding as {
      storeName?: string;
      slug?: string;
      logoUrl?: string;
      primary?: string;
      primaryColor?: string;
      appearance?: "light" | "dark" | "system";
      storeMode?: "financial" | "inventory";
    } | undefined;
    const contacts = settings.store_contacts as {
      storeName?: string;
      phone?: string;
      storePhone?: string;
      telegram?: string;
      storeTelegram?: string;
      address?: string;
      storeAddress?: string;
      email?: string;
    } | undefined;

    if ((settings as Record<string, unknown>).store_mode === "financial" || (settings as Record<string, unknown>).store_mode === "inventory") {
      storeMode = (settings as Record<string, unknown>).store_mode as "financial" | "inventory";
    } else if (branding?.storeMode === "financial" || branding?.storeMode === "inventory") {
      storeMode = branding.storeMode;
    }

    if (branding?.appearance === "light" || branding?.appearance === "dark" || branding?.appearance === "system") {
      appearance = branding.appearance;
    }

    if (branding?.storeName?.trim()) {
      name = branding.storeName.trim();
    } else if (contacts?.storeName?.trim()) {
      name = contacts.storeName.trim();
    }

    if (branding?.slug?.trim()) {
      slug = branding.slug.trim();
    }
    if (branding?.logoUrl) {
      logoUrl = branding.logoUrl;
    }
    if (branding?.primary?.trim()) {
      primary = branding.primary.trim().replace(/^"+|"+$/g, "");
    } else if (branding?.primaryColor?.trim()) {
      primary = branding.primaryColor.trim().replace(/^"+|"+$/g, "");
    }

    const p = contacts?.storePhone || contacts?.phone;
    if (p?.trim()) phone = p.trim();

    const tg = contacts?.storeTelegram || contacts?.telegram;
    if (tg?.trim()) telegram = tg.trim();

    const addr = contacts?.storeAddress || contacts?.address;
    if (addr?.trim()) address = addr.trim();

    if (contacts?.email?.trim()) email = contacts.email.trim();
  } catch {
    // If DB is unavailable during build/early load, use tenant or fallback
  }

  return {
    name,
    slug,
    logoUrl,
    primary,
    appearance,
    storeMode,
    contacts: {
      phone,
      telegram,
      address,
      email,
    },
  };
}
