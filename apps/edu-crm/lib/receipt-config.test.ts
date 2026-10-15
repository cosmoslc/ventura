import { describe, expect, it } from "vitest";
import { qrPath } from "./qr";
import { DEFAULT_RECEIPT, pageCss, parseReceiptConfig, receiptConfigInput } from "./receipt-config";

describe("chek sozlamasi", () => {
  it("yo'q yoki buzilgan bo'lsa — standart", () => {
    expect(parseReceiptConfig(undefined)).toEqual(DEFAULT_RECEIPT);
    expect(parseReceiptConfig({ paper: "100mm" })).toEqual(DEFAULT_RECEIPT);
    expect(DEFAULT_RECEIPT).toEqual({ header: "", footer: "", paper: "80mm", showQr: false, autoPrint: false });
    expect(parseReceiptConfig({ header: " Markaz ", paper: "a4", showQr: true })).toMatchObject({
      header: "Markaz",
      paper: "a4",
      showQr: true,
    });
  });

  it("forma kirishida ortiqcha maydon va uzun matn rad etiladi", () => {
    expect(receiptConfigInput.safeParse({ paper: "58mm", autoPrint: true }).success).toBe(true);
    expect(receiptConfigInput.safeParse({ extra: 1 }).success).toBe(false);
    expect(receiptConfigInput.safeParse({ footer: "x".repeat(201) }).success).toBe(false);
  });

  it("@page qog'oz hajmiga qarab", () => {
    expect(pageCss("80mm")).toBe("@page{size:80mm auto;margin:0}");
    expect(pageCss("58mm")).toBe("@page{size:58mm auto;margin:0}");
    expect(pageCss("a4")).toBe("@page{size:A4;margin:15mm}");
  });
});

describe("QR kod", () => {
  it("matndan kvadrat shakl hosil bo'ladi; bo'sh matn — yo'q", () => {
    expect(qrPath("")).toBeNull();
    const qr = qrPath("https://markaz.uz");
    expect(qr).not.toBeNull();
    // 1-versiya 21 modul, har versiyada +4
    expect((qr!.size - 21) % 4).toBe(0);
    expect(qr!.d.startsWith("M")).toBe(true);
    expect(qrPath("https://markaz.uz")).toEqual(qr);
  });

  it("juda uzun matn sig'masa — null", () => {
    expect(qrPath("x".repeat(5000))).toBeNull();
  });
});
