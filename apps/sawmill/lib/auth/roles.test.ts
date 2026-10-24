import { describe, expect, it } from "vitest";
import { can, type SawmillPermission } from "./roles";

describe("sawmill roles and permissions", () => {
  it("owner barcha amallarga ruxsatga ega", () => {
    const permissions: SawmillPermission[] = [
      "teraks.delete",
      "workers.delete",
      "settings.manage",
      "users.manage",
      "stock.adjust",
    ];
    for (const p of permissions) {
      expect(can("owner", p)).toBe(true);
    }
  });

  it("accountant o'chirish va sozlamalarga ega emas, lekin kiritish va tahrirlashga ega", () => {
    expect(can("accountant", "work.manage")).toBe(true);
    expect(can("accountant", "dispatch.manage")).toBe(true);
    expect(can("accountant", "teraks.delete")).toBe(false);
    expect(can("accountant", "users.manage")).toBe(false);
    expect(can("accountant", "settings.manage")).toBe(false);
  });

  it("viewer faqat ko'rish amallariga ega", () => {
    expect(can("viewer", "teraks.view")).toBe(true);
    expect(can("viewer", "reports.view")).toBe(true);
    expect(can("viewer", "work.manage")).toBe(false);
    expect(can("viewer", "work.delete")).toBe(false);
  });
});
