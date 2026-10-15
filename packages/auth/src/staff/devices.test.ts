import { describe, expect, it } from "vitest";
import { describeUserAgent, deviceHash } from "./devices";

describe("describeUserAgent", () => {
  const cases: [string, string][] = [
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36", "Chrome · Windows"],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
      "Edge · Windows",
    ],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox · Windows"],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      "Safari · macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148",
      "Chrome · iOS",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 OPR/80.0",
      "Opera · Android",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36",
      "Samsung Internet · Android",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36", "Chrome · Linux"],
  ];
  it.each(cases)("%s", (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected);
  });
  it("bo'sh yoki tanib bo'lmaydigan — null", () => {
    expect(describeUserAgent(null)).toBeNull();
    expect(describeUserAgent("")).toBeNull();
    expect(describeUserAgent("curl/8.0")).toBeNull();
  });
});

describe("deviceHash", () => {
  it("bir xil kirish — bir xil xesh, cookie'ning o'zi emas", () => {
    expect(deviceHash("abc")).toBe(deviceHash("abc"));
    expect(deviceHash("abc")).not.toBe(deviceHash("abd"));
    expect(deviceHash("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(deviceHash("abc")).not.toContain("abc");
  });
});
