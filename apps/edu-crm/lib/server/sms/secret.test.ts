import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./secret";

/* SMS sirlari: shu markaz kaliti bilan ochiladi, boshqa `authSecret` bilan — yo'q; shifr matnida qiymat ko'rinmaydi. */

const A = "a".repeat(32);
const B = "b".repeat(32);

describe("SMS sirlari", () => {
  it("yopadi va ochadi", () => {
    const sealed = sealSecret("eskiz-kalit", A);
    expect(sealed).not.toContain("eskiz-kalit");
    expect(openSecret(sealed, A)).toBe("eskiz-kalit");
  });

  it("boshqa markaz kaliti yoki buzilgan qiymat — null", () => {
    const sealed = sealSecret("eskiz-kalit", A);
    expect(openSecret(sealed, B)).toBeNull();
    expect(openSecret("buzilgan", A)).toBeNull();
    expect(openSecret(null, A)).toBeNull();
  });
});
