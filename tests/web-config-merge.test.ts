import { test, expect, describe } from "bun:test";
import { mergeConfig } from "../apps/web/src/lib/config-merge";
import { defaultConfig } from "../apps/web/src/lib/config";

describe("mergeConfig", () => {
  test("fills a complete config from nothing", () => {
    const c = mergeConfig(null);
    expect(c.theme.text.title).toBe(defaultConfig.theme.text.title);
    expect(c.layout.w).toBe(defaultConfig.layout.w);
    expect(c.layout.textOffset?.title).toEqual({ x: 0, y: 0 });
    expect(c.layout.progressOffset).toEqual({ x: 0, y: 0 });
    expect(c.marquee?.speedPxPerSec).toBe(defaultConfig.marquee!.speedPxPerSec);
  });

  test("overrides provided values, keeps the rest as defaults", () => {
    const c = mergeConfig({ lfmUser: "rj", theme: { text: { title: "accent" } }, layout: { w: 333 } } as never);
    expect(c.lfmUser).toBe("rj");
    expect(c.theme.text.title).toBe("accent");
    expect(c.theme.text.artist).toBe(defaultConfig.theme.text.artist);
    expect(c.layout.w).toBe(333);
    expect(c.layout.h).toBe(defaultConfig.layout.h);
  });

  test("backward-compatible: old config without new fields gets defaults", () => {
    const old = {
      lfmUser: "x",
      theme: { bg: "#123456" },
      layout: { w: 420, h: 130, showArt: true, align: "left", artSize: 88, artPosition: "left", scrollTriggerWidth: 180, textGap: 2 },
      fields: { title: true, artist: true, album: true, progress: true, duration: true, history: 50 },
    };
    const c = mergeConfig(old as never);
    expect(c.theme.bg).toBe("#123456");
    expect(c.layout.progressOffset).toEqual({ x: 0, y: 0 });
    expect(c.layout.textOffset?.duration).toEqual({ x: 0, y: 0 });
  });

  test("does not mutate or share references with defaultConfig", () => {
    const c = mergeConfig(null);
    c.theme.text.title = "#abcdef";
    c.layout.textOffset!.title.x = 99;
    expect(defaultConfig.theme.text.title).not.toBe("#abcdef");
    expect(defaultConfig.layout.textOffset!.title.x).toBe(0);
  });
});
