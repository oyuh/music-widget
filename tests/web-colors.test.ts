import { test, expect, describe } from "bun:test";
import {
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
  test("element shadow respects global + element enabled flags", () => {
    expect(generateElementDropShadowCSS({ ...base, enabled: false }, undefined, "#000000")).toBe("");
    expect(generateElementDropShadowCSS(base, { enabled: false }, "#000000")).toBe("");
    expect(generateElementDropShadowCSS(base, { enabled: true }, "#000000")).toContain("rgba(255, 255, 255, 0.5)");
  });
});
