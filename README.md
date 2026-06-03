# Fast Music Last.fm Widget for Streaming

A customizable Last.fm now-playing widget for OBS, XSplit, Streamlabs, and other
streaming software — with a visual, drag-and-drop editor.

Built as a Bun monorepo: a **SvelteKit** SPA editor + widget, and a **Hono/Bun**
server, deployed as one **Railway** service. Public Last.fm calls go directly
from each viewer's browser, so it scales to hundreds of concurrent widgets
without hitting Last.fm's per-IP rate limits.

## Quick Start (using the hosted app)

1. Make sure your music player is **scrobbling to Last.fm**.
2. Go to [fast.jamlog.lol](https://fast.jamlog.lol), enter your Last.fm username,
   and design your widget (click elements, drag to move, resize, tweak in the
   inspector).
3. Click **Copy widget URL**.
4. Add it to your streaming software as a **Browser Source** (OBS / Streamlabs)
   or **Web Page** (XSplit).

Your settings live in the URL hash, so the copied URL carries your whole design.
Want faster updates? Use the **"Use your own API key"** option in the editor.

## Development

Requires [Bun](https://bun.sh) 1.3+.

```bash
bun install
bun run redis:up   # optional local Redis (Docker)
bun run dev        # Vite UI :5173 + Hono API :8787
```

Open <http://localhost:5173>. See [`docs/local-development.md`](docs/local-development.md).

## Docs

- [Architecture](docs/architecture.md) — how it's wired and why it scales.
- [Local development](docs/local-development.md)
- [Deployment](docs/deployment.md) — Railway + Redis + domain cutover.

## License

Permission is hereby granted to use, copy, and modify this software for personal
use, including local hosting and streaming integration.

**Restrictions:**
- You may NOT redistribute, publish, or claim this code as your own
- Commercial redistribution requires explicit permission from the author
- Contact the author for redistribution rights

**Contributions** are welcome and credited; by contributing you agree to these terms.

[**Email me**](mailto:me@lawsonhart.me)
