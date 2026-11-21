import { describe, expect, it } from "vitest";
import { ru } from "./ru";
import { t } from "./index";
import { uz } from "./uz";

describe("sawmill i18n", () => {
  it("uz va ru kalitlari to'liq va bir xil", () => {
    const uzKeys = Object.keys(uz).sort();
    const ruKeys = Object.keys(ru).sort();
    expect(uzKeys).toEqual(ruKeys);
  });

  it("t() yordamchisi har ikkala tilda tarjimani to'g'ri qaytaradi", () => {
    expect(t("app_name", "uz")).toBe("Pilorama Boshqaruvi");
    expect(t("app_name", "ru")).toBe("Управление Пилорамой");
    expect(t("action_save", "uz")).toBe("Saqlash");
    expect(t("action_save", "ru")).toBe("Сохранить");
  });
});
