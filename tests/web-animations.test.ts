import { describe, expect, test } from "bun:test";
import {
  CUSTOM_ANIMATION_SOURCE_MAX,
  MAX_CUSTOM_ANIMATIONS,
  MAX_ELEMENT_ANIMATIONS,
  createAnimation,
  cssKeyframeBlock,
  cssKeyframeName,
  customAnimationCss,
  normalizeCustomAnimations,
  normalizeElementAnimations,
  splitGraphemes,
  validateCustomKeyframes,
  visualKeyframes,
  visibilityExitMs,
} from "../apps/web/src/lib/animations";
import { decodeConfig, defaultConfig, encodeConfig, migrateToV2, type WidgetConfig } from "../apps/web/src/lib/config";
import { mergeConfig } from "../apps/web/src/lib/config-merge";
import { adoptLegacySwitchAnimation, newEditorConfig } from "../apps/web/src/lib/editor.svelte";

function base(): WidgetConfig {
  return JSON.parse(JSON.stringify(migrateToV2(defaultConfig))) as WidgetConfig;
}

describe("animation config", () => {
  test("normalizes hand-edited values and caps each element at two slots", () => {
    const raw = Array.from({ length: 5 }, () => ({
      trigger: "not-real",
      effect: "also-not-real",
      durationMs: 99_000,
      exitDurationMs: -10,
      delayMs: -1,
      distance: 999,
      staggerMs: 999,
    }));
    const result = normalizeElementAnimations(raw)!;
    expect(result).toHaveLength(MAX_ELEMENT_ANIMATIONS);
    expect(result[0].trigger).toBe("track-change");
    expect(result[0].effect).toBe("fade");
    expect(result[0].durationMs).toBe(5000);
    expect(result[0].exitDurationMs).toBe(0);
    expect(result[0].delayMs).toBe(0);
    expect(result[0].distance).toBe(120);
    expect(result[0].staggerMs).toBe(150);
  });

  test("custom definitions have stable ids, bounded source, and a count limit", () => {
    const raw = Array.from({ length: 10 }, (_, index) => ({
      id: `a${index + 1}`,
      name: `Effect ${index + 1}`,
      type: index % 2 ? "js" : "css",
      source: "x".repeat(CUSTOM_ANIMATION_SOURCE_MAX + 100),
    }));
    const result = normalizeCustomAnimations(raw)!;
    expect(result.length).toBeLessThanOrEqual(MAX_CUSTOM_ANIMATIONS);
    expect(result[0].source).toHaveLength(CUSTOM_ANIMATION_SOURCE_MAX);
    expect(result.reduce((sum, definition) => sum + definition.source.length, 0)).toBeLessThanOrEqual(4000);
  });

  test("normalizes visual frames without spending the custom-code budget", () => {
    const result = normalizeCustomAnimations([
      {
        id: "a1",
        name: "Drift",
        type: "visual",
        source: "x".repeat(CUSTOM_ANIMATION_SOURCE_MAX),
        from: { opacity: -5, x: 999, y: 24, scale: 85, rotate: -45, blur: 80 },
        to: { opacity: 100, x: 0, y: 0, scale: 100, rotate: 0, blur: 0 },
      },
      { id: "a2", name: "Code", type: "js", source: "x".repeat(CUSTOM_ANIMATION_SOURCE_MAX) },
    ])!;
    expect(result[0].source).toBe("");
    expect(result[0].from).toMatchObject({ opacity: 0, x: 240, y: 24, blur: 40 });
    expect(result[1].source).toHaveLength(CUSTOM_ANIMATION_SOURCE_MAX);
  });

  test("new editor designs retire the global switch effect without changing old widget links", () => {
    const created = newEditorConfig();
    expect(created.v2!.switchAnim.type).toBe("none");
    expect(mergeConfig(decodeConfig(encodeConfig(created))).v2!.switchAnim.type).toBe("none");
    const old = base();
    old.v2!.switchAnim = { type: "slide", direction: "left", durationMs: 450, easing: "cubicOut" };
    expect(mergeConfig(decodeConfig(encodeConfig(old))).v2!.switchAnim.type).toBe("slide");
  });

  test("playback and pause motions default to a fade at both state changes", () => {
    for (const trigger of ["playback", "paused"] as const) {
      const animation = createAnimation(trigger);
      expect(animation.effect).toBe("fade");
      expect(animation.exitEffect).toBe("fade");
      expect(animation.exitDurationMs).toBeLessThan(animation.durationMs);
    }
  });

  test("editor loads promote an old switch effect into a background animation", () => {
    const old = base();
    old.v2!.switchAnim = { type: "slide", direction: "left", durationMs: 450, easing: "backOut" };
    expect(adoptLegacySwitchAnimation(old)).toBe(true);
    expect(old.v2!.switchAnim.type).toBe("none");
    expect(old.v2!.elements.background.animations).toEqual([
      expect.objectContaining({
        trigger: "track-change",
        effect: "slide",
        durationMs: 450,
        easing: "backOut",
        direction: "left",
        distance: 16,
      }),
    ]);
    expect(adoptLegacySwitchAnimation(old)).toBe(false);
  });

  test("a full background keeps the old switch runtime instead of dropping the effect", () => {
    const old = base();
    old.v2!.switchAnim.type = "fade";
    old.v2!.elements.background.animations = [createAnimation("playback"), createAnimation("widget-load")];
    expect(adoptLegacySwitchAnimation(old)).toBe(false);
    expect(old.v2!.switchAnim.type).toBe("fade");
    expect(old.v2!.elements.background.animations).toHaveLength(MAX_ELEMENT_ANIMATIONS);
  });

  test("old v2 configs remain animation-free", () => {
    const merged = mergeConfig(base());
    expect(mergeConfig(decodeConfig(encodeConfig(base()))).v2!.switchAnim.type).toBe("fade");
    expect(merged.v2!.customAnimations).toBeUndefined();
    expect(merged.v2!.elements.title.animations).toBeUndefined();
  });

  test("element and custom effects survive an encoded widget URL", () => {
    const cfg = base();
    cfg.v2!.customAnimations = [
      { id: "a1", name: "Soft reveal", type: "css", source: "@keyframes reveal { from { opacity: 0 } to { opacity: 1 } }" },
      {
        id: "a2",
        name: "Drift",
        type: "visual",
        source: "",
        from: { opacity: 0, x: -18, y: 10, scale: 95, rotate: -4, blur: 3 },
        to: { opacity: 100, x: 0, y: 0, scale: 100, rotate: 0, blur: 0 },
      },
    ];
    cfg.v2!.elements.title.animations = [
      { ...createAnimation("track-change"), effect: "letter-fade", staggerMs: 42 },
      { ...createAnimation("playback"), effect: "custom:a2", exitEffect: "fade" },
    ];
    const roundTrip = mergeConfig(decodeConfig(encodeConfig(cfg)));
    expect(roundTrip.v2!.customAnimations?.[0].name).toBe("Soft reveal");
    expect(roundTrip.v2!.elements.title.animations?.map((animation) => animation.effect)).toEqual([
      "letter-fade",
      "custom:a2",
    ]);
    expect(roundTrip.v2!.elements.title.animations?.[0].staggerMs).toBe(42);
    expect(roundTrip.v2!.customAnimations?.[1].from?.x).toBe(-18);
  });
});

