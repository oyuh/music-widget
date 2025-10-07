---
title: "A Customizable Last.fm Now Playing Overlay (Private Profiles, Hash‑Encoded Themes, Stream‑Safe)"
description: "How I built a zero‑friction, deeply themeable Last.fm ‘Now Playing’ overlay for streaming—private profile support, hash‑encoded configs, adaptive polling, per‑element shadows, and how you can fork + bend it to your setup."
publishDate: "2025-09-27T22:05:00"
tags: ["project", "overlay", "nextjs", "lastfm", "streaming", "customization", "widgets"]
coverImage:
  src: "./cover-lastfm-widget.png"
  alt: "Now playing overlay with album art and styled text"
draft: false
---

# Overview

I wanted a “drop‑it‑in and forget it” music overlay that:
- Doesn’t require logging into a dashboard every boot
- Works with private Last.fm accounts
- Is styled entirely via a shareable URL
- Looks good over dark/light scenes
- Hides itself gracefully when paused
- Handles odd OBS / layering workflows (cropping, blending, filters)

Nothing I found hit all of those—and most SaaS overlays gate private scrobble access or hide themes behind paywalls. So I built a Next.js widget that encodes its full config in the URL hash (no server persistence) plus localStorage caching for edits.

Outcome: a self‑contained `/w#<base64>` overlay page you can paste into OBS as a browser source. Theme changes, positioning, text shadows, conditional visibility, and even a private session key ride inside that hash. No database. No cookies needed for viewers.

## Why I Built It

Initial “MVP”: a hard‑coded component hitting Last.fm’s recent track endpoint. Immediate pain:
- Private accounts returned nothing (needed session key)
- Couldn’t re‑use the same overlay across scenes with minor variants
- Manual CSS edits every time I wanted a subtle font or shadow tweak
- Paused music meant an ugly stale track lingering
- Color accents clashed with album art (needed controlled theming)

So: I introduced a structured `WidgetConfig`, a lossless encode/decode layer, per‑element shadow helpers, adaptive polling, and a session key pass‑through for private profiles.

Scope stayed intentionally small: just enough primitives to style everything without rewriting components.

## System Overview

Core building blocks:
1. `WidgetConfig` Type – authoritative shape for all theme + behavior
2. Base64 Hash Encoding – `/#w#<b64>` carries config (client only)
3. Local Editor (`/`) – interactive form that previews + regenerates share URL
4. Runtime Overlay (`/w`) – pure reader; decodes hash and renders
5. Private Profile Support – optional embedded Last.fm `sessionKey`
6. `useNowPlaying` Hook – adaptive polling + progress estimation
7. Per‑Element Text Shadow Utilities – fine‑grained shadow toggles
8. Image Proxy Route – avoids mixed content / CORS + future caching
9. “Hide When Paused” Logic – renders a zero‑footprint state
10. LocalStorage Persistence – QOL: reopen and continue styling

Nothing is persisted server‑side—share the URL and others see exactly your theme (except private scrobbles unless you intentionally include your session key).

## Data & Config Model

Example (shortened) `WidgetConfig` excerpt:
```ts
interface WidgetConfig {
  lfmUser: string;
  sessionKey?: string | null;      // Private profile access
  behavior: {
    hideIfPaused: boolean;
    showAlbumArt: boolean;
    compact: boolean;
  };
  theme: {
    accent: string;
    background: { mode: "solid" | "transparent"; color: string };
    text: {
      title: string | "accent";
      artist: string | "accent";
      album: string | "accent";
    };
    shadows: {
      title?: ShadowSpec | null;
      artist?: ShadowSpec | null;
      album?: ShadowSpec | null;
    };
    fonts: {
      family: string;
      weightTitle: number;
      weightMeta: number;
    };
  };
  layout: {
    direction: "horizontal" | "vertical";
    gap: number;
    coverSize: number;
  };
  advanced: {
    progressBar: boolean;
    progressBarHeight: number;
  };
}
```

Minimal, theme‑first, forward‑extendable. Hash includes only JSON → Base64 (no compression yet—small enough).

## Flow (Build → Share → Display)

1. Open `/` – editor loads defaults OR localStorage copy
2. Enter Last.fm username (auto‑fills if connected privately)
3. (Optional) Connect + authorize to store `sessionKey`
4. Adjust colors / shadows / fonts / layout
5. Share URL auto‑updates (`/w#<b64>`)
6. Paste that URL into OBS Browser Source:
   - Width: 600–900 (varies with layout)
   - Height: 140–220
   - Enable “Refresh browser when scene becomes active” if rotating scenes
   - Set CSS if needed: `body { background: rgba(0,0,0,0); }` (already transparent)
7. Music changes → overlay auto updates
8. Paused? If configured, overlay collapses (no awkward stale display)

