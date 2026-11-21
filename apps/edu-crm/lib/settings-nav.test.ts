import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_HREFS, SETTINGS_NAV, isSettingsPath, visibleSettings } from "./settings-nav";

const ROOT = join(__dirname, "..");

describe("sozlamalar navbari", () => {
  it("har bir band — (settings) guruhidagi haqiqiy sahifa (manzil o'zgarmagan)", () => {
    for (const href of SETTINGS_HREFS) {
      expect(existsSync(join(ROOT, "app", "(crm)", "(settings)", href.slice(1), "page.tsx")), href).toBe(true);
    }
  });

  it("manzillar takrorlanmaydi", () => {
    expect(new Set(SETTINGS_HREFS).size).toBe(SETTINGS_HREFS.length);
  });

  it("ichki sahifalar ham sozlamalarga tegishli, o'xshash nomlar emas", () => {
    expect(isSettingsPath("/account/password")).toBe(true);
    expect(isSettingsPath("/courses")).toBe(true);
    expect(isSettingsPath("/settingsx")).toBe(false);
    expect(isSettingsPath("/groups")).toBe(false);
  });

  it("ruxsat bo'yicha filtrlanadi, bo'sh guruh tushib qoladi", () => {
    const only = visibleSettings((i) => i.feature === null);
    expect(only.flatMap((g) => g.items.map((i) => i.href))).toEqual(["/notifications", "/telegram-bots", "/account"]);
    expect(only.map((g) => g.title)).toEqual(["Aloqa", "Hisob"]);
    expect(visibleSettings(() => true)).toEqual(SETTINGS_NAV);
  });
});
