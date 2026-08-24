import { test, expect, describe } from "bun:test";
import {
  applyAccentBrightness,
  normalizeLightness,
  perceivedLightness,
  rgbToHsl,
  hexToRgb,
  rgbToHex,
  getReadableTextOn,
  getContrastText,
  getOppositeColor,
  generateDropShadowCSS,
  generateElementDropShadowCSS,
} from "../apps/web/src/lib/colors";

describe("hex <-> rgb", () => {
  test("hexToRgb", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#0f0")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("nope")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
  });
  test("rgbToHex", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
    expect(rgbToHex(0, 255, 0)).toBe("#00ff00");
  });
});

describe("readable / contrast", () => {
  test("picks black on light, white on dark", () => {
    expect(getReadableTextOn("#ffffff")).toBe("#000000");
    expect(getReadableTextOn("#000000")).toBe("#ffffff");
    expect(getContrastText("#ffffff")).toBe("#000000");
  });
  test("getOppositeColor inverts", () => {
    expect(getOppositeColor("#000000")).toBe("#ffffff");
    expect(getOppositeColor("#ff0000")).toBe("#00ffff");
  });
});

describe("drop shadow CSS", () => {
  const base = { enabled: true, blur: 4, intensity: 50, offsetX: 2, offsetY: 2, useOppositeColor: true } as const;

  test("disabled yields empty string", () => {
    expect(generateDropShadowCSS({ ...base, enabled: false }, "#000000")).toBe("");
  });
  test("uses the opposite color and intensity as opacity", () => {
    expect(generateDropShadowCSS(base, "#000000")).toBe("2px 2px 4px rgba(255, 255, 255, 0.5)");
  });
  test("custom color when not using opposite", () => {
    const css = generateDropShadowCSS({ ...base, useOppositeColor: false, customColor: "#ff0000" }, "#000000");
    expect(css).toBe("2px 2px 4px rgba(255, 0, 0, 0.5)");
  });
  test("spread is omitted when 0 and appended after the blur otherwise", () => {
    expect(generateDropShadowCSS(base, "#000000", 0)).toBe("2px 2px 4px rgba(255, 255, 255, 0.5)");
    expect(generateDropShadowCSS(base, "#000000", 3)).toBe("2px 2px 4px 3px rgba(255, 255, 255, 0.5)");
  });
  test("element shadow respects global + element enabled flags", () => {
    expect(generateElementDropShadowCSS({ ...base, enabled: false }, undefined, "#000000")).toBe("");
    expect(generateElementDropShadowCSS(base, { enabled: false }, "#000000")).toBe("");
    expect(generateElementDropShadowCSS(base, { enabled: true }, "#000000")).toContain("rgba(255, 255, 255, 0.5)");
  });
});

describe("accent brightness normalization", () => {
  const at = (hex: string) => perceivedLightness(hex)!;

  test("very dark and very bright colors land on the same perceived lightness", () => {
    const dark = normalizeLightness("#0b0b18", 58); // near-black cover
    const light = normalizeLightness("#f4e8d0", 58); // washed-out cover
    expect(at(dark)).toBeCloseTo(58, 0);
    expect(at(light)).toBeCloseTo(58, 0);
  });

  test("holds across hues, where raw luminance would not", () => {
    for (const hex of ["#0000ff", "#ffff00", "#1db954", "#e03070", "#7a5230"]) {
      expect(at(normalizeLightness(hex, 58))).toBeCloseTo(58, 0);
    }
  });

  test("keeps the hue of the original color", () => {
    const src = rgbToHsl(224, 48, 112); // #e03070
    const out = hexToRgb(normalizeLightness("#e03070", 58))!;
    expect(rgbToHsl(out.r, out.g, out.b).h).toBeCloseTo(src.h, 2);
  });

  test("grayscale stays gray at any source lightness", () => {
    expect(normalizeLightness("#ffffff", 58)).toBe(normalizeLightness("#000000", 58));
  });

  test("target follows the slider, and clamps to the ends", () => {
    expect(at(normalizeLightness("#e03070", 20))).toBeCloseTo(20, 0);
    expect(at(normalizeLightness("#e03070", 85))).toBeCloseTo(85, 0);
    expect(normalizeLightness("#e03070", -50)).toBe("#000000");
    expect(normalizeLightness("#e03070", 250)).toBe("#ffffff");
  });

  test("preserves an 8-digit hex's alpha and passes unparseable colors through", () => {
    expect(normalizeLightness("#0b0b18cc", 58)).toBe(normalizeLightness("#0b0b18", 58) + "cc");
    expect(normalizeLightness("accent", 58)).toBe("accent");
  });

  test("applyAccentBrightness is a no-op unless the theme opts in", () => {
    expect(applyAccentBrightness("#0b0b18", {})).toBe("#0b0b18");
    expect(applyAccentBrightness("#0b0b18", { accentNormalize: false, accentBrightness: 90 })).toBe("#0b0b18");
    expect(at(applyAccentBrightness("#0b0b18", { accentNormalize: true, accentBrightness: 70 }))).toBeCloseTo(70, 0);
    // Missing brightness falls back to the default target rather than going black.
    expect(at(applyAccentBrightness("#0b0b18", { accentNormalize: true }))).toBeCloseTo(58, 0);
  });
});
