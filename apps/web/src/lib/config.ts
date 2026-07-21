// src/utils/config.ts

// ---- v2 element-based layout (additive; legacy renderer ignores these) ----
// `version` rides along in the encoded base64 so the renderer/editor know which
// engine a design uses: absent/1 => legacy grid, 2 => v2 free-positioned.
export const V2_ELEMENT_IDS = [
  "background",
  "art",
  "title",
  "artist",
  "album",
  "progress",
  "duration",
  "pause",
] as const;
export type V2ElementId = (typeof V2_ELEMENT_IDS)[number];
export const V2_TEXT_IDS = ["title", "artist", "album", "duration"] as const;
export type V2TextId = (typeof V2_TEXT_IDS)[number];

/** Which edge of an element an axis anchors against. */
export type V2Edge = "start" | "center" | "end";

/** An anchored relationship for one axis: this element's edge tracks another's. */
export type V2Snap = {
  to: V2ElementId; // anchor element
  myEdge: V2Edge; // which edge of THIS element snaps
  toEdge: V2Edge; // to which edge of the anchor element
  offset: number; // px gap captured at drop time
} | null;

export type V2Shadow = {
  enabled: boolean;
  blur: number;
  intensity: number; // 0-100 opacity %
  offsetX: number;
  offsetY: number;
  useOppositeColor: boolean;
  customColor?: string;
  // When true, the shadow is allowed to spill past the element's own box instead
  // of being clipped by it, i.e. the shadow extends as far as its blur/offset want.
  // Optional => absent/false keeps the existing clipped behavior (backward compatible).
  escape?: boolean;
};

export type V2Scroll = {
  enabled: boolean; // scroll when content overflows the box width
  direction: "left" | "right" | "bounce";
  speedPxPerSec: number;
  gapPx: number;
};

/** Background fill mode (background element only). */
export type V2Fill = "none" | "color" | "accent" | "art";

export type V2Element = {
  visible: boolean;
  x: number; // free position (px) from the widget's top-left
  y: number;
  w: number | null; // px width; null = auto (content)
  h: number | null; // px height; null = auto (content)
  z: number; // stacking order
  color: string; // text color / progress fill / bg color; "accent" => album/accent color
  // Per-element fallback used when color is "accent" and the album-art accent
  // can't be fetched/read. Optional => undefined falls back to the global
  // theme fallback (cfg.fallbackAccent). Keeps old configs byte-compatible.
  fallbackColor?: string;
  fill: V2Fill; // background element only: none/solid color/accent/blurred album art
  fillOpacity: number; // background: 0-100 opacity for the accent / album-art fill; progress: whole-bar opacity
  anchor: "left" | "center" | "right"; // text horizontal anchor (ignored by non-text)
  shadow: V2Shadow;
  scroll: V2Scroll; // text elements only (ignored otherwise)
  snapX: V2Snap; // null = free; set => overrides x (anchored relationship)
  snapY: V2Snap; // null = free; set => overrides y
  radius: number; // corner radius (art / background)
  // Art element only: image URL to show when the song has no cover, or the cover
  // fails to load. Empty/absent => the art just disappears (existing behavior).
  fallbackArt?: string;
  // Typography reuses theme.textSize/textStyle/textTransform/textFont[id].
};

export type V2SwitchAnim = {
  type: "none" | "fade" | "slide";
  direction: "up" | "down" | "left" | "right";
  durationMs: number;
  easing: string; // svelte/easing function name
};

export type WidgetV2 = {
  elements: Record<V2ElementId, V2Element>;
  switchAnim: V2SwitchAnim;
  // Runtime-only, set during merge (never encoded/edited): the decoded config
  // predates the configurable pause element, so the renderer shows the original
  // hardcoded pause badge instead of a pause element the user never set up.
  legacyPause?: boolean;
};

/**
 * Experimental: raw CSS the user writes for their own widget. Absent on every
 * config that never opted in, so existing widget URLs stay byte-identical.
 * `enabled: false` keeps the CSS around but stops applying it, so turning the
 * feature off returns the widget to exactly what it looked like before.
 */
export type WidgetExperimental = {
  enabled: boolean;
  css: string;
};

