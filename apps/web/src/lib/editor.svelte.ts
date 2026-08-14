import {
  decodeConfig,
  defaultConfig,
  encodeConfig,
  instanceIds,
  instanceLabel,
  isBaseId,
  kindOf,
  migrateToV2,
  nextInstanceId,
  resolveTextProps,
  type V2Element,
  type V2Kind,
  type V2Snap,
  type V2TextId,
  type WidgetConfig,
  type WidgetV2,
} from "./config";
import { mergeConfig } from "./config-merge";
import { copyStyle, isTextElement } from "./element-style";

// Re-exported so components have one import for everything editor-side; the
// implementations live in a plain .ts module because they're pure config work
// with no runes in them.
export { TextStyleView, TintView, isTextElement } from "./element-style";

/** An element INSTANCE id ("title", "title#2"). See config.ts for the scheme. */
export type ElementId = string;

export const ELEMENTS: { id: V2Kind; label: string; icon: string }[] = [
  { id: "background", label: "Background", icon: "▭" },
  { id: "art", label: "Album art", icon: "▣" },
  { id: "title", label: "Title", icon: "T" },
  { id: "artist", label: "Artist", icon: "T" },
  { id: "album", label: "Album", icon: "T" },
  { id: "progress", label: "Progress bar", icon: "▬" },
  { id: "duration", label: "Duration", icon: "⏱" },
  { id: "pause", label: "Pause symbol", icon: "⏸" },
];

const LABEL_OF = Object.fromEntries(ELEMENTS.map((e) => [e.id, e.label])) as Record<V2Kind, string>;

/** Display name for one instance, e.g. "Album art" / "Album art 2". */
export function labelFor(id: ElementId): string {
  return instanceLabel(id, LABEL_OF[kindOf(id)] ?? id);
}

export const TEXT_ELEMENTS = ["title", "artist", "album", "duration"] as const;
export type TextElementId = (typeof TEXT_ELEMENTS)[number];

const STORAGE_KEY = "mw:config";

/**
 * A fully-defaulted, deeply-cloned config, always in v2 form. JSON round-tripping
 * strips any Svelte state proxies from the input (structuredClone throws on those)
 * and ensures the result shares no references with defaultConfig. Legacy configs
 * (no version flag) are upgraded to v2 so the editor only ever edits v2.
 */