## Private Profile Support

- When you authenticate, a `sessionKey` is stored locally
- Editor injects it into the encoded widget URL
- Overlay uses it for scrobble API calls if present
- You can strip it before sharing a “public safe” variant

Important: anyone with a hash containing your session key can see what the API would return for you. Treat it like a lightweight token—avoid posting publicly unless you’re fine with that.

## The `useNowPlaying` Hook

Responsibilities:
- Poll `/api/lastfm/recent` (optionally `/trackInfo`) with dynamic cadence:
  - Faster while track is active
  - Slower during inactivity
- Generate an estimated progress bar by locally tracking elapsed ms
- Stabilize updates to prevent UI flicker when Last.fm lags
- Expose:
```ts
{
  track,          // { name, artist, album, imageUrl, nowPlaying?, ... }
  isLive,         // bool - currently “nowplaying”
  isPaused,       // heuristics (no “nowplaying” + same timestamp)
  progressMs,
  durationMs,
  percent,
  isPositionEstimated
}
```

Design choice: no websockets—polling + estimation = sufficient fidelity for music overlays.

## Where It Shines

- Zero server persistence (portable + privacy‑friendly)
- Entire state migrates via a link (excellent for scenes / backups)
- Fast iteration: add a theme field → encode → auto-shipped
- Private account support without building an auth portal
- Clear separation: Editor (stateful) vs Widget (pure)
- Stream overlay friendly: transparency, compactness, low CPU
- Extensible theming (can add outlines, gradients, animations later)
- Safe failure modes (no API = clean hidden state instead of broken markup)

## Setup Guide (Fresh Clone)

1. Clone repo
2. Create `.env.local`:
   ```
   LASTFM_API_KEY=xxxx
   LASTFM_API_SECRET=yyyy
   ```
3. Install deps:
   ```
   npm install
   ```
4. Run dev:
   ```
   npm run dev
   ```
5. Open `http://localhost:3000`
6. (Optional) Click “Connect Last.fm” → authorize → returns with session stored
7. Enter username (auto if authenticated)
8. Tweak styling → copy share link
9. Paste into OBS Browser Source:
   - Width: 600–900 (varies with layout)
   - Height: 140–220
   - Enable “Refresh browser when scene becomes active” if rotating scenes
   - Set CSS if needed: `body { background: rgba(0,0,0,0); }`

## Adapting to “Weird” Stream Setups

| Situation | Problem | Tweak |
|-----------|---------|-------|
| Vertical scene stack | Overlay too wide | Set direction=vertical, shrink cover |
| Cropped by filter | Edges clipped | Add outer padding div + encode new config |
| Low bitrate stream | Text blur | Increase font weight + enable strong shadow |
| Busy background | Legibility loss | Use solid semi‑opaque background mode |
| Multi‑theme scenes | Need variants | Duplicate URL → change accent per scene |
| Dual monitor / remote machine | Laggy sync | Reduce pollMs or disable progress bar estimation |

## Deep Editing Guide (Fork & Extend)

### 1. Add a New Theme Token
Want a year badge or custom label?

a. Extend `WidgetConfig`:
```ts
// In utils/config.ts
theme: {
  // ...existing
  badge?: {
    text: string;
    bg: string;
    color: string;
  };
}
```

b. Add defaults to `defaultConfig`.

c. Update editor form (search for other theme inputs).

d. Render in `w.tsx` inside the layout:
```tsx
{cfg.theme.badge && (
  <span
    style={{
      background: cfg.theme.badge.bg,
      color: cfg.theme.badge.color,
      padding: '2px 6px',
      fontSize: 11,
      borderRadius: 4
    }}
  >
    {cfg.theme.badge.text}
  </span>
)}
```

e. Link updates automatically—no backend change.

### 2. Custom Animation on Track Change
Insert a simple key transition:
```tsx
const fadeKey = track?.name + track?.artist;
<div key={fadeKey} className="transition-opacity duration-300 opacity-100">
  {/* existing text */}
</div>
```
Or add a diffing `usePrevious(track?.mbid)` to animate only when truly new.

### 3. Adjust Polling Strategy
Inside `useNowPlaying.ts`:
- Introduce a prop `fastPollMs` and `idlePollMs`
- Replace constants with config
- Editor can surface an “Advanced” panel later

### 4. Swap Data Source (Prototype Spotify)
Create `useSpotifyNowPlaying.ts` with identical return signature.
Add a `source: 'lastfm' | 'spotify'` field in config.
Switch hook consumption in overlay.

### 5. Add Outline Option (Pseudo Stroke)
Enhance shadow util: if user picks “outline”, generate multi‑direction stacked shadows.
Example:
```ts
function outline(color: string, r: number) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  return dirs.map(([x,y]) => `${x*r}px ${y*r}px 0 ${color}`).join(',');
}
```