export type WidgetConfig = {
  version?: 1 | 2; // absent/1 => legacy grid; 2 => v2 free layout
  v2?: WidgetV2; // populated when version === 2
  experimental?: WidgetExperimental;
  lfmUser: string;
  sessionKey?: string | null; // Last.fm session key for private profile access
  apiKey?: string | null; // optional BYOK Last.fm API key, used client-side for faster, isolated requests
  // Accent to use when auto-from-art has no color or extraction fails
  fallbackAccent?: string;
  theme: {
    bg: string;
    accent: string;
    autoFromArt: boolean; // when true, apply dominant album color to selected targets
    autoTargets?: { title: boolean; artist: boolean; album: boolean; meta: boolean };
    font: string; // Global Google font key (fallback for texts without individual fonts)
    text: { title: string; artist: string; album: string; meta: string; duration: string };
    textSize?: { title: number; artist: number; album: number; meta: number; duration: number }; // px sizes per text
    textStyle?: {
      title: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
      artist: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
      album: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
      meta: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
      duration: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
    };
    textTransform?: {
      title: "none" | "uppercase" | "lowercase";
      artist: "none" | "uppercase" | "lowercase";
      album: "none" | "uppercase" | "lowercase";
      meta: "none" | "uppercase" | "lowercase";
      duration: "none" | "uppercase" | "lowercase";
    };
    textFont?: {
      title?: string; // Individual Google font key for title (overrides global font)
      artist?: string; // Individual Google font key for artist (overrides global font)
      album?: string; // Individual Google font key for album (overrides global font)
      meta?: string; // Individual Google font key for meta (overrides global font)
      duration?: string; // Individual Google font key for duration (overrides global font)
    };
    dropShadow?: {
      enabled: boolean;
      blur: number; // blur radius in px
      intensity: number; // 0-100 opacity percentage
      offsetX: number; // horizontal offset in px
      offsetY: number; // vertical offset in px
      useOppositeColor: boolean; // if true, use opposite color of text/bg, else use custom color
      customColor?: string; // custom shadow color when not using opposite
      targets: { // which elements get drop shadows
        text: boolean; // all text elements
        albumArt: boolean; // album art
        progressBar: boolean; // progress bar
        background: boolean; // widget background
      };
      perText?: { // per-text element drop shadow overrides
        title?: {
          enabled?: boolean;
          blur?: number;
          intensity?: number;
          offsetX?: number;
          offsetY?: number;
          useOppositeColor?: boolean;
          customColor?: string;
        };
        artist?: {
          enabled?: boolean;
          blur?: number;
          intensity?: number;
          offsetX?: number;
          offsetY?: number;
          useOppositeColor?: boolean;
          customColor?: string;
        };
        album?: {
          enabled?: boolean;
          blur?: number;
          intensity?: number;
          offsetX?: number;
          offsetY?: number;
          useOppositeColor?: boolean;
          customColor?: string;
        };
        meta?: {
          enabled?: boolean;
          blur?: number;
          intensity?: number;
          offsetX?: number;
          offsetY?: number;
          useOppositeColor?: boolean;
          customColor?: string;
        };
        duration?: {
          enabled?: boolean;
          blur?: number;
          intensity?: number;
          offsetX?: number;
          offsetY?: number;
          useOppositeColor?: boolean;
          customColor?: string;
        };
      };
    };
    bgEnabled?: boolean; // optional for backward compatibility; default true
  };
  layout: {
    w: number; h: number; showArt: boolean;
    align: "left" | "right" | "center";
    artSize: number; // px size of album art edge
    artPosition: "left" | "right" | "top";
    scrollTriggerWidth: number; // px width at which text starts scrolling
    textGap: number; // px gap between title/artist/album rows
    backgroundRadius?: number; // border radius of the widget background in px
    artRadius?: number; // border radius of the album art in px
    progressWidth?: number; // px width of the progress bar; 0/undefined = fill container
    progressOffset?: { x: number; y: number }; // free-move offset for the progress bar
    textOffset?: {
      title: { x: number; y: number };
      artist: { x: number; y: number };
      album: { x: number; y: number };
      meta: { x: number; y: number };
      duration: { x: number; y: number };
    };
  };
  marquee?: {
    speedPxPerSec: number; // scrolling speed in px/s
    gapPx: number; // gap between repeats in px
    perText?: {
      title?: { speedPxPerSec?: number; gapPx?: number };
      artist?: { speedPxPerSec?: number; gapPx?: number };
      album?: { speedPxPerSec?: number; gapPx?: number };
      meta?: { speedPxPerSec?: number; gapPx?: number };
    };
  };
  fields: {
    title: boolean; artist: boolean; album: boolean;
    progress: boolean; duration: boolean; history: number;
    pausedMode?: "label" | "transparent"; // behavior when not playing
    pausedText?: string; // custom text to show when paused and no album art
    durationFormat?: "elapsed" | "remaining" | "both"; // how to display duration text
    showDurationOnProgress?: boolean; // show duration text on progress bar or separately
    showDurationAsText?: boolean; // show duration as standalone text element (separate from progress)
  };
};

