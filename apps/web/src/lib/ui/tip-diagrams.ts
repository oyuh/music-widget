// Small inline-SVG diagrams shown inside InfoTip hover tooltips for the settings
// that are hard to grok from a label alone. Rendered via {@html}, so the markup
// is authored here (trusted, static); no user input is ever interpolated.
//
// Style: dark tooltip card, so strokes are light zinc and the highlighted bit is
// the editor green. viewBox is a consistent 220x110. Most diagrams are a
// before/after (two panels split by a divider) with small caps labels on top and
// a caption under each panel at y=104. Any filter/clip/pattern ids are prefixed
// per-key so two diagrams can never collide.

import { ICONS } from "./icons";

const C = {
  frame: "#3f3f46", // zinc-700  (faint frame / widget edge)
  line: "#a1a1aa", // zinc-400  (neutral box stroke)
  fillBox: "#27272a", // zinc-800  (box fill)
  text: "#d4d4d8", // zinc-300  (sample text)
  hi: "#4ade80", // green-400  (the thing the setting controls)
  keyShadow: "#18181b", // zinc-900  (the depth under a keycap)
  shadow: "#71717a", // zinc-500  (a drop shadow that still shows on the dark card)
  accent: "#3b82f6", // blue-500  (stand-in for an album-art accent)
};

// ---- shared pieces, so every diagram speaks the same visual language ----

/** Small caps tag, like FRONT / BACK. */
const label = (x: number, y: number, text: string, color = C.line, anchor = "start") =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="8" letter-spacing=".4" text-anchor="${anchor}">${text}</text>`;
/** One line of explanation under a panel. */
const caption = (x: number, text: string) =>
  `<text x="${x}" y="104" fill="${C.text}" font-size="9" text-anchor="middle">${text}</text>`;
const divider = (x: number) => `<line x1="${x}" y1="14" x2="${x}" y2="94" stroke="${C.frame}"/>`;
/** A line of placeholder text. */
const bar = (x: number, y: number, w: number, color = C.text) => `<rect x="${x}" y="${y}" width="${w}" height="4" rx="2" fill="${color}"/>`;
/** A keyboard key with a bit of depth under it. */
const key = (x: number, y: number, w: number, text = "", hi = false) =>
  `<rect x="${x}" y="${y + 3}" width="${w}" height="22" rx="4" fill="${C.keyShadow}"/>` +
  `<rect x="${x}" y="${y}" width="${w}" height="22" rx="4" fill="${C.fillBox}" stroke="${hi ? C.hi : C.line}"/>` +
  (text ? `<text x="${x + w / 2}" y="${y + 15}" fill="${hi ? C.hi : C.text}" font-size="10" text-anchor="middle">${text}</text>` : "");
/** Mouse pointer with its tip at (x, y). */
const cursor = (x: number, y: number) =>
  `<path d="M${x} ${y} l6 7 -3 .3 2 4 -1.6 .8 -2 -4 -2.2 2z" fill="${C.text}" stroke="${C.fillBox}" stroke-width=".8"/>`;
/** Horizontal arrow from x1 to x2; the head sits at x2. */
const arrow = (x1: number, y: number, x2: number, color = C.line) => {
  const d = x2 > x1 ? 1 : -1;
  return `<path d="M${x1} ${y} H${x2} M${x2 - 6 * d} ${y - 5} l${6 * d} 5 -${6 * d} 5" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
};
/** One of the editor's 24px icons, drawn at (x, y) and `size` px. */
const icon = (name: string, x: number, y: number, size: number, color: string) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;
/** Three bold color bands, the stand-in for a busy album cover. */
const stripes = (x: number, y: number, w: number, h: number, colors: string[]) =>
  colors.map((c, i) => `<rect x="${x + (w / colors.length) * i}" y="${y}" width="${w / colors.length + 1}" height="${h}" fill="${c}"/>`).join("");

