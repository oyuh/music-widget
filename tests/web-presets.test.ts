import { test, expect, describe } from "bun:test";
import { PRESETS } from "../apps/web/src/lib/presets";
import { mergeConfig } from "../apps/web/src/lib/config-merge";
import { encodeConfig, decodeConfig } from "../apps/web/src/lib/config";

describe("built-in presets", () => {
  test("there are presets and each has a name + config", () => {
    expect(PRESETS.length).toBeGreaterThan(0);
    for (const p of PRESETS) {
      expect(typeof p.name).toBe("string");
      expect(p.config).toBeTruthy();
    }
  });

  test("each preset merges into a complete, renderable config", () => {
    for (const p of PRESETS) {
      const c = mergeConfig(p.config);
      expect(c.theme.text.title).toBeTruthy();
      expect(typeof c.layout.w).toBe("number");
      expect(typeof c.layout.textOffset?.title.x).toBe("number");
      expect(typeof c.layout.textOffset?.title.y).toBe("number");
      expect(["left", "right", "top"]).toContain(c.layout.artPosition);
    }
  });

  test("each preset survives encode/decode -> merge", () => {
    for (const p of PRESETS) {
      const merged = mergeConfig(p.config);
      const restored = mergeConfig(decodeConfig(encodeConfig(merged)));
      expect(restored.layout.w).toBe(merged.layout.w);
      expect(restored.theme.bg).toBe(merged.theme.bg);
    }
  });
});
