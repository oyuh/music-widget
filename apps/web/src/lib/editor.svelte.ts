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

/**
 * A fully-defaulted, deeply-cloned config. JSON round-tripping strips any Svelte
 * state proxies from the input (structuredClone throws on those) and ensures the
 * result shares no references with defaultConfig.
 */
export function freshConfig(partial?: Partial<WidgetConfig> | null): WidgetConfig {
  const input = partial ? (JSON.parse(JSON.stringify(partial)) as Partial<WidgetConfig>) : undefined;
  return JSON.parse(JSON.stringify(mergeConfig(input))) as WidgetConfig;
}

export class EditorState {
  config = $state<WidgetConfig>(freshConfig());
  selected = $state<ElementId | null>(null);
  sessionName = $state<string | null>(null);

  // History: up to 5 undo steps (+ redo). Snapshots coalesce per discrete edit.
  undoStack = $state<WidgetConfig[]>([]);
  redoStack = $state<WidgetConfig[]>([]);
  dirty = $state(false);
  #lastCommitted = "";

  // Custom presets (localStorage), up to 10.
  customPresets = $state<{ id: string; name: string; config: WidgetConfig }[]>([]);

  /** Load from the URL hash, then localStorage, then defaults; apply any connected session. */
  load() {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    let loaded = false;
    if (hash && hash.length > 1) {
      const parsed = decodeConfig(hash);
      if (parsed) {
        this.config = freshConfig(parsed);
        loaded = true;
      }
    }
    if (!loaded) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) this.config = freshConfig(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }

    // Pick up a connected Last.fm session stored by the /callback flow.
    try {
      const key = localStorage.getItem("lfm_session_key");
      const name = localStorage.getItem("lfm_session_name");
      if (key) {
        this.config.sessionKey = key;
        this.sessionName = name;
        if (!this.config.lfmUser && name) this.config.lfmUser = name;
      }
    } catch {
      /* ignore */
    }
  }

  disconnect() {
    this.config.sessionKey = null;
    this.sessionName = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("lfm_session_key");
      localStorage.removeItem("lfm_session_name");
    }
    this.save();
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

  /**
   * Import settings from a /w share link or a raw base64 config string.
   * Keeps your own Last.fm user if you have one, and never imports a foreign
   * session key. Returns false when the input can't be decoded.
   */
  importConfig(input: string): boolean {
    const raw = input.trim();
    if (!raw) return false;
    const hash = raw.includes("#") ? raw.slice(raw.indexOf("#") + 1) : raw;
    const parsed = decodeConfig(hash) as Partial<WidgetConfig> | null;
    if (!parsed || !parsed.theme || !parsed.layout) return false;

    const currentUser = this.config.lfmUser;
    const currentSession = this.config.sessionKey ?? null;
    const merged = freshConfig(parsed);
    merged.lfmUser = currentUser || merged.lfmUser || "";
    merged.sessionKey = currentUser ? currentSession : null;
    this.config = merged;
    this.save();
    return true;
  }

  reset() {
    const user = this.config.lfmUser;
    const sessionKey = this.config.sessionKey;
    this.config = freshConfig({ lfmUser: user, sessionKey });
  }

  // ---- history ----
  initHistory() {
    this.#lastCommitted = JSON.stringify(this.config);
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Push the pre-edit state onto the undo stack if the config changed since the
   * last commit. Called after edits settle (debounced) so a drag or slider sweep
   * collapses into a single undo step. Keeps at most 5.
   */
  commitIfChanged() {
    const now = JSON.stringify(this.config);
    if (now !== this.#lastCommitted && this.#lastCommitted) {
      try {
        this.undoStack.push(freshConfig(JSON.parse(this.#lastCommitted)));
        if (this.undoStack.length > 5) this.undoStack.shift();
        this.redoStack = [];
      } catch {
        /* ignore */
      }
    }
    this.#lastCommitted = now;
    this.dirty = false;
  }

  // Enabled as soon as there's an uncommitted change, so undo feels instant.
  get canUndo() {
    return this.undoStack.length > 0 || this.dirty;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    this.commitIfChanged(); // flush any pending edit into history first
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(freshConfig(this.config));
    if (this.redoStack.length > 5) this.redoStack.shift();
    this.config = freshConfig(prev);
    this.#lastCommitted = JSON.stringify(this.config);
    this.dirty = false;
    this.save();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(freshConfig(this.config));
    if (this.undoStack.length > 5) this.undoStack.shift();
    this.config = freshConfig(next);
    this.#lastCommitted = JSON.stringify(this.config);
    this.dirty = false;
    this.save();
  }

  // ---- custom presets (localStorage, up to 10) ----
  loadPresets() {
    if (typeof window === "undefined") return;
    try {
      const s = localStorage.getItem("mw:presets");
      if (s) this.customPresets = JSON.parse(s);
    } catch {
      /* ignore */
    }
  }

  #savePresets() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("mw:presets", JSON.stringify(this.customPresets));
    } catch {
      /* ignore */
    }
  }

  get canSavePreset() {
    return this.customPresets.length < 10;
  }

  /** Snapshot the current look (without user/session) as a named preset. */
  saveCurrentAsPreset(name: string) {
    if (this.customPresets.length >= 10) return;
    const config = freshConfig({ ...this.config, lfmUser: "", sessionKey: null });
    this.customPresets.push({
      id: crypto.randomUUID(),
      name: name.trim() || `Preset ${this.customPresets.length + 1}`,
      config,
    });
    this.#savePresets();
  }

  overridePreset(id: string) {
    const p = this.customPresets.find((x) => x.id === id);
    if (!p) return;
    p.config = freshConfig({ ...this.config, lfmUser: "", sessionKey: null });
    this.#savePresets();
  }

  deletePreset(id: string) {
    this.customPresets = this.customPresets.filter((x) => x.id !== id);
    this.#savePresets();
  }

  applyCustomPreset(id: string) {
    const p = this.customPresets.find((x) => x.id === id);
    if (p) this.applyPreset(p.config);
  }

  /** Share URL for a preset, with the editor's current Last.fm user/session injected. */
  presetShareUrl(id: string) {
    if (typeof window === "undefined") return "";
    const p = this.customPresets.find((x) => x.id === id);
    if (!p) return "";
    const cfg = { ...p.config, lfmUser: this.config.lfmUser, sessionKey: this.config.sessionKey };
    return `${window.location.origin}/w#${encodeConfig(cfg)}`;
  }
}

export { defaultConfig };
