import type { Tenant } from "@ventura/tenants";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("./tenant", () => ({
  currentTenant: vi.fn(),
  allTenants: vi.fn(),
}));

vi.mock("./settings", () => ({
  getDbSettings: vi.fn(),
}));

import { currentTenant, allTenants } from "./tenant";
import { getDbSettings } from "./settings";
import { getStoreBranding } from "./branding";

describe("getStoreBranding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PC CRM loyihasi (features: ['catalog']) uchun tenant brend rangini to'g'ri oladi", async () => {
    vi.mocked(currentTenant).mockResolvedValue({
      slug: "quadra-mi",
      name: "Quadra mi",
      hosts: ["quadra-mi.ventura.uz"],
      brand: {
        primary: "#059669",
        appearance: "light",
        logoUrl: "https://example.com/logo.png",
      },
      features: ["catalog", "inventory", "sales"],
    } as unknown as Tenant);

    vi.mocked(getDbSettings).mockResolvedValue({});

    const branding = await getStoreBranding();
    expect(branding.name).toBe("Quadra mi");
    expect(branding.slug).toBe("quadra-mi");
    expect(branding.primary).toBe("#059669");
    expect(branding.logoUrl).toBe("https://example.com/logo.png");
    expect(branding.appearance).toBe("light");
  });

  it("baza sozlamalarida primary bo'lsa, u tenant rangidan ustun turadi", async () => {
    vi.mocked(currentTenant).mockResolvedValue({
      slug: "quadra-mi",
      name: "Quadra mi",
      hosts: ["quadra-mi.ventura.uz"],
      brand: {
        primary: "#059669",
        appearance: "light",
      },
      features: ["catalog"],
    } as unknown as Tenant);

    vi.mocked(getDbSettings).mockResolvedValue({
      store_branding: {
        primary: "#27ae60",
        storeName: "Custom Quadra Store",
      },
    });

    const branding = await getStoreBranding();
    expect(branding.name).toBe("Custom Quadra Store");
    expect(branding.primary).toBe("#27ae60");
  });

  it("currentTenant null bo'lganda lekin allTenants bitta bo'lsa (dedicated), o'sha tenantni ishlatadi", async () => {
    vi.mocked(currentTenant).mockResolvedValue(null);
    vi.mocked(allTenants).mockReturnValue([
      {
        slug: "quadra-mi",
        name: "Quadra Dedicated",
        hosts: ["quadra-mi.ventura.uz"],
        brand: {
          primary: "#16a34a",
          appearance: "dark",
        },
        features: ["catalog", "orders"],
      } as unknown as Tenant,
    ]);

    vi.mocked(getDbSettings).mockResolvedValue({});

    const branding = await getStoreBranding();
    expect(branding.name).toBe("Quadra Dedicated");
    expect(branding.primary).toBe("#16a34a");
    expect(branding.appearance).toBe("dark");
  });

  it("PC CRM ga aloqasi bo'lmagan tenant bo'lsa (boshqa loyiha), standart Ventura PC fallback qaytadi", async () => {
    vi.mocked(currentTenant).mockResolvedValue({
      slug: "other-school",
      name: "Other School",
      hosts: ["school.ventura.uz"],
      brand: {
        primary: "#dc2626",
        appearance: "light",
      },
      features: ["students", "attendance"],
    } as unknown as Tenant);

    vi.mocked(getDbSettings).mockResolvedValue({});

    const branding = await getStoreBranding();
    expect(branding.name).toBe("Ventura PC Store");
    expect(branding.slug).toBe("ventura-pc");
    expect(branding.primary).toBeNull();
  });
});
