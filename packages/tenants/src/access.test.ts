import { describe, expect, it } from "vitest";
import { featureForPath, hasFeature, navFor } from "./access";
import { parseManifest } from "./manifest";
import { parseSecrets } from "./secrets";

const { features } = parseManifest({
  template: { key: "edu-crm", name: "O'quv markaz", category: "Ta'lim", version: "0.1.0" },
  features: [
    {
      key: "students",
      name: "O'quvchilar",
      group: "Asos",
      type: "permanent",
      nav: [{ label: "O'quvchilar", href: "/students" }],
    },
    {
      key: "groups",
      name: "Guruhlar",
      group: "Asos",
      type: "core",
      requires: ["students"],
      nav: [
        { label: "Guruhlar", href: "/groups" },
        { label: "Xonalar", href: "/rooms", section: "Ofis" },
      ],
    },
    {
      key: "attendance",
      name: "Davomat",
      group: "Davomat",
      type: "regular",
      routes: ["/api/attendance"],
      nav: [{ label: "Davomat", href: "/attendance" }],
    },
    {
      key: "attendance_reports",
      name: "Davomat hisoboti",
      group: "Hisobotlar",
      type: "regular",
      nav: [{ label: "Davomat hisoboti", href: "/attendance/reports" }],
    },
    { key: "branches", name: "Ko'p filialli rejim", group: "Asos", type: "mode" },
  ],
});

describe("bo'limlar ilova ichida", () => {
  it("hasFeature faqat yoqilganlar uchun true", async () => {
    const tenant = { features: ["students", "groups"] };
    expect(await hasFeature(tenant, "groups")).toBe(true);
    expect(await hasFeature(tenant, "attendance")).toBe(false);
  });

  it("manzil bo'limini menyu va API yo'li bo'yicha topadi", () => {
    expect(featureForPath(features, "/students")).toBe("students");
    expect(featureForPath(features, "/students/42/edit")).toBe("students");
    expect(featureForPath(features, "/api/attendance/mark")).toBe("attendance");
    expect(featureForPath(features, "/studentsx")).toBeNull();
    expect(featureForPath(features, "/")).toBeNull();
    expect(featureForPath(features, "/login")).toBeNull();
  });

  it("ichma-ich manzillarda eng uzun prefiks yutadi", () => {
    expect(featureForPath(features, "/attendance/reports/2026")).toBe("attendance_reports");
    expect(featureForPath(features, "/attendance/today")).toBe("attendance");
  });

  it("menyu: o'chirilgan va ruxsatsiz bo'lim ko'rinmaydi, bo'sh guruh tushib qoladi", () => {
    const nav = navFor(features, ["students", "groups", "attendance_reports"], (k) => k !== "attendance_reports");
    expect(nav).toEqual([
      {
        title: "Asos",
        links: [
          { feature: "students", label: "O'quvchilar", href: "/students" },
          { feature: "groups", label: "Guruhlar", href: "/groups" },
        ],
      },
      { title: "Ofis", links: [{ feature: "groups", label: "Xonalar", href: "/rooms" }] },
    ]);
  });
});

describe("maxfiy sozlamalar fayli", () => {
  const token = "123456:ABCdefGHIjklMNOpqrSTUvwx";

  it("to'g'ri faylni o'qiydi", () => {
    const s = parseSecrets(
      JSON.stringify({
        version: 1,
        tenants: {
          bilim: { databaseUrl: "postgres://u:p@h/db_bilim", authSecret: "s".repeat(32), telegramBotToken: token },
        },
      }),
    );
    expect(s.tenants.bilim?.databaseUrl).toBe("postgres://u:p@h/db_bilim");
  });

  it("buzilgan faylni rad etadi va xatoda qiymatni ko'rsatmaydi", () => {
    expect(() => parseSecrets("{")).toThrow(/JSON emas/);
    const bad = JSON.stringify({
      version: 1,
      tenants: { bilim: { databaseUrl: "mysql://maxfiy-parol@h/db", authSecret: "s".repeat(32) } },
    });
    expect(() => parseSecrets(bad)).toThrow(/tenants\.bilim\.databaseUrl/);
    expect(() => parseSecrets(bad)).not.toThrow(/maxfiy-parol/);
  });
});
