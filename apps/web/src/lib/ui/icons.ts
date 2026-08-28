// Inline icon paths for section headers, in the same spirit as tip-diagrams.ts:
// static authored markup rendered via {@html}, no dependency, no user input.
// Drawn on a 24x24 grid with `fill="none" stroke="currentColor"` set by the
// wrapper, so anything here should be strokes, not fills.

export const ICONS: Record<string, string> = {
  // Position & size: four-way move arrows.
  layout: `<path d="M12 3v18"/><path d="M3 12h18"/><path d="m15 6-3-3-3 3"/><path d="m15 18-3 3-3-3"/><path d="m6 9-3 3 3 3"/><path d="m18 9 3 3-3 3"/>`,
  // Anything typography.
  type: `<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>`,
  // Overflow scrolling: text sliding sideways.
  scroll: `<path d="M2 12h20"/><path d="m6 8-4 4 4 4"/><path d="m18 8 4 4-4 4"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
  image: `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>`,
  // Progress bar: a track with part of it filled.
  bar: `<rect x="2" y="9" width="20" height="6" rx="3"/><path d="M2 12h9"/>`,
  pause: `<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>`,
  // Background box.
  square: `<rect x="3" y="3" width="18" height="18" rx="2"/>`,
  // Tint: a drop of color laid over the fill.
  droplet: `<path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-2-1-3.9-3-5.5S12.5 5 12 2.5C11.5 5 10 7.4 8.5 9 6.5 10.6 5.5 12.5 5.5 14.5A6.5 6.5 0 0 0 12 21z"/>`,
  outline: `<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 3"/>`,
  // Drop shadow: a box with a second one offset behind it.
  shadow: `<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M9 21h10a2 2 0 0 0 2-2V9"/>`,
  palette: `<path d="M12 3a9 9 0 0 0 0 18 1.7 1.7 0 0 0 1.3-2.8 1.7 1.7 0 0 1 1.3-2.8h1.9A5.5 5.5 0 0 0 22 10c0-3.9-4.5-7-10-7z"/><circle cx="8" cy="9" r="1"/><circle cx="13" cy="7" r="1"/><circle cx="16.5" cy="10.5" r="1"/>`,
  // Song-switch animation.
  sparkles: `<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18 15.5 18.8 18l2.5.8-2.5.8L18 22l-.8-2.4-2.5-.8 2.5-.8z"/>`,
  // Footer links.
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.3 9.4a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 3.7"/><path d="M12 17.5h.01"/>`,
  shield: `<path d="M12 3 4.5 6v6c0 4.4 3.1 7.9 7.5 9 4.4-1.1 7.5-4.6 7.5-9V6z"/>`,
  document: `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>`,
  // Legal pages.
  browser: `<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M2.5 9h19"/><circle cx="6" cy="6.5" r=".6"/><circle cx="8.5" cy="6.5" r=".6"/>`,
  link: `<path d="M10 13a5 5 0 0 0 7.1.1l3-3a5 5 0 0 0-7.1-7.1L11.3 4.7"/><path d="M14 11a5 5 0 0 0-7.1-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>`,
  server: `<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01"/><path d="M7 16.5h.01"/>`,
  message: `<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>`,
  plug: `<path d="M9 2v6"/><path d="M15 2v6"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>`,
  trash: `<path d="M4 6h16"/><path d="M9 6V4h6v2"/><path d="M6.5 6l1 14h9l1-14"/><path d="M10 10v6"/><path d="M14 10v6"/>`,
  check: `<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.9"/>`,
  ban: `<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>`,
  alert: `<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  music: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
  edit: `<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>`,
  gift: `<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M12 8v13"/><path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5"/><path d="M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5"/>`,
  power: `<path d="M12 3v9"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>`,
};
