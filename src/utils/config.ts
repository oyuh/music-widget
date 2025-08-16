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
    font: string; // Google font key
    text: { title: string; artist: string; album: string; meta: string };
  textSize?: { title: number; artist: number; album: number; meta: number }; // px sizes per text
  textStyle?: {
    title: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
    artist: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
    album: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
    meta: { italic: boolean; underline: boolean; bold: boolean; strike: boolean };
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
  textOffset?: {
    title: { x: number; y: number };
    artist: { x: number; y: number };
    album: { x: number; y: number };
    meta: { x: number; y: number };
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
  text: { title: "#ffffff", artist: "#e5e5e5", album: "#cfcfcf", meta: "#bdbdbd" },
  textSize: { title: 16, artist: 14, album: 12, meta: 12 },
  textStyle: {
    title: { italic: false, underline: false, bold: true, strike: false },
    artist: { italic: false, underline: false, bold: false, strike: false },
    album: { italic: false, underline: false, bold: false, strike: false },
    meta: { italic: false, underline: false, bold: false, strike: false },
  },
  bgEnabled: true,
  },
  layout: { w: 420, h: 120, showArt: true, align: "left", artSize: 96, artPosition: "left", scrollTriggerWidth: 180, textGap: 2, textOffset: { title: { x: 0, y: 0 }, artist: { x: 0, y: 0 }, album: { x: 0, y: 0 }, meta: { x: 0, y: 0 } } },
  marquee: { speedPxPerSec: 24, gapPx: 32, perText: undefined },
  fields: { title: true, artist: true, album: true, progress: true, duration: true, history: 50, pausedMode: "label" },
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
