import { test, expect, describe } from "bun:test";
import {
  encodeConfig,
  decodeConfig,
  defaultConfig,
  formatTime,
  formatDurationText,
  applyTextTransform,
  getUsedFonts,
  checkArtUrl,
} from "../apps/web/src/lib/config";

describe("encode/decode", () => {
  test("round-trips stably and preserves key fields", () => {
    const enc = encodeConfig(defaultConfig);
    const dec = decodeConfig(enc)!;
    expect(dec).not.toBeNull();
    expect(encodeConfig(dec)).toBe(enc);
    expect(dec.lfmUser).toBe(defaultConfig.lfmUser);
    expect(dec.layout.w).toBe(defaultConfig.layout.w);
    expect(dec.theme.bg).toBe(defaultConfig.theme.bg);
  });

  test("tolerates a leading # and rejects garbage", () => {
    const enc = encodeConfig(defaultConfig);
    expect(decodeConfig("#" + enc)?.layout.h).toBe(defaultConfig.layout.h);
    expect(decodeConfig("not-valid-base64-$$$")).toBeNull();
  });

  test("is URL-safe (no +, /, =)", () => {
    expect(encodeConfig(defaultConfig)).not.toMatch(/[+/=]/);
  });
});

describe("time + text helpers", () => {
  test("formatTime", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65_000)).toBe("1:05");
    expect(formatTime(600_000)).toBe("10:00");
  });

  test("formatDurationText", () => {
    expect(formatDurationText(42_000, 180_000, "elapsed")).toBe("0:42");
    expect(formatDurationText(42_000, 180_000, "remaining")).toBe("-2:18");
    expect(formatDurationText(42_000, 180_000, "both")).toBe("0:42/3:00");
    expect(formatDurationText(42_000, null, "both")).toBe("0:42");
  });

  test("applyTextTransform", () => {
    expect(applyTextTransform("Hi", "uppercase")).toBe("HI");
    expect(applyTextTransform("Hi", "lowercase")).toBe("hi");
    expect(applyTextTransform("Hi", "none")).toBe("Hi");
  });

  test("getUsedFonts includes global + individual fonts", () => {
    const fonts = getUsedFonts({
      ...defaultConfig,
      theme: { ...defaultConfig.theme, font: "Inter", textFont: { title: "Poppins" } },
    });
    expect(fonts).toContain("Inter");
    expect(fonts).toContain("Poppins");
  });

  test("checkArtUrl grades pasted fallback-art links", () => {
    expect(checkArtUrl("https://example.com/cover.png").level).toBe("ok");
    expect(checkArtUrl("  https://example.com/cover.png  ").level).toBe("ok");
    expect(checkArtUrl("http://example.com/cover.png").level).toBe("warn");
    expect(checkArtUrl("example.com/cover.png").level).toBe("bad");
    expect(checkArtUrl("data:image/png;base64,iVBORw0KGgo=").level).toBe("bad");
    // Long links bloat the encoded widget URL the whole design rides in.
    expect(checkArtUrl("https://example.com/" + "a".repeat(600)).level).toBe("bad");
    // Empty is "unset", not an error the user should see.
    expect(checkArtUrl("").msg).toBe("");
  });
});
