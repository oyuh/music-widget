// src/utils/config.ts
export type WidgetConfig = {
  lfmUser: string;
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
  layout: { w: 420, h: 130, showArt: true, align: "left", artSize: 88, artPosition: "left", scrollTriggerWidth: 180, textGap: 2, backgroundRadius: 16, artRadius: 12, textOffset: { title: { x: 0, y: 0 }, artist: { x: 0, y: 0 }, album: { x: 0, y: 0 }, meta: { x: 0, y: 0 }, duration: { x: 0, y: 0 } } },
  marquee: { speedPxPerSec: 24, gapPx: 32, perText: undefined },
  fields: { title: true, artist: true, album: true, progress: true, duration: true, history: 50, pausedMode: "label", pausedText: "Paused", durationFormat: "both", showDurationOnProgress: true, showDurationAsText: false },
};

export function encodeConfig(c: WidgetConfig): string {
  const json = JSON.stringify(c);
  const b64 = (typeof window === "undefined" ? Buffer.from(json).toString("base64") : btoa(json))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return b64;
}

export function decodeConfig(hash: string): WidgetConfig | null {
  try {
    const b64 = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "===".slice((b64.length + 3) % 4);
    const json = typeof window === "undefined" ? Buffer.from(pad, "base64").toString("utf8") : atob(pad);
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