export function freshConfig(partial?: Partial<WidgetConfig> | null): WidgetConfig {
  const input = partial ? (JSON.parse(JSON.stringify(partial)) as Partial<WidgetConfig>) : undefined;
  const merged = mergeConfig(input);
  const v2 = merged.version === 2 && merged.v2 ? merged : migrateToV2(merged);
  // The editor always edits the full new-style config: opening an old design
  // upgrades it to the configurable pause element, so drop the runtime-only
  // legacy-pause flag rather than baking it into saved/encoded configs.
  if (v2.v2) delete v2.v2.legacyPause;
  return JSON.parse(JSON.stringify(v2)) as WidgetConfig;
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

  /**
   * Drop a selection the current config no longer has. Swapping the whole config
   * (undo, redo, presets, import, reset) can retire the instance that was
   * selected, e.g. undoing the very duplicate that created it, and the inspector
   * would otherwise keep showing that element's name with nothing behind it.
   */
  #pruneSelection() {
    if (this.selected && !this.config.v2?.elements[this.selected]) this.selected = null;
  }

  // ---- v2 element helpers ----
  get v2(): WidgetV2 {
    return this.config.v2!;
  }

  /** The v2 element record for an id (config is always v2 in the editor). */
  el(id: ElementId): V2Element {
    return this.config.v2!.elements[id];
  }

  /** Patch a v2 element in place (reactive). */
  updateEl(id: ElementId, patch: Partial<V2Element>) {
    Object.assign(this.config.v2!.elements[id], patch);
  }

  /** Set or clear an axis snap. Setting null = free position on that axis. */
  setSnap(id: ElementId, axis: "x" | "y", snap: V2Snap) {
    const el = this.config.v2!.elements[id];
    if (axis === "x") el.snapX = snap;
    else el.snapY = snap;
  }

  clearSnap(id: ElementId, axis: "x" | "y") {
    this.setSnap(id, axis, null);
  }

  /**
   * True when the axis snap actually drives the element's position (the anchor
   * exists, isn't the element itself, and is visible); mirrors the fallback
   * rule in v2-layout.ts. When inactive, the element renders at its free
   * coordinate, so editor moves must adjust that instead of the snap offset.
   */
  snapActive(id: ElementId, axis: "x" | "y"): boolean {
    const el = this.config.v2!.elements[id];
    const snap = axis === "x" ? el.snapX : el.snapY;
    if (!snap || snap.to === id) return false;
    return !!this.config.v2!.elements[snap.to]?.visible;
  }

  /** Flip a dimension between auto (null) and a fixed px value. */
  toggleAuto(id: ElementId, dim: "w" | "h") {
    const el = this.config.v2!.elements[id];
    el[dim] = el[dim] === null ? (dim === "w" ? 160 : 40) : null;
  }

  // ---- instances (up to MAX_PER_KIND of each kind) ----

  /** Every id of a kind currently in the design, base first. */
  idsOf(kind: V2Kind): ElementId[] {
    return instanceIds(this.config.v2!.elements, kind);
  }

  canAdd(kind: V2Kind): boolean {
    return nextInstanceId(this.config.v2!.elements, kind) !== null;
  }

  /**
   * Copy an element into a new instance of its kind, nudged clear of the
   * original so it's visible and grabbable straight away. A copy of a SNAPPED
   * element keeps the snap and nudges its offset instead, so it stays anchored.
   * Text copies get their own typography block seeded from what they render
   * today, which is what makes "Title 2" independently styleable.
   */
  duplicate(id: ElementId): ElementId | null {
    const els = this.config.v2!.elements;
    const kind = kindOf(id);
    const newId = nextInstanceId(els, kind);
    if (!newId || !els[id]) return null;

    const copy = JSON.parse(JSON.stringify(els[id])) as V2Element;
    const NUDGE = 12;
    if (copy.snapX) copy.snapX.offset += NUDGE;
    else copy.x += NUDGE;
    if (copy.snapY) copy.snapY.offset += NUDGE;
    else copy.y += NUDGE;
    copy.z = Math.min(20, Math.max(...Object.values(els).map((e) => e.z)) + 1);
    copy.visible = true;
    // Only the primary art's fallback URL is read, and only its panel offers the
    // field, so a copy would carry up to 600 dead characters in every share link.
    delete copy.fallbackArt;
    if (isTextElement(id)) {
      const r = resolveTextProps(this.config, id);
      copy.text = {
        size: r.size,
        bold: r.bold,
        italic: r.italic,
        underline: r.underline,
        strike: r.strike,
        transform: r.transform,
        // "" is an explicit "use the global font", so the copy doesn't silently
        // start following the kind's theme font after the original changes.
        font: this.config.theme.textFont?.[kind as V2TextId] ?? "",
      };
    }

    els[newId] = copy;
    this.selected = newId;
    this.save();
    return newId;
  }

  /** Apply another instance's look to this one (see `copyStyle`). */
  copyStyleFrom(targetId: ElementId, sourceId: ElementId): boolean {
    if (!copyStyle(this.config, targetId, sourceId)) return false;
    this.save();
    return true;
  }

  /**
   * Drop an extra instance. The base instance of a kind is never removable (hide
   * it instead), so a design always has a background, a title and so on to fall
   * back on. Anything snapped to the removed element is freed rather than left
   * pointing at nothing.
   */
  removeInstance(id: ElementId): boolean {
    if (isBaseId(id)) return false;
    const els = this.config.v2!.elements;
    if (!els[id]) return false;
    delete els[id];
    for (const el of Object.values(els)) {
      if (el.snapX?.to === id) el.snapX = null;
      if (el.snapY?.to === id) el.snapY = null;
    }
    if (this.selected === id) this.selected = kindOf(id);
    this.save();
    return true;
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
    this.#pruneSelection();
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
    this.#pruneSelection();
    this.save();
    return true;
  }

  reset() {
    const user = this.config.lfmUser;
    const sessionKey = this.config.sessionKey;
    this.config = freshConfig({ lfmUser: user, sessionKey });
    this.#pruneSelection();
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
    this.#pruneSelection();
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
    this.#pruneSelection();
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
