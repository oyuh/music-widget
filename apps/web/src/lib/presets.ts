import type { WidgetConfig } from "./config";
import { PRESET_DATA } from "./preset-data";

/**
 * Built-in starter templates. These are real v2 designs exported from the editor
 * (decoded from their /w#<base64>, with author identity stripped) — see
 * `scripts/gen-presets.ts` and `preset-data.ts`. They apply directly as v2.
 */
export const PRESETS: { name: string; config: WidgetConfig }[] = PRESET_DATA;
