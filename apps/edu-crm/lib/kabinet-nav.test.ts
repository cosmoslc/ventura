import { describe, expect, it } from "vitest";
import { KABINET_HOME, KABINET_NAV, kabinetActive } from "./kabinet-nav";

describe("kabinet menyusi", () => {
  it("bandlar /kabinet ichida va takrorlanmaydi", () => {
    expect(KABINET_NAV.every((i) => i.href === KABINET_HOME || i.href.startsWith(`${KABINET_HOME}/`))).toBe(true);
    expect(new Set(KABINET_NAV.map((i) => i.href)).size).toBe(KABINET_NAV.length);
  });

  it("faol band: ichki sahifa ham, o'xshash nom emas", () => {
    expect(kabinetActive("/kabinet")).toBe("/kabinet");
    expect(kabinetActive("/kabinet/profil")).toBe("/kabinet/profil");
    expect(kabinetActive("/kabinet/profil/xavfsizlik")).toBe("/kabinet/profil");
    expect(kabinetActive("/kabinet/profilx")).toBe("/kabinet");
  });
});
