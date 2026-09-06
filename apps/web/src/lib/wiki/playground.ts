import { defaultConfig, migrateToV2, type WidgetConfig } from "$lib/config";

export const recipes = [
  {
    id: "accent-title",
    name: "Accent title",
    description: "Blue, uppercase title with wider tracking.",
    css: '[data-el="title"] > div,\n[data-el="title"] .marquee__item {\n  color: #93c5fd !important;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}',
  },
  {
    id: "vinyl-art",
    name: "Spinning vinyl",
    description: "Round album art with a record edge and slow rotation.",
    css: '[data-el="art"] > img {\n  border: 4px solid #09090b;\n  border-radius: 50% !important;\n  animation: vinyl-spin 10s linear infinite;\n}\n\n@keyframes vinyl-spin {\n  to { transform: rotate(360deg); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-el="art"] > img { animation: none; }\n}',
  },
  {
    id: "outline-card",
    name: "Outlined card",
    description: "Square corners and a crisp accent border.",
    css: '[data-el="background"] {\n  border: 1px solid #93c5fd;\n  border-radius: 0 !important;\n}',
  },
  {
    id: "striped-progress",
    name: "Striped progress",
    description: "Adds diagonal detail to the played section.",
    css: '[data-el="progress"] > div > div {\n  background-image: repeating-linear-gradient(\n    45deg, #ffffff55 0 6px, transparent 6px 12px\n  );\n}',
  },
];

export function demoConfig(): WidgetConfig {
  const cfg = migrateToV2(structuredClone(defaultConfig));
  cfg.lfmUser = "";
  cfg.sessionKey = null;
  cfg.apiKey = "";
  cfg.experimental = { enabled: false, css: "" };
  cfg.v2!.switchAnim.type = "none";
  return cfg;
}

export const sampleArt = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="176" height="176" viewBox="0 0 176 176"><rect width="176" height="176" fill="#a9c7ed"/><circle cx="88" cy="88" r="66" fill="#172033"/><circle cx="88" cy="88" r="48" fill="none" stroke="#52617a"/><circle cx="88" cy="88" r="29" fill="#a9c7ed"/><circle cx="88" cy="88" r="6" fill="#172033"/></svg>');
