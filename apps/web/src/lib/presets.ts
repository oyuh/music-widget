import { createAnimation } from "./animations";
import type { V2Animation, V2AnimationTrigger, V2ElementId, WidgetConfig } from "./config";
import { mergeConfig } from "./config-merge";
import { PRESET_DATA } from "./preset-data";

/** `[element, trigger, effect, overrides]`; anything left out keeps the editor's defaults. */
type Motion = [V2ElementId, V2AnimationTrigger, string, Partial<V2Animation>?];

/**
 * The motion each starter look ships with. Presets used to lean on the retired
 * whole-widget `switchAnim`, which `applyPreset` strips, so picking one left you
 * with a design that never moved. These are the same ideas rebuilt as per-element
 * animations, and they double as a worked example of the system.
 */
const MOTION: Record<string, Motion[]> = {
  Default: [
    ["background", "widget-load", "fade", { durationMs: 400 }],
    ["art", "track-change", "fade", { durationMs: 400, easing: "cubicOut" }],
    ["title", "track-change", "slide", { durationMs: 380, easing: "cubicOut", distance: 14 }],
    ["artist", "track-change", "slide", { durationMs: 380, delayMs: 70, easing: "cubicOut", distance: 14 }],
    ["album", "track-change", "fade", { durationMs: 380, delayMs: 120 }],
  ],
  // Type-led look, so the text carries the motion and the art stays calm.
  Minimalist: [
    ["background", "widget-load", "fade", { durationMs: 450 }],
    ["background", "playback", "fade", { durationMs: 450, exitDurationMs: 300 }],
    ["art", "track-change", "fade", { durationMs: 450, easing: "cubicOut" }],
    ["title", "track-change", "letter-rise", { durationMs: 520, easing: "cubicOut", distance: 14, staggerMs: 26 }],
    ["artist", "track-change", "letter-fade", { durationMs: 420, delayMs: 90, staggerMs: 20 }],
  ],
  // Card look, so it lands as a card and the cover art leads on every change.
  "Modern Card": [
    ["background", "widget-load", "pop", { durationMs: 380, easing: "backOut" }],
    ["art", "track-change", "zoom", { durationMs: 420, easing: "cubicOut" }],
    ["title", "track-change", "slide", { durationMs: 340, easing: "cubicOut", distance: 12 }],
    ["artist", "track-change", "slide", { durationMs: 340, delayMs: 60, easing: "cubicOut", distance: 12 }],
    ["duration", "track-change", "fade", { durationMs: 340, delayMs: 120 }],
    ["pause", "paused", "fade", { durationMs: 300, exitDurationMs: 200 }],
  ],
};

/** Attach a starter look's motion. No-op for a name with nothing defined. */
export function applyStarterMotion(config: WidgetConfig, look: string): WidgetConfig {
  for (const [id, trigger, effect, overrides] of MOTION[look] ?? []) {
    const element = config.v2?.elements[id];
    if (!element) continue;
    element.animations = [
      ...(element.animations ?? []),
      { ...createAnimation(trigger), effect, ...overrides },
    ];
  }
  return config;
}

/**
 * Built-in starter templates. These are real v2 designs exported from the editor
 * (decoded from their /w#<base64>, with author identity stripped); see
 * `scripts/gen-presets.ts` and `preset-data.ts`.
 *
 * Merged here rather than used raw: encoded configs only carry what differs from
 * the baseline, so a design decoded straight out of a share link is partial. The
 * preset thumbnails read elements directly, so they need the filled-in version.
 */
export const PRESETS: { name: string; config: WidgetConfig }[] = PRESET_DATA.map((p) => ({
  name: p.name,
  config: applyStarterMotion(mergeConfig(p.config), p.name),
}));
