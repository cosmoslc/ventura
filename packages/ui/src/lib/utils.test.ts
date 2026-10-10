import { describe, expect, it } from "vitest";
import { formatUzPhone } from "../components/phone-input";
import { uniformScale } from "./morph";
import { cn } from "./utils";

describe("cn", () => {
  it("bir guruhdagi to'qnashuvda keyingi klass qoladi", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("qo'shimcha matn o'lchamlarini rang bilan aralashtirmaydi", () => {
    // text-body — o'lcham, text-foreground — rang: ikkalasi ham qolishi kerak
    expect(cn("text-body text-foreground")).toBe("text-body text-foreground");
    expect(cn("text-xs", "text-body")).toBe("text-body");
  });
});

describe("formatUzPhone", () => {
  it("9 raqamni 2-3-2-2 ko'rinishida guruhlaydi", () => {
    expect(formatUzPhone("901234567")).toBe("90 123 45 67");
  });

  it("raqam bo'lmagan belgilarni va ortiqcha raqamlarni tashlaydi", () => {
    expect(formatUzPhone("+998 (90) 123-45-67 89")).toBe("99 890 12 34");
    expect(formatUzPhone("90 12")).toBe("90 12");
  });
});

describe("uniformScale", () => {
  it("bir xil o'lchamda 1 qaytaradi", () => {
    expect(uniformScale({ width: 200, height: 100 }, { width: 200, height: 100 })).toBe(1);
  });

  it("sx va sy ning geometrik o'rtachasini oladi", () => {
    // 50/200 = 0.25, 100/100 = 1 → sqrt(0.25) = 0.5
    expect(uniformScale({ width: 50, height: 100 }, { width: 200, height: 100 })).toBeCloseTo(0.5);
  });
});