export const defaultConfig: WidgetConfig = {
  lfmUser: "",
  fallbackAccent: "#1db954", // default to current theme accent color
  theme: {
    bg: "#000000CC",
    accent: "#1db954",
    autoFromArt: false,
    autoTargets: { title: false, artist: true, album: false, meta: false },
    font: "Inter",
    text: { title: "#ffffff", artist: "#e5e5e5", album: "#cfcfcf", meta: "#bdbdbd", duration: "#a0a0a0" },
    textSize: { title: 16, artist: 14, album: 12, meta: 12, duration: 11 },
    textStyle: {
      title: { italic: false, underline: false, bold: true, strike: false },
      artist: { italic: false, underline: false, bold: false, strike: false },
      album: { italic: false, underline: false, bold: false, strike: false },
      meta: { italic: false, underline: false, bold: false, strike: false },
      duration: { italic: false, underline: false, bold: false, strike: false },
    },
    textTransform: {
      title: "none",
      artist: "none",
      album: "none",
      meta: "none",
      duration: "none",
    },
    textFont: {
      title: undefined, // Uses global font by default
      artist: undefined, // Uses global font by default
      album: undefined, // Uses global font by default
      meta: undefined, // Uses global font by default
      duration: undefined, // Uses global font by default
    },
    dropShadow: {
      enabled: false,
      blur: 4,
      intensity: 50,
      offsetX: 2,
      offsetY: 2,
      useOppositeColor: true,
      customColor: "#000000",
      targets: {
        text: true,
        albumArt: true,
        progressBar: true,
        background: false,
      },
      perText: {
        title: { enabled: true, useOppositeColor: true },
        artist: { enabled: true, useOppositeColor: true },
        album: { enabled: true, useOppositeColor: true },
        meta: { enabled: true, useOppositeColor: true },
        duration: { enabled: true, useOppositeColor: true },
      },
    },
    bgEnabled: true,
  },
  layout: { w: 420, h: 130, showArt: true, align: "left", artSize: 88, artPosition: "left", scrollTriggerWidth: 180, textGap: 2, backgroundRadius: 16, artRadius: 12, progressWidth: 0, progressOffset: { x: 0, y: 0 }, textOffset: { title: { x: 0, y: 0 }, artist: { x: 0, y: 0 }, album: { x: 0, y: 0 }, meta: { x: 0, y: 0 }, duration: { x: 0, y: 0 } } },
  marquee: { speedPxPerSec: 24, gapPx: 32, perText: undefined },
  fields: { title: true, artist: true, album: true, progress: true, duration: true, history: 50, pausedMode: "label", pausedText: "Paused", durationFormat: "both", showDurationOnProgress: true, showDurationAsText: false },
};

/**
 * Sanity-check a pasted fallback-art URL before the browser tries to load it.
 * "warn" still works, it's just a link that tends to get blocked. Actually
 * loading the image is a separate step (see the editor's Inspector).
 */
export type UrlCheck = { level: "ok" | "warn" | "bad"; msg: string };
export function checkArtUrl(url: string): UrlCheck {
  const u = url.trim();
  if (!u) return { level: "bad", msg: "" };
  // The whole design is packed into the widget URL, so a giant link (or pasted
  // image data) would bloat every copy of it.
  if (u.length > 600)
    return { level: "bad", msg: "That link is way too long. The whole design gets packed into your widget URL, so upload the image somewhere and paste a short link instead." };
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return { level: "bad", msg: "That's not a full link. It needs to start with https://" };
  }
  if (parsed.protocol === "http:")
    return { level: "warn", msg: "http:// links often get blocked. Use the https:// version if there is one." };
  if (parsed.protocol !== "https:") return { level: "bad", msg: "Needs to be an https:// link to an image file." };
  return { level: "ok", msg: "" };
}

// ---- experimental custom CSS ----

