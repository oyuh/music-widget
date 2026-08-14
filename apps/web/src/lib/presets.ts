import type { WidgetConfig } from "./config";
import { mergeConfig } from "./config-merge";
import { PRESET_DATA } from "./preset-data";

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
  config: mergeConfig(p.config),
}));
