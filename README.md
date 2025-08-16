Fast Music Stream Widget (Last.fm)

Simple, customizable stream overlay that shows your current (or recent) track from Last.fm. Includes an in-browser editor to configure the widget and a shareable widget URL for OBS.

Features
- Live now playing from Last.fm (5s polling, resilient to transient errors)
- Album art with auto theme (extract dominant color + contrast text)
- Typography: Google font, per-text colors/sizes/styles (title/artist/album/meta)
- Layout: alignment, album art position/size, negative text gap, per-text X/Y offsets
- Scrolling text (marquee): adjustable speed and gap, with per-text overrides
- Paused/not playing behavior: show label or fully transparent
- Share/copy settings, editor import, and deep-merge paste

How it works
- Editor: `/` (index)
	- Build your design, see a live preview, and copy the widget link.
	- If you connect Last.fm (optional), private profiles will preview correctly.
	- The editor stores your config as JSON and also encodes it for sharing.

- Widget: `/w#<base64-config>`
	- The widget page is read-only and uses the config in the URL hash.
	- Designed for OBS Browser Source (transparent background supported).

Local setup
1) Create a Last.fm API app: https://www.last.fm/api/account/create
2) Add `.env.local` with:
	 - `NEXT_PUBLIC_LFM_KEY` — your API key
	 - `LFM_SHARED_SECRET` — your shared secret
	 - Optional: `NEXT_PUBLIC_LFM_CALLBACK` (defaults to `/callback`)
3) Start dev server:
	 - `npm run dev` (or `pnpm dev`, `yarn dev`)
4) Open http://localhost:3000

Usage in OBS
1) In the editor, copy the “Your unique widget link” (looks like `/w#...`).
2) In OBS, add a Browser Source with that URL.
3) Set the width/height in OBS to match your widget config.

Troubleshooting
- Long titles: The marquee uses a measured distance and gap—tweak speed/gap in the Marquee section.
- Fonts not applying: Ensure the selected Google font downloads in your environment.
- Transparent when paused: Set Fields → “When paused / not playing” to “Hide card (transparent)”.
