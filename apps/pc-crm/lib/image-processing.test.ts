import { describe, expect, it } from "vitest";
import { colorDistance, detectCornerBackgroundColor } from "./image-processing";

describe("image-processing", () => {
  it("colorDistance: calculates Euclidean distance correctly", () => {
    // Exact match
    expect(colorDistance(255, 255, 255, 255, 255, 255)).toBe(0);

    // Black to white: sqrt(255^2 * 3) ~ 441.67
    const blackWhiteDist = colorDistance(0, 0, 0, 255, 255, 255);
    expect(Math.round(blackWhiteDist)).toBe(442);

    // Small difference (e.g. #FFFFFF vs #EFEFEF)
    const grayDiff = colorDistance(255, 255, 255, 239, 239, 239);
    expect(Math.round(grayDiff)).toBe(28);
  });

  it("detectCornerBackgroundColor: accurately finds background color", () => {
    // Fake 2x2 ImageData: all corners are light gray (240, 240, 240, 255)
    const fakeData = new Uint8ClampedArray([
      240, 240, 240, 255, 240, 240, 240, 255, 240, 240, 240, 255, 240, 240, 240, 255,
    ]);

    const imgData = {
      data: fakeData,
      width: 2,
      height: 2,
      colorSpace: "srgb" as PredefinedColorSpace,
    } as ImageData;

    const detected = detectCornerBackgroundColor(imgData);
    expect(detected).toEqual({ r: 240, g: 240, b: 240 });
  });
});
