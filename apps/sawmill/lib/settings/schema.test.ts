import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sawmillSettingsSchema } from "./schema";

describe("sawmill settings schema", () => {
  it("standart sozlamalarni to'g'ri beradi", () => {
    expect(DEFAULT_SETTINGS.profitMode).toBe("estimated");
    expect(DEFAULT_SETTINGS.qtyDisplay).toBe("piece");
    expect(DEFAULT_SETTINGS.cubeInputMode).toBe("direct");
    expect(DEFAULT_SETTINGS.dimensionUnit).toBe("sm");
  });

  it("zod orqali noto'g'ri qiymatlarni rad etadi", () => {
    const invalid = sawmillSettingsSchema.safeParse({ profitMode: "unknown" });
    expect(invalid.success).toBe(false);
  });

  it("to'g'ri qiymatlarni muvaffaqiyatli qabul qiladi", () => {
    const valid = sawmillSettingsSchema.safeParse({
      profitMode: "actual",
      qtyDisplay: "cube",
      cubeInputMode: "calculated",
      dimensionUnit: "mm",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.dimensionUnit).toBe("mm");
      expect(valid.data.profitMode).toBe("actual");
    }
  });
});
