import { describe, expect, it } from "vitest";
import { recipientsFor } from "./manual";

/* Kimga yuboriladi (Q3): standart — ota-ona, raqami bo'lmasa o'quvchi; "ikkalasi" bir xil raqamga ikki marta emas. */

describe("recipientsFor", () => {
  const s = { phone: "+998901110001", parentPhone: "+998901110002" };

  it("ota-ona, raqami bo'lmasa o'quvchi", () => {
    expect(recipientsFor(s, "parent")).toEqual([{ recipient: "parent", phone: "+998901110002" }]);
    expect(recipientsFor({ ...s, parentPhone: null }, "parent")).toEqual([
      { recipient: "student", phone: "+998901110001" },
    ]);
    expect(recipientsFor({ ...s, parentPhone: "  " }, "parent")).toEqual([
      { recipient: "student", phone: "+998901110001" },
    ]);
  });

  it("o'quvchi va ikkalasi", () => {
    expect(recipientsFor(s, "student")).toEqual([{ recipient: "student", phone: "+998901110001" }]);
    expect(recipientsFor(s, "both")).toHaveLength(2);
    expect(recipientsFor({ ...s, parentPhone: "+998 90 111 00 01" }, "both")).toEqual([
      { recipient: "student", phone: "+998901110001" },
    ]);
  });
});
