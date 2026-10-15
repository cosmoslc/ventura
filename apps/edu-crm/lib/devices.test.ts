import { describe, expect, it } from "vitest";
import { PERMISSION_CATEGORIES } from "@ventura/auth/staff/policy";
import { formatWhen, permissionGroups } from "./devices";

describe("formatWhen", () => {
  it("Toshkent vaqtida ko'rsatadi", () => {
    expect(formatWhen("2026-10-14T09:05:00Z")).toBe("14.10.2026 14:05");
    // UTC bo'yicha hali oldingi kun, Toshkentda yangi kun
    expect(formatWhen("2026-10-14T20:30:00Z")).toBe("15.10.2026 01:30");
  });
  it("noto'g'ri sana — chiziqcha", () => {
    expect(formatWhen("yo'q")).toBe("—");
  });
});

describe("permissionGroups", () => {
  it("faqat berilgan ruxsatlar, toifa tartib raqamisiz", () => {
    const g = permissionGroups(
      PERMISSION_CATEGORIES,
      new Set(["students.view", "students.edit", "settings.logs"]),
      new Set(),
    );
    expect(g.map((x) => x.id)).toEqual(["students", "settings"]);
    expect(g[0]!.title).toBe("Talabalar Boshqaruvi");
    expect(g[0]!.items.map((i) => i.id)).toEqual(["students.view", "students.edit"]);
    expect(g.every((x) => x.items.every((i) => !i.approval))).toBe(true);
  });
  it("tasdiq bilan ruxsat alohida belgilanadi, katalogdagi tartibda", () => {
    const g = permissionGroups(PERMISSION_CATEGORIES, new Set(["students.view"]), new Set(["students.delete"]));
    expect(g[0]!.items).toEqual([
      { id: "students.view", name: expect.any(String), approval: false },
      { id: "students.delete", name: expect.any(String), approval: true },
    ]);
  });
  it("ruxsat yo'q — bo'sh ro'yxat", () => {
    expect(permissionGroups(PERMISSION_CATEGORIES, new Set(), new Set())).toEqual([]);
  });
});