/** Class on the widget root that custom CSS gets scoped under. */
export const CSS_SCOPE = "mw-widget";

/** The whole design rides in the URL, so custom CSS gets a budget too. */
export const CSS_MAX = 4000;

/** Wiki page for the feature; linked from the modal and the sidebar panel. */
export const CSS_DOCS = "https://github.com/oyuh/music-widget/wiki/Custom-CSS";

// At-rules that are invalid inside a nesting block, so they're hoisted back to
// the top level instead of being silently dropped by the parser.
const HOIST_AT = /^@(-\w+-)?(keyframes|font-face|property)\b/i;

/**
 * Wrap user CSS in a nesting block so it can only ever reach inside the widget,
 * never the editor UI around it (that's the escape hatch for CSS that hides
 * everything). Rules nest as descendants of the scope, so `[data-el="title"]`
 * works as written. @keyframes / @font-face / @property can't live inside a
 * style rule, so they're hoisted out; @import is dropped (it would pull a
 * remote stylesheet that can change after the widget URL is shared).
 */
export function scopeCss(css: string, scope = `.${CSS_SCOPE}`): string {
  const src = css.replace(/@import\b[^;]*;?/gi, "");
  const hoisted: string[] = [];
  const scoped: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && depth > 0 && --depth === 0) {
      const chunk = src.slice(start, i + 1).trim();
      if (chunk) (HOIST_AT.test(chunk) ? hoisted : scoped).push(chunk);
      start = i + 1;
    }
  }
  // Unbalanced tail (mid-typing in the editor): keep it scoped so a half-written
  // rule can't leak out, and let the browser's own recovery handle the rest.
  const tail = src.slice(start).trim();
  if (tail) scoped.push(tail);
  const body = scoped.length ? `${scope}{\n${scoped.join("\n")}\n}` : "";
  return [...hoisted, body].filter(Boolean).join("\n");
}

/** True when this config should actually apply its custom CSS. */
export function customCssActive(c: WidgetConfig | null | undefined): boolean {
  return !!c?.experimental?.enabled && !!c.experimental.css.trim();
}

export function encodeConfig(c: WidgetConfig): string {
  const json = JSON.stringify(c);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return b64;
}

