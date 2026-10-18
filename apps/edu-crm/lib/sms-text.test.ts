import { describe, expect, it } from "vitest";
import { SMS_MODERATION_VALUES, SMS_TEMPLATE_KIND_VALUES } from "@ventura/db/schema/tenant";
import {
  SMS_MODERATION,
  SMS_PRESETS,
  SMS_TEMPLATE_KINDS,
  moderationFromEskiz,
  normalizeSms,
  renderSms,
  sampleParts,
  smsParts,
  smsTemplateInput,
  splitName,
  templateVars,
  unknownVars,
} from "./sms-text";

describe("SMS matni", () => {
  it("qismlarni hisoblaydi: lotin 160/153, kirill 70/67, kengaytirilgan belgi 2", () => {
    expect(smsParts("a".repeat(160))).toMatchObject({ parts: 1, unicode: false, perPart: 160 });
    expect(smsParts("a".repeat(161))).toMatchObject({ parts: 2, perPart: 153 });
    expect(smsParts("a".repeat(306))).toMatchObject({ parts: 2 });
    expect(smsParts("a".repeat(307))).toMatchObject({ parts: 3 });
    expect(smsParts("{}")).toMatchObject({ length: 4, unicode: false });
    expect(smsParts("Салом")).toMatchObject({ parts: 1, unicode: true, perPart: 70 });
    expect(smsParts("б".repeat(71))).toMatchObject({ parts: 2, perPart: 67 });
  });

  it("o'zbekcha apostrof va tipografik belgilar oddiyga almashadi", () => {
    expect(normalizeSms("oʻqituvchi “yaxshi” — gʼalaba")).toBe(`o'qituvchi "yaxshi" - g'alaba`);
    expect(smsParts(normalizeSms("oʻ")).unicode).toBe(false);
  });

  it("o'zgaruvchilarni topadi, tekshiradi va to'ldiradi", () => {
    expect(templateVars("{ism} {ism} {summa}")).toEqual(["ism", "summa"]);
    expect(unknownVars("{ism} {maosh}", "payment_received")).toEqual(["maosh"]);
    expect(unknownVars("{ism} {maosh}", "salary_paid")).toEqual([]);
    expect(renderSms("Salom {ism} {familiya}!", { ism: "Aziz" })).toBe("Salom Aziz !");
  });

  it("tayyor andozalar namunada bitta qismga sig'adi va o'z turiga mos", () => {
    for (const [kind, body] of Object.entries(SMS_PRESETS)) {
      expect(sampleParts(body, "Cosmos LC").parts, kind).toBe(1);
      expect(smsTemplateInput.safeParse({ kind, name: kind, body }).success, kind).toBe(true);
    }
  });

  it("Eskiz holatlari", () => {
    expect(moderationFromEskiz("service")).toBe("approved");
    expect(moderationFromEskiz("reklama")).toBe("advert");
    expect(moderationFromEskiz("rejected")).toBe("rejected");
    expect(moderationFromEskiz("inproccess")).toBe("moderation");
  });

  it("forma: noma'lum o'zgaruvchi va bo'sh matn rad etiladi", () => {
    expect(smsTemplateInput.safeParse({ kind: "absence", name: "x", body: "{summa}" }).success).toBe(false);
    expect(smsTemplateInput.safeParse({ kind: "absence", name: "x", body: "  " }).success).toBe(false);
    expect(smsTemplateInput.parse({ kind: "custom", name: " Salom ", body: "Oʻqish" })).toMatchObject({
      name: "Salom",
      body: "O'qish",
    });
  });

  it("turlar va holatlar bazadagi ro'yxat bilan bir xil", () => {
    expect([...SMS_TEMPLATE_KINDS]).toEqual([...SMS_TEMPLATE_KIND_VALUES]);
    expect([...SMS_MODERATION]).toEqual([...SMS_MODERATION_VALUES]);
  });

  it("ism va familiya", () => {
    expect(splitName(" Aziz  Karimov Olimovich ")).toEqual({ first: "Aziz", last: "Karimov Olimovich" });
    expect(splitName("Aziz")).toEqual({ first: "Aziz", last: "" });
  });
});
