import "server-only";
import { allTenants, currentTenant } from "./tenant";
import { getDbSettings } from "./settings";
import type { StoreBranding } from "../store-context";

export async function getStoreBranding(): Promise<StoreBranding> {
  let tenant = null;
  try {
    tenant = (await currentTenant()) ?? allTenants()[0] ?? null;
  } catch {
    tenant = allTenants()[0] ?? null;
  }

  let name = tenant?.name || "Ventura PC";
  let slug = tenant?.slug || "ventura-pc";
  let logoUrl = tenant?.brand?.logoUrl ?? null;
  let phone = "+998 71 200 00 00";
  let telegram = "@venturapc_operator";
  let address = "Toshkent shahri, Yunusobod tumani";
  let email = "info@venturapc.uz";

  try {
    const settings = await getDbSettings();
    const branding = settings.store_branding as { storeName?: string; slug?: string; logoUrl?: string } | undefined;
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
    contacts: {
      phone,
      telegram,
      address,
      email,
    },
  };
}
