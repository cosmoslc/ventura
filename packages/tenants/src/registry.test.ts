import { describe, expect, it } from "vitest";
import {
  type Tenant,
  emptyRegistry,
  findTenant,
  normalizeHost,
  parseRegistry,
  removeTenant,
  upsertTenant,
} from "./registry";

const tenant = (slug: string, hosts: string[]): Tenant => ({
  slug,
  name: slug,
  hosts,
  brand: { primary: "#3f6df6", appearance: "light" },
  features: [],
});

describe("mijozlar ro'yxati", () => {
  it("domenni kichik harf va portsiz holga keltiradi", () => {
    expect(normalizeHost("Bilim.Ventura.UZ:443")).toBe("bilim.ventura.uz");
    expect(normalizeHost("bilim.localhost.")).toBe("bilim.localhost");
    expect(normalizeHost(null)).toBe("");
  });

  it("mijozni domen bo'yicha topadi; begona domen — null", () => {
    const registry = upsertTenant(emptyRegistry(), tenant("bilim", ["bilim.ventura.uz", "crm.bilim.uz"]));
    expect(findTenant(registry, "CRM.bilim.uz:80")?.slug).toBe("bilim");
    expect(findTenant(registry, "boshqa.ventura.uz")).toBeNull();
    expect(findTenant(registry, "")).toBeNull();
  });

  it("qayta qo'shilgan mijoz almashtiriladi, ikki marta yozilmaydi", () => {
    let registry = upsertTenant(emptyRegistry(), tenant("bilim", ["bilim.ventura.uz"]));
    registry = upsertTenant(registry, tenant("zakovat", ["zakovat.ventura.uz"]));
    registry = upsertTenant(registry, tenant("bilim", ["bilim.ventura.uz", "crm.bilim.uz"]));
    expect(registry.tenants.map((t) => t.slug)).toEqual(["bilim", "zakovat"]);
    expect(findTenant(registry, "crm.bilim.uz")?.slug).toBe("bilim");
  });

  it("bitta domenni ikki mijozga berib bo'lmaydi", () => {
    const registry = upsertTenant(emptyRegistry(), tenant("bilim", ["bilim.ventura.uz"]));
    expect(() => upsertTenant(registry, tenant("soxta", ["bilim.ventura.uz"]))).toThrow(/boshqa mijozga/);
  });

  it("mijozni olib tashlaydi", () => {
    const registry = upsertTenant(emptyRegistry(), tenant("bilim", ["bilim.ventura.uz"]));
    expect(removeTenant(registry, "bilim").tenants).toEqual([]);
  });

  it("logotip faqat https yoki ilova ichidagi yo'l", () => {
    const withLogo = (logoUrl: string) =>
      JSON.stringify({
        version: 1,
        tenants: [{ ...tenant("bilim", ["bilim.uz"]), brand: { primary: "#3f6df6", appearance: "light", logoUrl } }],
      });
    expect(parseRegistry(withLogo("https://cdn.bilim.uz/logo.png")).tenants[0]!.brand.logoUrl).toBeDefined();
    expect(parseRegistry(withLogo("/brand/bilim.svg")).tenants).toHaveLength(1);
    expect(() => parseRegistry(withLogo("javascript:alert(1)"))).toThrow();
    expect(() => parseRegistry(withLogo("//evil.example/x.png"))).toThrow();
    expect(() => parseRegistry(withLogo("http://bilim.uz/logo.png"))).toThrow();
  });

  it("buzilgan faylni jim qabul qilmaydi", () => {
    expect(() => parseRegistry("{")).toThrow();
    expect(() => parseRegistry('{"version":2,"tenants":[]}')).toThrow();
    expect(parseRegistry(JSON.stringify(emptyRegistry())).tenants).toEqual([]);
  });
});