export function decodeConfig(hash: string): WidgetConfig | null {
  try {
    const b64 = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "===".slice((b64.length + 3) % 4);
    const json = decodeURIComponent(escape(atob(pad)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Format milliseconds to MM:SS format
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format duration text based on configuration
 */
export function formatDurationText(
  progressMs: number,
  durationMs: number | null,
  format: "elapsed" | "remaining" | "both"
): string {
  const elapsed = formatTime(progressMs);

  if (!durationMs || durationMs <= 0) {
    // When duration is unknown, just show elapsed time
    return format === "remaining" ? "--:--" : elapsed;
  }

  const total = formatTime(durationMs);
  const remaining = formatTime(Math.max(0, durationMs - progressMs));

  switch (format) {
    case "elapsed":
      return elapsed;
    case "remaining":
      return `-${remaining}`;
    case "both":
      return `${elapsed}/${total}`;
    default:
      return `${elapsed}/${total}`;
  }
}

/**
 * Apply text transformation based on configuration
 */
export function applyTextTransform(text: string, transform: "none" | "uppercase" | "lowercase"): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "none":
    default:
      return text;
  }
}

/**
 * Get the font family for a specific text element
 */
export function getTextFont(
  textElement: "title" | "artist" | "album" | "meta" | "duration",
  config: WidgetConfig
): string {
  const individualFont = config.theme.textFont?.[textElement];
  const font = individualFont || config.theme.font;
  return `'${font}', ui-sans-serif, system-ui, -apple-system`;
}

/**
 * Get all unique fonts used in the configuration (for Google Fonts loading)
 */
export function getUsedFonts(config: WidgetConfig): string[] {
  const fonts = new Set<string>();

  // Add global font
  fonts.add(config.theme.font);

  // Add individual fonts if they exist
  if (config.theme.textFont) {
    Object.values(config.theme.textFont).forEach(font => {
      if (font) fonts.add(font);
    });
  }

  return Array.from(fonts);
}

// ---- v2 migration ----

export const DEFAULT_SWITCH_ANIM: V2SwitchAnim = {
  type: "fade",
  direction: "up",
  durationMs: 350,
  easing: "cubicOut",
};

/** Default per-axis snap is "none" (free position). */
export function isV2(c: WidgetConfig | null | undefined): c is WidgetConfig & { v2: WidgetV2 } {
  return !!c && c.version === 2 && !!c.v2;
}

/**
 * Build a v2 element-based layout from a legacy (grid) config, reproducing the
 * legacy look as closely as a free-positioned layout can. Carries over per-text
 * color/size/shadow/scroll so an upgraded design renders almost identically.
 * Returns a NEW config with version:2 + v2 set; legacy fields are preserved so
 * the design degrades gracefully if the version flag is ever lost.
 */
export function migrateToV2(cfg: WidgetConfig): WidgetConfig {
  const L = cfg.layout;
  const T = cfg.theme;
  // Default per-element accent fallback, seeded from the global fallback so
  // existing designs look identical until a per-element color is chosen.
  const fbColor = cfg.fallbackAccent ?? T.accent ?? "#1db954";
  const pad = 12;
  const gap = 12;
  const ts = T.textSize ?? { title: 16, artist: 14, album: 12, meta: 12, duration: 11 };
  const off = L.textOffset ?? {
    title: { x: 0, y: 0 },
    artist: { x: 0, y: 0 },
    album: { x: 0, y: 0 },
    meta: { x: 0, y: 0 },
    duration: { x: 0, y: 0 },
  };
  const showArt = L.showArt;
  const artSize = L.artSize;

  // Art box + text-column geometry from the legacy art position.
  let artX = pad;
  let artY = pad;
  let colX = pad;
  let colW = L.w - pad * 2;
  if (!showArt) {
    colX = pad;
    colW = L.w - pad * 2;
  } else if (L.artPosition === "right") {
    artX = L.w - pad - artSize;
    artY = Math.max(pad, Math.round((L.h - artSize) / 2));
    colX = pad;
    colW = L.w - artSize - gap - pad * 2;
  } else if (L.artPosition === "top") {
    artX = Math.round((L.w - artSize) / 2);
    artY = pad;
    colX = pad;
    colW = L.w - pad * 2;
  } else {
    // left (default)
    artX = pad;
    artY = Math.max(pad, Math.round((L.h - artSize) / 2));
    colX = pad + artSize + gap;
    colW = L.w - artSize - gap - pad * 2;
  }

  const lineH = (id: V2TextId) => Math.round((ts[id] ?? 12) * 1.4) + (L.textGap ?? 2);
  const oppositeAlign = L.align === "right" ? "right" : L.align === "center" ? "center" : "left";

  // Per-element drop shadow carried from the legacy global + per-text settings.
  const ds = T.dropShadow;
  const shadowFor = (target: "text" | "albumArt" | "progressBar" | "background", textId?: V2TextId): V2Shadow | undefined => {
    if (!ds) return undefined;
    const targetOn = ds.targets?.[target] ?? false;
    const per = textId ? ds.perText?.[textId] : undefined;
    return {
      enabled: !!ds.enabled && targetOn && (per?.enabled ?? true),
      blur: per?.blur ?? ds.blur,
      intensity: per?.intensity ?? ds.intensity,
      offsetX: per?.offsetX ?? ds.offsetX,
      offsetY: per?.offsetY ?? ds.offsetY,
      useOppositeColor: per?.useOppositeColor ?? ds.useOppositeColor,
      customColor: per?.customColor ?? ds.customColor,
      escape: false,
    };
  };

  const baseSpeed = cfg.marquee?.speedPxPerSec ?? 24;
  const baseGap = cfg.marquee?.gapPx ?? 32;
  const noScroll = (): V2Scroll => ({ enabled: false, direction: "left", speedPxPerSec: baseSpeed, gapPx: baseGap });
  const defaultShadow = (): V2Shadow => ({
    enabled: false,
    blur: ds?.blur ?? 4,
    intensity: ds?.intensity ?? 50,
    offsetX: ds?.offsetX ?? 2,
    offsetY: ds?.offsetY ?? 2,
    useOppositeColor: ds?.useOppositeColor ?? true,
    customColor: ds?.customColor ?? "#000000",
    escape: false,
  });

  const scrollFor = (id: V2TextId): V2Scroll => ({
    enabled: true,
    direction: L.align === "right" ? "right" : "left",
    speedPxPerSec: cfg.marquee?.perText?.[id as "title" | "artist" | "album"]?.speedPxPerSec ?? baseSpeed,
    gapPx: cfg.marquee?.perText?.[id as "title" | "artist" | "album"]?.gapPx ?? baseGap,
  });

  const makeText = (id: V2TextId, x: number, y: number, visible: boolean, z: number): V2Element => ({
    visible,
    x: Math.round(x + (off[id]?.x ?? 0)),
    y: Math.round(y + (off[id]?.y ?? 0)),
    w: null,
    h: null,
    z,
    color: T.text[id] ?? "#ffffff",
    fallbackColor: fbColor,
    fill: "color",
    fillOpacity: 100,
    anchor: oppositeAlign,
    shadow: shadowFor("text", id) ?? defaultShadow(),
    scroll: scrollFor(id),
    snapX: null,
    snapY: null,
    radius: 0,
  });

  // Stack title / artist / album down the text column.
  const colTop = showArt && L.artPosition === "top" ? artY + artSize + gap : pad + 4;
  let y = colTop;
  const title = makeText("title", colX, y, cfg.fields.title, 2);
  y += lineH("title");
  const artist = makeText("artist", colX, y, cfg.fields.artist, 3);
  y += lineH("artist");
  const album = makeText("album", colX, y, cfg.fields.album, 4);
  if (cfg.fields.album) y += lineH("album");

  // Progress bar below the text rows.
  const progOff = L.progressOffset ?? { x: 0, y: 0 };
  const progW = L.progressWidth && L.progressWidth > 0 ? L.progressWidth : colW;
  const progY = y + 6;
  const progress: V2Element = {
    visible: cfg.fields.progress,
    x: Math.round(colX + (progOff.x ?? 0)),
    y: Math.round(progY + (progOff.y ?? 0)),
    w: Math.max(20, Math.round(progW)),
    h: 6,
    z: 5,
    color: "accent",
    fallbackColor: fbColor,
    fill: "color",
    fillOpacity: 100,
    anchor: "left",
    shadow: shadowFor("progressBar") ?? defaultShadow(),
    scroll: noScroll(),
    radius: 4,
    snapX: null,
    snapY: null,
  };

  // Duration text under the progress bar.
  const duration = makeText("duration", colX, progY + 14, cfg.fields.duration ?? false, 6);

  // Pause symbol: centered on the album art and anchored to it (center/center) so
  // it tracks the art if it moves or resizes. Only rendered when paused/stopped;
  // when the art is hidden or fails to load the renderer re-homes it after the title.
  const pauseSize = 28;
  const pause: V2Element = {
    visible: true,
    x: Math.round(artX + artSize / 2 - pauseSize / 2),
    y: Math.round(artY + artSize / 2 - pauseSize / 2),
    w: pauseSize,
    h: pauseSize,
    z: 7,
    color: "#ffffff",
    fallbackColor: fbColor,
    fill: "color",
    fillOpacity: 100,
    anchor: "left",
    radius: 0,
    shadow: defaultShadow(),
    scroll: noScroll(),
    snapX: showArt ? { to: "art", myEdge: "center", toEdge: "center", offset: 0 } : null,
    snapY: showArt ? { to: "art", myEdge: "center", toEdge: "center", offset: 0 } : null,
  };

  const elements: Record<V2ElementId, V2Element> = {
    background: {
      visible: true,
      x: 0,
      y: 0,
      w: L.w,
      h: L.h,
      z: 0,
      color: T.bg,
      fallbackColor: fbColor,
      fill: (T.bgEnabled ?? true) ? "color" : "none",
      fillOpacity: 100,
      anchor: "left",
      radius: L.backgroundRadius ?? 16,
      shadow: shadowFor("background") ?? defaultShadow(),
      scroll: noScroll(),
      snapX: null,
      snapY: null,
    },
    art: {
      visible: showArt,
      x: Math.round(artX),
      y: Math.round(artY),
      w: artSize,
      h: artSize,
      z: 1,
      color: "#ffffff",
      fallbackColor: fbColor,
      fill: "color",
      fillOpacity: 100,
      anchor: "left",
      radius: L.artRadius ?? 12,
      shadow: shadowFor("albumArt") ?? defaultShadow(),
      scroll: noScroll(),
      snapX: null,
      snapY: null,
    },
    title,
    artist,
    album,
    progress,
    duration,
    pause,
  };

  return {
    ...cfg,
    version: 2,
    v2: { elements, switchAnim: { ...DEFAULT_SWITCH_ANIM } },
  };
}