### 6. Safe Mode (If API Fails)
Wrap network call → set a `failed` flag → overlay renders a placeholder like “(No Data)” or hides.

### 7. Adding a Secondary Line (Scrobble Count)
Extend config: `showScrobbleCount: boolean`.
Add endpoint to call `user.getInfo` (cache lightly).
Render under artist line if enabled.

### 8. Theme Presets
Create a `presets.ts`:
```ts
export const presets = {
  neon: {...},
  minimal: {...},
  card: {...}
};
```
Add a dropdown in editor to merge a preset into current config.

### 9. Multi‑Instance Coordination
If you embed twice (e.g., wide + compact), you can:
- Copy link
- Edit layout only
- Keep same session key (scrobbler state reused)

### 10. Don’t Leak Your Session Key
Add a toggle “Strip session key before copying public link”:
```ts
const safeConfig = { ...cfg, sessionKey: undefined };
const safeUrl = encodeConfig(safeConfig);
```

## Image Proxy Notes

Route: `/api/proxy-image?url=...`
Reasons:
- Prevent mixed content on HTTPS overlays
- Future: add resizing, caching headers, fallback image
- Avoid leaking direct Last.fm CDN access logs with your scrobble pattern (light privacy value)

## Failure Modes & Handling

| Failure | Current Behavior | Future Option |
|---------|------------------|---------------|
| Last.fm timeout | Overlay hides if no recent track | Show “No data” text |
| Invalid session key | Silent fallback to public | UI badge “Key expired” |
| Username typo | Empty feed | Add inline “User not found” prompt |
| Hash corruption | Decode error → defaults | Show decode error pill |
| Extremely long config | Bloated URL | Optional LZ-based compression |

## Security & Privacy

- Session key is NOT encryption—just convenience
- All config is client‑side; no analytics collection by default
- Consider adding a flag to anonymize artist/title (some streamers hide track names until after playback)
- If you fork publicly, document session key risk prominently

## Interesting Simplifications

1. Hash‑only state (no DB complexity)
2. LocalStorage ghost copy (resilience w/o servers)
3. Adaptive poll + estimation instead of progress websockets
4. Per‑element shadow toggling (microcontrol without text duplication)
5. Single `useNowPlaying` abstraction (future multi-source friendly)

## Problems Faced

| Problem | Symptom | Fix |
|---------|---------|-----|
| Private scrobbles hidden | Empty overlay for private users | Embedded sessionKey support |
| Theme drift | Hard-coded color values scattered | Centralized `WidgetConfig` + encode/decode |
| Stale paused track | Overlay “lies” that song is active | Hide-on-pause + heuristic for pause detection |
| Font/shadow tinkering friction | Rebuilds for tiny changes | Live editor w/ preview + URL sync |
| Sharing variations | Manual screenshot/logging | Hash becomes the single artifact |
| Bad contrast on some scenes | Unreadable meta text | Accent tokens + fallback colors |

## What I’d Add Next

- Optional mini queue mode (show next track if available)
- Responsive container scaling (`scale` param)
- Built‑in theme gallery + preset importer
- Session key obfuscation (not true security, just accident prevention)
- Drag‑to‑reorder text elements in editor
- Auto‑color accent from album art (with contrast threshold)
- Framerate smoothing of progress bar (requestAnimationFrame)
- LZ-based compression for huge future configs

## OBS / Streaming Tips

| Goal | Tip |
|------|-----|
| Crisp text 1080p → 720p downscale | Set browser source resolution to final canvas size; avoid double scaling |
| Album art rounding | Add CSS override: `img { border-radius: 12px !important; }` |
| Color match chat or theme | Reuse same accent hex across tools |
| Scene transition stutter | Enable “Refresh when active” only if necessary |
| HDR scenes washed overlay | Add semi‑opaque dark background mode |

## Deployment

Simple path:
1. Deploy to Vercel (defaults fine)
2. Add env vars
3. Set caching (optional) for `/api/proxy-image`
4. Protect fork if using personal session key (don’t check it in)
5. Use canonical production URL for OBS (avoid localhost caches)

## Closing

This overlay leans into “link as artifact” thinking: shareable, forkable, transparent. Private profile compatibility plus theming depth makes it ideal for streamers who want control without another hosted dashboard.

If you fork it:
- Start by reading `utils/config.ts`
- Add one enhancement at a time
- Keep editor and widget separate in concerns
- Don’t prematurely add a backend unless you need shared state

Ship it scrappy. Refine with real scene usage. Let ergonomics, not ideology, drive the next tweak.

Source: https://github.com/oyuh/applem-util (rename or split as needed)
