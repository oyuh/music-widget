import { test, expect, describe } from "bun:test";
import { isMobileUA } from "../apps/web/src/lib/device";

const MOBILE = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
];

const DESKTOP = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/146 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
  // OBS / browser-source UAs look like desktop Chrome — must NOT be gated.
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 OBS/30",
];

describe("isMobileUA", () => {
  test("flags phones and tablets", () => {
    for (const ua of MOBILE) expect(isMobileUA(ua)).toBe(true);
  });
  test("leaves desktop / OBS alone", () => {
    for (const ua of DESKTOP) expect(isMobileUA(ua)).toBe(false);
  });
});
