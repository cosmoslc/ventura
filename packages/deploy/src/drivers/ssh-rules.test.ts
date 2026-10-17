import { describe, expect, it } from "vitest";
import { instanceName, serverFit } from "./ssh";

describe("instanceName", () => {
  it("shared — shablonning bitta umumiy ilovasi", () => {
    expect(instanceName("edu-crm", "bilim", false)).toBe("edu-crm");
  });
  it("dedicated — mijozga o'z nusxasi", () => {
    expect(instanceName("edu-crm", "bilim", true)).toBe("edu-crm-bilim");
  });
});

describe("serverFit (alohida server bazasi)", () => {
  const busy = [
    { serverId: "s1", dbStrategy: "db_per_tenant" },
    { serverId: "s2", dbStrategy: "dedicated_server" },
  ];

  it("oddiy loyiha band serverga ham qo'yiladi", () => {
    expect(serverFit("db_per_tenant", busy)("s1")).toBeNull();
    expect(serverFit("shared_db", busy)("s3")).toBeNull();
  });

  it("alohida server sifatida berilgan serverga boshqa loyiha qo'yilmaydi", () => {
    expect(serverFit("db_per_tenant", busy)("s2")).toMatch(/alohida server sifatida berilgan/);
    expect(serverFit("dedicated_server", busy)("s2")).toMatch(/alohida server sifatida berilgan/);
  });

  it("alohida server bazasi faqat bo'sh serverga", () => {
    expect(serverFit("dedicated_server", busy)("s1")).toMatch(/bo'sh bo'lishi kerak/);
    expect(serverFit("dedicated_server", busy)("s3")).toBeNull();
  });

  it("serverga biriktirilmagan loyihalar hisobga olinmaydi", () => {
    expect(serverFit("dedicated_server", [{ serverId: null, dbStrategy: "db_per_tenant" }])("s1")).toBeNull();
  });
});
