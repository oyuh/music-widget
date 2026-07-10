# Contributing

Thanks for taking the time to look at this. Contributions are welcome and credited. This is a small project, so nothing here is heavy process, but a bit of consistency keeps things clean.

## Before you start

For anything larger than a bug fix or a small tweak, open an issue first so we can agree on the approach before you sink time into it. Small, self-contained PRs are much easier to review and land than large ones.

## Setup

You need [Bun](https://bun.sh) 1.3.x or newer. Docker is optional (local Redis + Postgres); both services fail open, so the app runs fine without them.

```bash
bun install
bun run services:up   # Redis + Postgres in Docker (optional)
bun run dev           # Vite UI on :5173, Hono API on :8787
```

Copy [`.env.example`](.env.example) into `.env` (server values) and `.env.local` (frontend `VITE_*` values). You'll need a Last.fm API key and shared secret from https://www.last.fm/api/account/create to exercise the real data path.

See the [README](README.md) for how the pieces fit together before diving in.

## Checks to run before opening a PR

CI runs these on every push and pull request, so run them locally first:

```bash
bun run typecheck   # server + web
bun test            # unit tests
bun run build:web   # SPA build
```

All three need to pass. If you're touching polling, layout, or config encoding, add or update a test under [`tests/`](tests/).

## Conventions

- **Language:** TypeScript across the board, Svelte 5 runes on the frontend.
- **Database:** after editing [`apps/server/src/schema.ts`](apps/server/src/schema.ts), run `bun run db:generate` and commit the generated migration under `apps/server/drizzle/`.
- **Config changes:** the widget config is versioned. If you change the shape in [`config.ts`](apps/web/src/lib/config.ts), keep old encoded URLs working (extend the migration path rather than breaking decode).
- **Commits:** short, present-tense summaries are fine. No strict convention enforced.
- **Prose and comments:** casual and human, and no em dashes.

## Licensing of contributions

By submitting a pull request, you agree that your contribution is licensed under the project's [LICENSE](LICENSE) and may be included in the project. Contributors are credited.

## Questions

Open an issue, or reach out at [me@lawsonhart.me](mailto:me@lawsonhart.me).
