import { describe, expect, it } from "vitest";
import { hourLabel, inQuietHours, smsConnectInput, smsPrefsInput, smsTestInput } from "./sms";

describe("sms qoidalari", () => {
  it("tinch soatlar yarim tundan o'tadi", () => {
    expect(inQuietHours(22, 21, 8)).toBe(true);
    expect(inQuietHours(3, 21, 8)).toBe(true);
    expect(inQuietHours(8, 21, 8)).toBe(false);
    expect(inQuietHours(12, 21, 8)).toBe(false);
    expect(inQuietHours(13, 13, 15)).toBe(true);
    expect(inQuietHours(15, 13, 15)).toBe(false);
  });

  it("soat yorlig'i", () => {
    expect(hourLabel(8)).toBe("08:00");
    expect(hourLabel(21)).toBe("21:00");
  });

  it("ulash, sozlama va test kirishlari tekshiriladi", () => {
    expect(smsConnectInput.safeParse({ email: "a@b.uz", secret: " k " }).data).toEqual({
      email: "a@b.uz",
      secret: "k",
    });
    expect(smsConnectInput.safeParse({ email: "yo'q", secret: "k" }).success).toBe(false);
    expect(smsConnectInput.safeParse({ email: "a@b.uz", secret: "" }).success).toBe(false);
    expect(smsPrefsInput.safeParse({ quietFrom: 21, quietTo: 8 }).data).toEqual({
      sender: "",
      quietFrom: 21,
      quietTo: 8,
    });
    expect(smsPrefsInput.safeParse({ quietFrom: 8, quietTo: 8 }).success).toBe(false);
    expect(smsPrefsInput.safeParse({ quietFrom: 24, quietTo: 8 }).success).toBe(false);
    expect(smsTestInput.safeParse({ phone: "901234567" }).success).toBe(true);
    expect(smsTestInput.safeParse({ phone: "90123" }).success).toBe(false);
  });
});