const svg = (body: string) => `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const TIP_DIAGRAMS: Record<string, string> = {
  // Free x/y position measured from the widget's top-left corner.
  position: svg(`
    <rect x="14" y="14" width="192" height="78" rx="5" fill="none" stroke="${C.frame}" stroke-dasharray="4 3"/>
    <circle cx="14" cy="14" r="2.5" fill="${C.hi}"/>
    ${label(20, 25, "0,0", C.hi)}
    <rect x="96" y="46" width="76" height="34" rx="4" fill="${C.fillBox}" stroke="${C.line}"/>
    ${bar(104, 56, 48)}${bar(104, 66, 32, C.line)}
    <path d="M14 63 H95 M89 58 l6 5 -6 5" fill="none" stroke="${C.hi}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="55" y="58" fill="${C.hi}" font-size="10" text-anchor="middle">x</text>
    <path d="M134 14 V45 M129 39 l5 6 5 -6" fill="none" stroke="${C.hi}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="141" y="33" fill="${C.hi}" font-size="10">y</text>
    ${caption(110, "from the widget's top-left")}
  `),

  // Horizontal text alignment within the element's box.
  anchor: svg(`
    <rect x="12" y="20" width="60" height="54" rx="4" fill="none" stroke="${C.frame}"/>
    <line x1="18" y1="26" x2="18" y2="68" stroke="${C.hi}" stroke-dasharray="2 2"/>
    ${bar(18, 33, 44)}${bar(18, 45, 28, C.line)}${bar(18, 57, 36, C.line)}
    <rect x="80" y="20" width="60" height="54" rx="4" fill="none" stroke="${C.frame}"/>
    <line x1="110" y1="26" x2="110" y2="68" stroke="${C.hi}" stroke-dasharray="2 2"/>
    ${bar(88, 33, 44)}${bar(96, 45, 28, C.line)}${bar(92, 57, 36, C.line)}
    <rect x="148" y="20" width="60" height="54" rx="4" fill="none" stroke="${C.frame}"/>
    <line x1="202" y1="26" x2="202" y2="68" stroke="${C.hi}" stroke-dasharray="2 2"/>
    ${bar(158, 33, 44)}${bar(174, 45, 28, C.line)}${bar(166, 57, 36, C.line)}
    ${caption(42, "left")}${caption(110, "center")}${caption(178, "right")}
  `),

  // Snapping: hold Shift while dragging and one edge locks to another's.
  snap: svg(`
    <rect x="16" y="26" width="44" height="44" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    ${icon("image", 26, 36, 24, C.line)}
    <line x1="60" y1="26" x2="60" y2="70" stroke="${C.hi}" stroke-width="1.5"/>
    <line x1="60" y1="48" x2="82" y2="48" stroke="${C.hi}" stroke-width="1.5" stroke-dasharray="3 3"/>
    ${label(71, 42, "gap", C.hi, "middle")}
    <rect x="82" y="34" width="62" height="28" rx="4" fill="${C.fillBox}" stroke="${C.hi}"/>
    ${bar(89, 42, 40)}${bar(89, 51, 26, C.line)}
    ${caption(80, "edges stay attached")}
    ${divider(156)}
    ${key(166, 30, 40, "Shift", true)}
    ${cursor(186, 64)}
    ${caption(186, "hold")}
  `),

  // Stacking order: what's on top of what, and the list that sets it.
  z: svg(`
    <rect x="18" y="22" width="58" height="40" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    ${label(24, 34, "BACK")}
    <rect x="42" y="42" width="58" height="40" rx="5" fill="${C.frame}" stroke="${C.hi}"/>
    ${label(48, 75, "FRONT", C.hi)}
    ${caption(57, "on the widget")}
    ${divider(112)}
    <rect x="124" y="22" width="78" height="16" rx="3" fill="${C.fillBox}" stroke="${C.hi}"/>
    ${label(131, 33, "TITLE", C.hi)}
    <rect x="124" y="44" width="78" height="16" rx="3" fill="none" stroke="${C.frame}"/>
    ${label(131, 55, "ALBUM ART")}
    <rect x="124" y="66" width="78" height="16" rx="3" fill="none" stroke="${C.frame}"/>
    ${label(131, 77, "BACKGROUND")}
    ${caption(163, "top row = front")}
  `),

  // Reordering the element list: drag a row, or Alt + an arrow key.
  "layer-reorder": svg(`
    ${label(14, 13, "FRONT")}
    <rect x="14" y="18" width="80" height="18" rx="3" fill="none" stroke="${C.frame}"/>
    <rect x="14" y="62" width="80" height="18" rx="3" fill="none" stroke="${C.frame}"/>
    ${label(14, 92, "BACK")}
    <line x1="14" y1="40" x2="94" y2="40" stroke="${C.hi}" stroke-width="1.5"/>
    <rect x="22" y="44" width="80" height="18" rx="3" fill="${C.fillBox}" stroke="${C.hi}"/>
    <g fill="${C.hi}"><circle cx="30" cy="49" r="1.2"/><circle cx="34" cy="49" r="1.2"/><circle cx="30" cy="53" r="1.2"/><circle cx="34" cy="53" r="1.2"/><circle cx="30" cy="57" r="1.2"/><circle cx="34" cy="57" r="1.2"/></g>
    ${bar(40, 51, 40, C.line)}
    ${cursor(86, 52)}
    ${caption(58, "drag")}
    ${divider(114)}
    ${key(124, 20, 34, "Alt")}
    <text x="167" y="35" fill="${C.line}" font-size="11" text-anchor="middle">+</text>
    ${key(176, 20, 24, "", true)}
    <path d="M188 37 v-12 M183 29.5 l5 -5 5 5" fill="none" stroke="${C.hi}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${key(124, 58, 34, "Alt")}
    <text x="167" y="73" fill="${C.line}" font-size="11" text-anchor="middle">+</text>
    ${key(176, 58, 24, "", true)}
    <path d="M188 63 v12 M183 70.5 l5 5 5 -5" fill="none" stroke="${C.hi}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${caption(162, "or keys")}
  `),

  // Hit + to copy an element; the copy gets its own settings.
  duplicate: svg(`
    <rect x="18" y="32" width="62" height="36" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    ${bar(26, 43, 40)}${bar(26, 53, 26, C.line)}
    ${caption(49, "one element")}
    ${key(96, 38, 26, "+", true)}
    <rect x="134" y="26" width="62" height="36" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    <rect x="146" y="40" width="62" height="36" rx="5" fill="${C.fillBox}" stroke="${C.hi}"/>
    ${bar(154, 51, 40, C.hi)}${bar(154, 61, 26, C.line)}
    ${caption(171, "its own copy")}
  `),

  // Drop-shadow offset (X/Y) away from the element.
  "shadow-offset": svg(`
    <rect x="88" y="42" width="76" height="40" rx="5" fill="${C.shadow}"/>
    <rect x="70" y="28" width="76" height="40" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    ${bar(78, 40, 50)}${bar(78, 50, 34, C.line)}
    <path d="M146 28 V18 M164 42 V18" stroke="${C.frame}" stroke-dasharray="2 2"/>
    <path d="M146 28 H180 M164 42 H180" stroke="${C.frame}" stroke-dasharray="2 2"/>
    <path d="M146 20 H163 M159 17 l4 3 -4 3" fill="none" stroke="${C.hi}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="155" y="14" fill="${C.hi}" font-size="9" text-anchor="middle">X</text>
    <path d="M176 28 V41 M173 37 l3 4 3 -4" fill="none" stroke="${C.hi}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="184" y="38" fill="${C.hi}" font-size="9">Y</text>
    ${caption(110, "the shadow shifts, the element stays")}
  `),

  // How soft the shadow's edge is.
  "shadow-blur": svg(`
    <defs><filter id="sb-blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs>
    ${label(14, 17, "BLUR 0")}
    <rect x="34" y="40" width="56" height="32" rx="5" fill="${C.shadow}"/>
    <rect x="26" y="32" width="56" height="32" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    ${bar(33, 43, 36)}
    ${caption(57, "hard edge")}
    ${divider(110)}
    ${label(120, 17, "BLUR 20", C.hi)}
    <rect x="142" y="40" width="56" height="32" rx="5" fill="${C.shadow}" filter="url(#sb-blur)"/>
    <rect x="134" y="32" width="56" height="32" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    ${bar(141, 43, 36)}
    ${caption(163, "soft")}
  `),

  // Auto contrast: the shadow takes the opposite of the element's color.
  "shadow-contrast": svg(`
    ${label(14, 17, "LIGHT TEXT")}
    <rect x="14" y="24" width="90" height="56" rx="6" fill="${C.frame}"/>
    <text x="61" y="64" fill="#09090b" font-size="26" font-weight="bold" text-anchor="middle">Aa</text>
    <text x="59" y="62" fill="#fafafa" font-size="26" font-weight="bold" text-anchor="middle">Aa</text>
    ${divider(110)}
    ${label(120, 17, "DARK TEXT")}
    <rect x="118" y="24" width="90" height="56" rx="6" fill="${C.frame}"/>
    <text x="165" y="64" fill="#f4f4f5" font-size="26" font-weight="bold" text-anchor="middle">Aa</text>
    <text x="163" y="62" fill="#18181b" font-size="26" font-weight="bold" text-anchor="middle">Aa</text>
    ${caption(110, "the shadow takes the opposite color")}
  `),

  // Shadow allowed to spill past the element's box while the text stays put.
  "shadow-escape": svg(`
    <defs><clipPath id="se-clip"><rect x="20" y="32" width="74" height="40" rx="6"/></clipPath></defs>
    ${label(20, 24, "OFF")}
    <ellipse cx="57" cy="54" rx="46" ry="20" fill="${C.hi}" opacity="0.22" clip-path="url(#se-clip)"/>
    <rect x="20" y="32" width="74" height="40" rx="6" fill="none" stroke="${C.frame}" stroke-dasharray="4 3"/>
    <text x="34" y="58" fill="${C.text}" font-size="14" font-weight="bold">Title</text>
    ${caption(57, "cut off at the box")}
    ${divider(110)}
    ${label(126, 24, "ON", C.hi)}
    <ellipse cx="163" cy="54" rx="50" ry="24" fill="${C.hi}" opacity="0.22"/>
    <rect x="126" y="32" width="74" height="40" rx="6" fill="none" stroke="${C.frame}" stroke-dasharray="4 3"/>
    <text x="140" y="58" fill="${C.text}" font-size="14" font-weight="bold">Title</text>
    ${caption(163, "spills past it")}
  `),

  // Long text clipped to its box, sliding along.
  scroll: svg(`
    <defs><clipPath id="sc-clip"><rect x="40" y="38" width="120" height="30" rx="4"/></clipPath></defs>
    <text x="48" y="58" fill="${C.text}" opacity="0.25" font-size="12">Really long song title</text>
    <text x="48" y="58" fill="${C.text}" font-size="12" clip-path="url(#sc-clip)">Really long song title</text>
    <rect x="40" y="38" width="120" height="30" rx="4" fill="none" stroke="${C.line}"/>
    ${arrow(150, 26, 60, C.hi)}
    ${caption(110, "slides when it doesn't fit")}
  `),

  // Which way the scrolling text moves.
  "scroll-direction": svg(`
    <rect x="14" y="14" width="96" height="20" rx="3" fill="none" stroke="${C.frame}"/>${bar(22, 22, 64)}
    ${arrow(160, 24, 124, C.hi)}
    <text x="172" y="27" fill="${C.text}" font-size="9">left</text>
    <rect x="14" y="42" width="96" height="20" rx="3" fill="none" stroke="${C.frame}"/>${bar(22, 50, 64)}
    ${arrow(124, 52, 160, C.hi)}
    <text x="172" y="55" fill="${C.text}" font-size="9">right</text>
    <rect x="14" y="70" width="96" height="20" rx="3" fill="none" stroke="${C.frame}"/>${bar(22, 78, 64)}
    <path d="M124 80 H160 M130 75 l-6 5 6 5 M154 75 l6 5 -6 5" fill="none" stroke="${C.hi}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="172" y="83" fill="${C.text}" font-size="9">bounce</text>
    ${caption(110, "loop, or slide back and forth")}
  `),

  // The space between the end of the text and where it starts again.
  "scroll-gap": svg(`
    <defs><clipPath id="sg-clip"><rect x="14" y="38" width="192" height="30" rx="4"/></clipPath></defs>
    <g clip-path="url(#sg-clip)" fill="${C.text}" font-size="12">
      <text x="26" y="58">song title</text>
      <text x="140" y="58">song title</text>
    </g>
    <rect x="14" y="38" width="192" height="30" rx="4" fill="none" stroke="${C.line}"/>
    <path d="M100 30 V66 M138 30 V66" stroke="${C.frame}" stroke-dasharray="2 2"/>
    <path d="M100 30 H138" stroke="${C.hi}" stroke-width="1.5"/>
    ${label(119, 25, "GAP", C.hi, "middle")}
    ${caption(110, "space before the text repeats")}
  `),

  // Auto width hugs the text; a fixed width clips it.
  "auto-width": svg(`
    <defs><clipPath id="aw-clip"><rect x="124" y="40" width="62" height="24" rx="4"/></clipPath></defs>
    ${label(14, 17, "AUTO", C.hi)}
    <text x="22" y="56" fill="${C.text}" font-size="11">Song title</text>
    <rect x="16" y="40" width="78" height="24" rx="4" fill="none" stroke="${C.hi}"/>
    ${caption(57, "fits the text")}
    ${divider(110)}
    ${label(120, 17, "FIXED")}
    <text x="130" y="56" fill="${C.text}" opacity="0.25" font-size="11">Song title</text>
    <text x="130" y="56" fill="${C.text}" font-size="11" clip-path="url(#aw-clip)">Song title</text>
    <rect x="124" y="40" width="62" height="24" rx="4" fill="none" stroke="${C.line}"/>
    ${caption(163, "cuts off, or scrolls")}
  `),

  // The widget frame's own width and height.
  "widget-size": svg(`
    <rect x="40" y="26" width="140" height="62" rx="6" fill="${C.fillBox}" stroke="${C.hi}"/>
    <rect x="50" y="36" width="28" height="28" rx="3" fill="${C.frame}"/>
    ${bar(86, 42, 60)}${bar(86, 52, 40, C.line)}
    <rect x="50" y="74" width="120" height="4" rx="2" fill="${C.frame}"/>
    <path d="M40 14 V22 M180 14 V22 M40 18 H100 M120 18 H180" stroke="${C.hi}" stroke-width="1.5"/>
    <text x="110" y="21" fill="${C.hi}" font-size="9" text-anchor="middle">W</text>
    <path d="M188 26 H196 M188 88 H196 M192 26 V49 M192 65 V88" stroke="${C.hi}" stroke-width="1.5"/>
    <text x="192" y="60" fill="${C.hi}" font-size="9" text-anchor="middle">H</text>
    ${caption(110, "everything else sits inside it")}
  `),

  // Which side the outline sits on relative to the element's edge.
  "stroke-align": svg(`
    <rect x="18" y="30" width="44" height="30" rx="2" fill="${C.frame}"/>
    <rect x="15" y="27" width="50" height="36" rx="3" fill="none" stroke="${C.hi}" stroke-width="6" opacity="0.8"/>
    <rect x="18" y="30" width="44" height="30" rx="2" fill="none" stroke="${C.text}" stroke-width=".8" stroke-dasharray="2 2"/>
    <rect x="88" y="30" width="44" height="30" rx="2" fill="${C.frame}"/>
    <rect x="88" y="30" width="44" height="30" rx="2" fill="none" stroke="${C.hi}" stroke-width="6" opacity="0.8"/>
    <rect x="88" y="30" width="44" height="30" rx="2" fill="none" stroke="${C.text}" stroke-width=".8" stroke-dasharray="2 2"/>
    <rect x="158" y="30" width="44" height="30" rx="2" fill="${C.frame}"/>
    <rect x="161" y="33" width="38" height="24" rx="1" fill="none" stroke="${C.hi}" stroke-width="6" opacity="0.8"/>
    <rect x="158" y="30" width="44" height="30" rx="2" fill="none" stroke="${C.text}" stroke-width=".8" stroke-dasharray="2 2"/>
    ${label(40, 82, "OUTSIDE", C.text, "middle")}${label(110, 82, "CENTER", C.text, "middle")}${label(180, 82, "INSIDE", C.text, "middle")}
    ${caption(110, "dashed line = the element's edge")}
  `),

  // An outline keeps text readable on a busy background.
  outline: svg(`
    <defs>
      <clipPath id="ol-l"><rect x="14" y="24" width="90" height="56" rx="6"/></clipPath>
      <clipPath id="ol-r"><rect x="120" y="24" width="86" height="56" rx="6"/></clipPath>
    </defs>
    ${label(14, 17, "NO OUTLINE")}
    <g clip-path="url(#ol-l)">${stripes(14, 24, 90, 56, ["#e5e7eb", "#a3e635", "#f8fafc", "#38bdf8"])}</g>
    <text x="59" y="58" fill="#fafafa" font-size="18" font-weight="bold" text-anchor="middle">Title</text>
    ${caption(59, "hard to read")}
    ${divider(112)}
    ${label(120, 17, "OUTLINE", C.hi)}
    <g clip-path="url(#ol-r)">${stripes(120, 24, 86, 56, ["#e5e7eb", "#a3e635", "#f8fafc", "#38bdf8"])}</g>
    <text x="163" y="58" fill="#fafafa" stroke="#09090b" stroke-width="4" stroke-linejoin="round" paint-order="stroke" font-size="18" font-weight="bold" text-anchor="middle">Title</text>
    ${caption(163, "stands out")}
  `),

  // Corner radius from square to circle.
  radius: svg(`
    <rect x="18" y="24" width="44" height="44" rx="0" fill="${C.frame}" stroke="${C.line}"/>
    <rect x="88" y="24" width="44" height="44" rx="11" fill="${C.frame}" stroke="${C.line}"/>
    <rect x="158" y="24" width="44" height="44" rx="22" fill="${C.frame}" stroke="${C.hi}"/>
    ${label(40, 84, "0", C.text, "middle")}${label(110, 84, "SOME", C.text, "middle")}${label(180, 84, "MAX", C.hi, "middle")}
    ${caption(110, "max turns a square into a circle")}
  `),

  // What the box can be filled with.
  "fill-modes": svg(`
    <defs>
      <pattern id="fm-chk" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${C.fillBox}"/><rect width="4" height="4" fill="${C.frame}"/><rect x="4" y="4" width="4" height="4" fill="${C.frame}"/></pattern>
      <filter id="fm-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
      <clipPath id="fm-clip"><rect x="165" y="26" width="40" height="40" rx="6"/></clipPath>
    </defs>
    <rect x="15" y="26" width="40" height="40" rx="6" fill="url(#fm-chk)" stroke="${C.frame}"/>
    <rect x="65" y="26" width="40" height="40" rx="6" fill="#6366f1"/>
    <rect x="115" y="26" width="40" height="40" rx="6" fill="${C.accent}" stroke="${C.hi}"/>
    <text x="135" y="50" fill="#fafafa" font-size="9" text-anchor="middle">auto</text>
    <g clip-path="url(#fm-clip)"><g filter="url(#fm-blur)">${stripes(160, 20, 50, 52, ["#ef4444", C.accent, "#eab308"])}</g></g>
    ${label(35, 82, "NONE", C.text, "middle")}${label(85, 82, "COLOR", C.text, "middle")}${label(135, 82, "ACCENT", C.text, "middle")}${label(185, 82, "ALBUM ART", C.text, "middle")}
    ${caption(110, "what fills the box")}
  `),

  // Background filled with a blurred cover, and what its Opacity really does.
  "fill-art": svg(`
    <defs>
      <filter id="fa-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
      <pattern id="fa-chk" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${C.fillBox}"/><rect width="4" height="4" fill="${C.frame}"/><rect x="4" y="4" width="4" height="4" fill="${C.frame}"/></pattern>
      <clipPath id="fa-l"><rect x="14" y="24" width="90" height="58" rx="6"/></clipPath>
      <clipPath id="fa-r"><rect x="120" y="24" width="86" height="58" rx="6"/></clipPath>
    </defs>
    ${label(14, 17, "100%")}
    <g clip-path="url(#fa-l)"><g filter="url(#fa-blur)">${stripes(6, 16, 106, 74, ["#ef4444", C.accent, "#eab308"])}</g></g>
    <rect x="14" y="24" width="90" height="58" rx="6" fill="none" stroke="${C.frame}"/>
    ${caption(59, "full cover")}
    ${divider(112)}
    ${label(120, 17, "40%", C.hi)}
    <rect x="120" y="24" width="86" height="58" rx="6" fill="url(#fa-chk)"/>
    <g clip-path="url(#fa-r)" opacity="0.4"><g filter="url(#fa-blur)">${stripes(112, 16, 102, 74, ["#ef4444", C.accent, "#eab308"])}</g></g>
    <rect x="120" y="24" width="86" height="58" rx="6" fill="none" stroke="${C.frame}"/>
    ${caption(163, "see-through")}
  `),

  // Tint: a dark layer over a bright cover so the text on top reads.
  tint: svg(`
    <defs>
      <filter id="tn-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
      <clipPath id="tn-l"><rect x="14" y="24" width="90" height="58" rx="6"/></clipPath>
      <clipPath id="tn-r"><rect x="120" y="24" width="86" height="58" rx="6"/></clipPath>
    </defs>
    ${label(14, 17, "NO TINT")}
    <g clip-path="url(#tn-l)"><g filter="url(#tn-blur)">${stripes(6, 16, 106, 74, ["#fde047", "#f9a8d4", "#e0f2fe"])}</g></g>
    <text x="59" y="58" fill="#fafafa" font-size="15" font-weight="bold" text-anchor="middle">Title</text>
    ${caption(59, "text gets lost")}
    ${divider(112)}
    ${label(120, 17, "TINT 50%", C.hi)}
    <g clip-path="url(#tn-r)"><g filter="url(#tn-blur)">${stripes(112, 16, 102, 74, ["#fde047", "#f9a8d4", "#e0f2fe"])}</g><rect x="120" y="24" width="86" height="58" fill="#000" opacity="0.5"/></g>
    <text x="163" y="58" fill="#fafafa" font-size="15" font-weight="bold" text-anchor="middle">Title</text>
    ${caption(163, "text reads")}
  `),

  // The global accent: one color every 'auto' element follows.
  accent: svg(`
    ${label(40, 22, "ACCENT", C.text, "middle")}
    <circle cx="40" cy="50" r="16" fill="${C.accent}" stroke="${C.hi}" stroke-width="1.5"/>
    <path d="M58 50 C 76 50, 80 28, 100 28 M58 50 H100 M58 50 C 76 50, 80 74, 100 74" fill="none" stroke="${C.frame}" stroke-width="1.5"/>
    ${bar(108, 26, 56, C.accent)}
    <rect x="108" y="48" width="80" height="4" rx="2" fill="${C.frame}"/><rect x="108" y="48" width="48" height="4" rx="2" fill="${C.accent}"/>
    <rect x="108" y="66" width="44" height="16" rx="3" fill="${C.accent}" opacity="0.6"/>
    ${label(206, 30, "AUTO", C.hi, "end")}${label(206, 53, "AUTO", C.hi, "end")}${label(206, 77, "AUTO", C.hi, "end")}
    ${caption(110, "anything set to auto follows it")}
  `),

  // Accent pulled from the album art, updating each song.
  "auto-color": svg(`
    <defs><clipPath id="ac-clip"><rect x="16" y="28" width="48" height="48" rx="5"/></clipPath></defs>
    <g clip-path="url(#ac-clip)">
      <rect x="16" y="28" width="48" height="48" fill="#2563eb"/>
      <circle cx="30" cy="42" r="6" fill="#bfdbfe"/>
      <path d="M16 70 l16 -14 12 10 8 -6 12 10 v6 H16z" fill="#1e3a8a"/>
    </g>
    ${arrow(70, 52, 88)}
    <circle cx="102" cy="52" r="11" fill="${C.accent}" stroke="${C.hi}" stroke-width="1.5"/>
    ${arrow(118, 52, 136)}
    <rect x="142" y="30" width="66" height="44" rx="5" fill="${C.fillBox}" stroke="${C.frame}"/>
    ${bar(150, 40, 40, C.accent)}${bar(150, 49, 28, C.line)}
    <rect x="150" y="62" width="50" height="4" rx="2" fill="${C.frame}"/><rect x="150" y="62" width="30" height="4" rx="2" fill="${C.accent}"/>
    ${caption(40, "cover")}${caption(102, "accent")}${caption(175, "auto parts")}
  `),

  // Three covers of very different brightness landing on one accent brightness.
  "accent-brightness": svg(`
    ${label(14, 11, "COVERS")}${label(88, 11, "ACCENT")}
    <rect x="14" y="16" width="30" height="22" rx="4" fill="#3d1020"/>
    <rect x="14" y="42" width="30" height="22" rx="4" fill="#a8264c"/>
    <rect x="14" y="68" width="30" height="22" rx="4" fill="#f4a8c0"/>
    ${arrow(52, 27, 76)}${arrow(52, 53, 76)}${arrow(52, 79, 76)}
    <rect x="88" y="23" width="118" height="8" rx="4" fill="#d63a68"/>
    <rect x="88" y="49" width="118" height="8" rx="4" fill="#d63a68"/>
    <rect x="88" y="75" width="118" height="8" rx="4" fill="#d63a68"/>
    ${caption(110, "same brightness on every cover")}
  `),

  // Fallback accent used when the album art can't be fetched / read.
  fallback: svg(`
    <rect x="20" y="30" width="50" height="50" rx="6" fill="${C.fillBox}" stroke="${C.line}"/>
    <path d="M33 43 l24 24 M57 43 l-24 24" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
    ${arrow(80, 55, 100)}
    <rect x="110" y="30" width="96" height="50" rx="5" fill="${C.fillBox}" stroke="${C.frame}"/>
    ${bar(118, 42, 52, C.hi)}${bar(118, 52, 34, C.line)}
    <rect x="118" y="66" width="80" height="4" rx="2" fill="${C.frame}"/><rect x="118" y="66" width="48" height="4" rx="2" fill="${C.hi}"/>
    ${caption(45, "art won't load")}${caption(158, "fallback color instead")}
  `),

  // Your own image standing in for a missing cover.
  "fallback-art": svg(`
    ${label(30, 20, "NO COVER")}
    <rect x="30" y="26" width="52" height="52" rx="6" fill="none" stroke="${C.line}" stroke-dasharray="3 3"/>
    ${icon("music", 44, 40, 24, C.frame)}
    ${arrow(94, 52, 122, C.hi)}
    ${label(136, 20, "YOUR IMAGE", C.hi)}
    <rect x="136" y="26" width="52" height="52" rx="6" fill="${C.fillBox}" stroke="${C.hi}"/>
    ${icon("image", 150, 40, 24, C.hi)}
    ${caption(56, "song has no art")}${caption(162, "shows yours")}
  `),

  // The default font, with one element overriding it.
  "global-font": svg(`
    ${label(46, 22, "GLOBAL", C.text, "middle")}
    <text x="46" y="62" fill="${C.text}" font-family="sans-serif" font-size="30" text-anchor="middle">Aa</text>
    ${caption(46, "the default")}
    ${divider(92)}
    <text x="104" y="32" fill="${C.line}" font-family="sans-serif" font-size="13">Title</text>
    <text x="104" y="54" fill="${C.line}" font-family="sans-serif" font-size="13">Artist</text>
    <text x="104" y="78" fill="${C.hi}" font-family="serif" font-style="italic" font-size="14">Album</text>
    ${label(206, 77, "OWN FONT", C.hi, "end")}
    ${caption(155, "texts can override")}
  `),

  // Paused: keep the widget up with a pause symbol, or hide it entirely.
  "paused-mode": svg(`
    ${label(14, 17, "SHOW PAUSED")}
    <rect x="14" y="24" width="90" height="56" rx="6" fill="${C.fillBox}" stroke="${C.frame}"/>
    <rect x="22" y="32" width="22" height="22" rx="3" fill="${C.frame}"/>
    ${bar(50, 36, 30)}${bar(50, 45, 22, C.line)}
    <rect x="86" y="32" width="4" height="13" rx="1" fill="${C.hi}"/><rect x="93" y="32" width="4" height="13" rx="1" fill="${C.hi}"/>
    <rect x="22" y="66" width="74" height="4" rx="2" fill="${C.frame}"/>
    ${caption(59, "pause symbol shows")}
    ${divider(112)}
    ${label(120, 17, "HIDE WIDGET")}
    <rect x="120" y="24" width="86" height="56" rx="6" fill="none" stroke="${C.frame}" stroke-dasharray="4 3"/>
    ${icon("eyeOff", 152, 41, 22, C.line)}
    ${caption(163, "widget disappears")}
  `),

  // Editor-only gray outlines of nearby elements while you resize one.
  ghosts: svg(`
    <rect x="18" y="24" width="44" height="44" rx="4" fill="none" stroke="${C.line}" stroke-dasharray="3 3"/>
    <rect x="72" y="22" width="78" height="12" rx="2" fill="none" stroke="${C.line}" stroke-dasharray="3 3"/>
    <rect x="18" y="80" width="150" height="6" rx="3" fill="none" stroke="${C.line}" stroke-dasharray="3 3"/>
    <rect x="72" y="44" width="96" height="24" rx="3" fill="${C.fillBox}" stroke="${C.hi}"/>
    ${bar(80, 54, 56)}
    <rect x="165" y="65" width="6" height="6" fill="${C.hi}"/>
    ${cursor(171, 71)}
    ${caption(110, "dashed = elements near the one you resize")}
  `),

  // The moments an element can animate on.
  "anim-triggers": svg(`
    ${key(18, 24, 34, "", true)}${icon("power", 25, 25, 20, C.hi)}
    ${key(68, 24, 34, "", true)}${icon("music", 75, 25, 20, C.hi)}
    ${key(118, 24, 34, "", true)}${icon("play", 125, 25, 20, C.hi)}
    ${key(168, 24, 34, "", true)}${icon("pause", 175, 25, 20, C.hi)}
    ${label(35, 68, "LOAD", C.text, "middle")}${label(85, 68, "NEW SONG", C.text, "middle")}${label(135, 68, "PLAYING", C.text, "middle")}${label(185, 68, "PAUSED", C.text, "middle")}
    ${caption(110, "pick an effect for any of these")}
  `),

  // A custom effect: your own motion curve, reusable on any element.
  "custom-anim": svg(`
    ${label(34, 16, "MOTION")}
    <path d="M30 86 H192 M30 86 V18" stroke="${C.frame}"/>
    <path d="M30 86 H88 M190 22 H124" stroke="${C.line}" stroke-dasharray="2 2"/>
    <circle cx="88" cy="86" r="2.5" fill="${C.line}"/><circle cx="124" cy="22" r="2.5" fill="${C.line}"/>
    <path d="M30 86 C 88 86, 124 22, 190 22" fill="none" stroke="${C.hi}" stroke-width="2"/>
    <circle cx="30" cy="86" r="3.5" fill="${C.hi}"/><circle cx="190" cy="22" r="3.5" fill="${C.hi}"/>
    ${label(192, 96, "TIME", C.line, "end")}
    ${caption(110, "build it once, use it anywhere")}
  `),
};
