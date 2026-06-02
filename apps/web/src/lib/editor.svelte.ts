import { decodeConfig, defaultConfig, encodeConfig, type WidgetConfig } from "./config";
import { mergeConfig } from "./config-merge";

export type ElementId = "background" | "art" | "title" | "artist" | "album" | "progress" | "duration";

export const ELEMENTS: { id: ElementId; label: string; icon: string }[] = [
  { id: "background", label: "Background", icon: "▭" },
  { id: "art", label: "Album art", icon: "▣" },
  { id: "title", label: "Title", icon: "T" },
  { id: "artist", label: "Artist", icon: "T" },
  { id: "album", label: "Album", icon: "T" },
  { id: "progress", label: "Progress bar", icon: "▬" },
  { id: "duration", label: "Duration", icon: "⏱" },
];

export const TEXT_ELEMENTS = ["title", "artist", "album", "duration"] as const;
export type TextElementId = (typeof TEXT_ELEMENTS)[number];

const STORAGE_KEY = "mw:config";

/** A fully-defaulted, deeply-cloned config (no shared refs with defaultConfig). */
export function freshConfig(partial?: Partial<WidgetConfig> | null): WidgetConfig {
  return structuredClone(mergeConfig(partial));
}

export class EditorState {
  config = $state<WidgetConfig>(freshConfig());
  selected = $state<ElementId | null>(null);

  /** Load from the URL hash, then localStorage, then defaults. */
  load() {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const parsed = decodeConfig(hash);
      if (parsed) {
        this.config = freshConfig(parsed);
        return;
      }
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) this.config = freshConfig(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }

  select(id: ElementId | null) {
    this.selected = id;
  }

  exportHash() {
    return encodeConfig(this.config);
  }

  /** Persist to localStorage. Call after edits. */
  save() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      /* ignore */
    }
  }

  applyPreset(preset: Partial<WidgetConfig>) {
    const user = this.config.lfmUser;
    const sessionKey = this.config.sessionKey;
    this.config = freshConfig({ ...preset, lfmUser: user || preset.lfmUser || "", sessionKey });
  }

  reset() {
    const user = this.config.lfmUser;
    const sessionKey = this.config.sessionKey;
    this.config = freshConfig({ lfmUser: user, sessionKey });
  }
}

export { defaultConfig };
