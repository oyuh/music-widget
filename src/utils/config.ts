// src/utils/config.ts
export type WidgetConfig = {
  lfmUser: string;
  theme: {
    bg: string;
    accent: string;
  autoFromArt: boolean; // when true, apply dominant album color to selected targets
  autoTargets?: { title: boolean; artist: boolean; album: boolean; meta: boolean };
    font: string; // Google font key
    text: { title: string; artist: string; album: string; meta: string };
  bgEnabled?: boolean; // optional for backward compatibility; default true
  };
  layout: {
    w: number; h: number; showArt: boolean;
    align: "left" | "right" | "center";
    artSize: number; // px size of album art edge
    artPosition: "left" | "right" | "top";
  scrollTriggerWidth: number; // px width at which text starts scrolling
  };
  fields: {
    title: boolean; artist: boolean; album: boolean;
    progress: boolean; duration: boolean; history: number;
  };
};

export const defaultConfig: WidgetConfig = {
  lfmUser: "",
  theme: {
    bg: "#000000CC",
    accent: "#1db954",
    autoFromArt: false,
  autoTargets: { title: false, artist: false, album: false, meta: false },
    font: "Inter",
  text: { title: "#ffffff", artist: "#e5e5e5", album: "#cfcfcf", meta: "#bdbdbd" },
  bgEnabled: true,
  },
  layout: { w: 420, h: 120, showArt: true, align: "left", artSize: 96, artPosition: "left", scrollTriggerWidth: 180 },
  fields: { title: true, artist: true, album: true, progress: true, duration: true, history: 50 },
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
