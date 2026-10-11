import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, themeInitScript, themeScript } from "./theme";

describe("tema skripti", () => {
  it("saqlangan tanlov kalitini va standart ko'rinishni o'z ichiga oladi", () => {
    expect(themeInitScript).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
    expect(themeInitScript).toContain("prefers-color-scheme: dark");
    expect(themeScript("dark")).toContain('s==="dark":true');
    expect(themeScript("light")).toContain('s==="dark":false');
  });
});
