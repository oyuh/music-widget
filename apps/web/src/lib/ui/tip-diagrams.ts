// Small inline-SVG diagrams shown inside InfoTip hover tooltips for the settings
// that are hard to grok from a label alone. Rendered via {@html}, so the markup
// is authored here (trusted, static); no user input is ever interpolated.
//
// Style: dark tooltip card, so strokes are light zinc and the highlighted bit is
// the editor green. viewBox is a consistent 220x110. Any filter/clip ids are
// prefixed per-key so two diagrams can never collide.

const C = {
  frame: "#3f3f46", // zinc-700  (faint frame / widget edge)
  line: "#a1a1aa", // zinc-400  (neutral box stroke)
  fillBox: "#27272a", // zinc-800  (box fill)
  text: "#d4d4d8", // zinc-300  (sample text)
  hi: "#4ade80", // green-400  (the thing the setting controls)
};

export const TIP_DIAGRAMS: Record<string, string> = {
  // Free x/y position measured from the widget's top-left corner.
  position: `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="200" height="90" rx="5" fill="none" stroke="${C.frame}" stroke-dasharray="4 3"/>
    <rect x="78" y="48" width="64" height="36" rx="4" fill="${C.fillBox}" stroke="${C.line}"/>
    <line x1="10" y1="30" x2="78" y2="30" stroke="${C.hi}" stroke-width="1.5"/>
    <path d="M72 26 l6 4 -6 4" fill="none" stroke="${C.hi}" stroke-width="1.5"/>
    <text x="40" y="25" fill="${C.hi}" font-size="10" text-anchor="middle">x</text>
    <line x1="40" y1="10" x2="40" y2="48" stroke="${C.hi}" stroke-width="1.5"/>
    <path d="M36 42 l4 6 4 -6" fill="none" stroke="${C.hi}" stroke-width="1.5"/>
    <text x="50" y="36" fill="${C.hi}" font-size="10">y</text>
  </svg>`,

  // Horizontal text alignment within the element's box.
  anchor: `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="8" width="196" height="26" rx="3" fill="none" stroke="${C.frame}"/>
    <text x="18" y="25" fill="${C.text}" font-size="12">Left</text>
    <rect x="12" y="42" width="196" height="26" rx="3" fill="none" stroke="${C.frame}"/>
    <text x="110" y="59" fill="${C.text}" font-size="12" text-anchor="middle">Center</text>
    <rect x="12" y="76" width="196" height="26" rx="3" fill="none" stroke="${C.frame}"/>
    <text x="202" y="93" fill="${C.text}" font-size="12" text-anchor="end">Right</text>
  </svg>`,

  // Snapping: one element's edge anchored to another's, holding a fixed gap.
  snap: `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="34" width="68" height="42" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    <text x="50" y="60" fill="${C.text}" font-size="10" text-anchor="middle">art</text>
    <rect x="118" y="34" width="86" height="42" rx="5" fill="${C.fillBox}" stroke="${C.hi}"/>
    <text x="161" y="60" fill="${C.hi}" font-size="10" text-anchor="middle">text</text>
    <line x1="84" y1="55" x2="118" y2="55" stroke="${C.hi}" stroke-width="1.5" stroke-dasharray="3 3"/>
    <text x="101" y="48" fill="${C.hi}" font-size="9" text-anchor="middle">gap</text>
  </svg>`,

  // Stacking order: higher layer sits in front.
  z: `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="40" y="24" width="96" height="58" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    <text x="58" y="44" fill="${C.line}" font-size="10">back</text>
    <rect x="92" y="44" width="96" height="58" rx="5" fill="#3f3f46" stroke="${C.hi}"/>
    <text x="112" y="84" fill="${C.hi}" font-size="10">front</text>
  </svg>`,

  // Drop-shadow offset (X/Y) away from the element.
  "shadow-offset": `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="78" y="40" width="84" height="46" rx="5" fill="#52525b"/>
    <rect x="66" y="28" width="84" height="46" rx="5" fill="${C.fillBox}" stroke="${C.line}"/>
    <line x1="150" y1="51" x2="162" y2="63" stroke="${C.hi}" stroke-width="1.5"/>
    <text x="170" y="58" fill="${C.hi}" font-size="10">X</text>
    <text x="170" y="72" fill="${C.hi}" font-size="10">Y</text>
  </svg>`,

  // Shadow allowed to spill past the widget frame while text stays put.
  "shadow-escape": `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="22" width="176" height="66" rx="8" fill="none" stroke="${C.frame}" stroke-dasharray="4 3"/>
    <ellipse cx="118" cy="56" rx="92" ry="26" fill="${C.hi}" opacity="0.22"/>
    <text x="60" y="62" fill="${C.text}" font-size="15" font-weight="bold">Title</text>
  </svg>`,

  // Long text clipped to its box, scrolling in a direction.
  scroll: `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="34" y="40" width="116" height="32" rx="4" fill="none" stroke="${C.line}"/>
    <text x="42" y="61" fill="${C.text}" font-size="12">Long song titl…</text>
    <path d="M158 56 h34 M186 50 l8 6 -8 6" fill="none" stroke="${C.hi}" stroke-width="1.6"/>
  </svg>`,

  // Background filled with a blurred copy of the album art.
  "fill-art": `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="fa-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>
    <clipPath id="fa-clip"><rect x="20" y="14" width="180" height="82" rx="8"/></clipPath>
    <g clip-path="url(#fa-clip)">
      <g filter="url(#fa-blur)">
        <rect x="14" y="8" width="70" height="94" fill="#ef4444"/>
        <rect x="84" y="8" width="60" height="94" fill="#3b82f6"/>
        <rect x="144" y="8" width="62" height="94" fill="#eab308"/>
      </g>
    </g>
    <rect x="20" y="14" width="180" height="82" rx="8" fill="none" stroke="${C.frame}"/>
    <rect x="66" y="42" width="88" height="26" rx="4" fill="${C.fillBox}" stroke="${C.line}"/>
  </svg>`,

  // Song-switch animation: the old card transitions to the new one.
  "switch-anim": `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="34" width="72" height="46" rx="6" fill="${C.fillBox}" stroke="${C.line}" opacity="0.4"/>
    <rect x="120" y="34" width="72" height="46" rx="6" fill="${C.fillBox}" stroke="${C.hi}"/>
    <path d="M98 57 h22 M112 51 l8 6 -8 6" fill="none" stroke="${C.hi}" stroke-width="1.6"/>
  </svg>`,

  // Accent derived automatically from the album art's dominant color.
  "auto-color": `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="26" y="30" width="58" height="58" rx="7" fill="#3b82f6"/>
    <path d="M96 59 h30 M118 53 l8 6 -8 6" fill="none" stroke="${C.line}" stroke-width="1.6"/>
    <rect x="138" y="38" width="56" height="42" rx="7" fill="#3b82f6" stroke="${C.hi}"/>
  </svg>`,

  // Fallback accent used when the album art can't be fetched / read.
  fallback: `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg">
    <rect x="26" y="30" width="58" height="58" rx="7" fill="${C.fillBox}" stroke="${C.line}"/>
    <path d="M40 44 l30 30 M70 44 l-30 30" stroke="#ef4444" stroke-width="2.5"/>
    <path d="M96 59 h30 M118 53 l8 6 -8 6" fill="none" stroke="${C.line}" stroke-width="1.6"/>
    <rect x="138" y="38" width="56" height="42" rx="7" fill="${C.hi}"/>
    <text x="166" y="99" fill="${C.line}" font-size="9" text-anchor="middle">fallback</text>
  </svg>`,
};
