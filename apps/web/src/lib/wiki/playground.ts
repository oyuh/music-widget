import { defaultConfig, migrateToV2, type WidgetConfig } from "$lib/config";

export const recipes = [
  { name: "Blue title", css: '[data-el="title"] > div,\n[data-el="title"] .marquee__item {\n  color: #93c5fd !important;\n  letter-spacing: 0.04em;\n}' },
  { name: "Record sleeve", css: '[data-el="art"] > img {\n  border-radius: 50% !important;\n  border: 3px solid #93c5fd;\n}' },
  { name: "Outline frame", css: '[data-el="background"] {\n  border: 1px solid #93c5fd;\n  border-radius: 0 !important;\n}' },
  { name: "Striped progress", css: '[data-el="progress"] > div > div {\n  background-image: repeating-linear-gradient(\n    45deg, #ffffff55 0 6px, transparent 6px 12px\n  );\n}' },
];

export const elementNames: Record<string, string> = {
  art: "Album art", title: "Title", artist: "Artist", album: "Album", progress: "Progress bar", duration: "Duration", pause: "Pause symbol",
};

export function demoConfig(): WidgetConfig {
  const cfg = migrateToV2(structuredClone(defaultConfig));
  cfg.theme.font = "system-ui";
  cfg.theme.accent = "#93c5fd";
  cfg.layout.w = 420;
  cfg.layout.h = 160;
  cfg.experimental = { enabled: true, css: recipes[0].css };
  cfg.v2!.switchAnim.type = "none";
  const positions: Record<string, number[]> = {
    art: [20, 24, 88, 88], title: [128, 24, 266, 28], artist: [128, 56, 266, 22],
    album: [128, 84, 266, 20], progress: [20, 132, 314, 5], duration: [346, 120, 54, 24], pause: [382, 98, 18, 16],
  };
  for (const [id, el] of Object.entries(cfg.v2!.elements)) {
    el.snapX = null;
    el.snapY = null;
    el.scroll.enabled = false;
    el.shadow.enabled = false;
    el.anchor = "left";
    if (positions[id]) [el.x, el.y, el.w, el.h] = positions[id];
    el.visible = true;
  }
  Object.assign(cfg.v2!.elements.background, { w: 420, h: 160, radius: 4, color: "#181818", fill: "color" });
  cfg.fields.durationFormat = "elapsed";
  return cfg;
}

export function moveElement(cfg: WidgetConfig, id: string, x: number, y: number) {
  const el = cfg.v2?.elements[id];
  if (!el || !(id in elementNames) || !Number.isFinite(x) || !Number.isFinite(y)) return;
  el.x = Math.round(Math.max(0, Math.min(cfg.layout.w - (el.w ?? 0), x)));
  el.y = Math.round(Math.max(0, Math.min(cfg.layout.h - (el.h ?? 0), y)));
}

export const sampleArt = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="176" height="176" viewBox="0 0 176 176"><rect width="176" height="176" fill="#a9c7ed"/><circle cx="88" cy="88" r="66" fill="#172033"/><circle cx="88" cy="88" r="48" fill="none" stroke="#52617a"/><circle cx="88" cy="88" r="29" fill="#a9c7ed"/><circle cx="88" cy="88" r="6" fill="#172033"/></svg>');
