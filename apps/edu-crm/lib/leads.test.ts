import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_STAGES, DEFAULT_LOST_REASONS, daysIn, parseLostReasons, stagesError } from "./leads";

describe("lid bosqichlari", () => {
  it("standart ro'yxat to'g'ri", () => {
    expect(stagesError(DEFAULT_LEAD_STAGES)).toBeNull();
  });

  it("bo'sh va takroriy nom, ochiq bosqichsiz, tizim bosqichisiz ro'yxat rad etiladi", () => {
    const won = { name: "O'quvchi", color: "#10b981", kind: "won" as const };
    const lost = { name: "Yo'qotildi", color: "#ef4444", kind: "lost" as const };
    const open = (name: string) => ({ name, color: "#3b82f6", kind: "open" as const });
    expect(stagesError([open(" "), won, lost])).toBe("name");
    expect(stagesError([open("Yangi"), open("yangi "), won, lost])).toBe("duplicate");
    expect(stagesError([won, lost])).toBe("open");
    expect(stagesError([open("Yangi"), lost])).toBe("system");
    expect(stagesError([open("Yangi"), won, { ...won, name: "Bitirdi" }, lost])).toBe("system");
  });

  it("bosqichda turgan kunlar Toshkent vaqti bo'yicha", () => {
    // 2026-10-12 20:00 UTC = 13-oktabr Toshkentda
    expect(daysIn("2026-10-12T20:00:00Z", "2026-10-13")).toBe(0);
    expect(daysIn("2026-10-10T05:00:00Z", "2026-10-13")).toBe(3);
  });
});

describe("yo'qotish sabablari", () => {
  it("takror, bo'sh va uzun qiymatlar tashlanadi; bo'sh ro'yxat — standart", () => {
    expect(parseLostReasons(["Qimmat", " Qimmat ", "", 5, "x".repeat(81), "Uzoq"])).toEqual(["Qimmat", "Uzoq"]);
    expect(parseLostReasons([])).toEqual(DEFAULT_LOST_REASONS);
    expect(parseLostReasons("buzuq")).toEqual(DEFAULT_LOST_REASONS);
  });
});