describe("animation helpers", () => {
  test("grapheme splitting keeps emoji and combining marks together", () => {
    expect(splitGraphemes("A👨‍👩‍👧‍👦é")).toEqual(["A", "👨‍👩‍👧‍👦", "é"]);
  });

  test("custom CSS keyframes get a definition-specific runtime name", () => {
    const source = "@keyframes reveal { from { opacity: 0 } to { opacity: 1 } } .outside { color: red }";
    expect(cssKeyframeName(source)).toBe("reveal");
    expect(cssKeyframeBlock(source)).toBe("@keyframes reveal { from { opacity: 0 } to { opacity: 1 } }");
    const css = customAnimationCss([{ id: "a2", name: "Reveal", type: "css", source }]);
    expect(css).toContain("@keyframes mw-custom-a2-");
    expect(css).toContain("-reveal");
    expect(css).not.toContain("@keyframes reveal");
    expect(css).not.toContain(".outside");
    expect(cssKeyframeBlock("@keyframes unfinished {")).toBeNull();
  });

  test("custom JavaScript output is reduced to supported keyframe fields", () => {
    const result = validateCustomKeyframes([
      { opacity: -2, transform: "translateX(4px)", background: "red" },
      { opacity: 3, filter: "blur(0)", offset: 2, backgroundImage: "url(https://bad.example)" },
    ]);
    expect(result).toEqual([
      { opacity: 0, transform: "translateX(4px)" },
      { opacity: 1, filter: "blur(0)", offset: 1 },
    ]);
    expect(validateCustomKeyframes([{ opacity: 0 }])).toBeNull();
  });

  test("visual definitions compile to transform, opacity, and filter keyframes", () => {
    const frames = visualKeyframes({
      id: "a1",
      name: "Drift",
      type: "visual",
      source: "",
      from: { opacity: 20, x: -12, y: 8, scale: 90, rotate: -5, blur: 6 },
      to: { opacity: 100, x: 0, y: 0, scale: 100, rotate: 0, blur: 0 },
    });
    expect(frames).toEqual([
      { opacity: 0.2, transform: "translate3d(-12px,8px,0) rotate(-5deg) scale(0.9)", filter: "blur(6px)" },
      { opacity: 1, transform: "translate3d(0px,0px,0) rotate(0deg) scale(1)", filter: "blur(0px)" },
    ]);
  });

  test("visibility cleanup waits for the longest exit, including letter stagger", () => {
    const fade = { ...createAnimation("paused"), exitDurationMs: 240, exitDelayMs: 40 };
    const letters = {
      ...createAnimation("paused"),
      exitEffect: "letter-fade",
      exitDurationMs: 180,
      exitDelayMs: 20,
    };
    expect(visibilityExitMs([fade, letters], "paused")).toBe(900);
    expect(visibilityExitMs([fade], "playback")).toBe(0);
  });
});
