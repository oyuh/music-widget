import type { Context } from "hono";
import type { AppEnv } from "./types";
import { json } from "./util";
import { log } from "./log";

// GitHub star count for the footer's Star button. Same shape as stats.ts: a slow
// background task talks to GitHub and stashes the number in memory, and the
// public route just hands back what's already there. That keeps every visitor
// off GitHub's unauthenticated rate limit (60 requests/hour per IP) no matter
// how many people have the editor open.

const REPO = process.env.GITHUB_REPO || "oyuh/music-widget";
// Optional; a token only raises the rate limit, and one call per REFRESH_MS is
// nowhere near the anonymous ceiling, so this stays unset in practice.
const TOKEN = process.env.GITHUB_TOKEN || "";

const REFRESH_MS = 15 * 60 * 1000; // 15 minutes

let cachedStars = 0;
let refreshedAt = 0; // epoch ms of the last successful refresh, 0 until warmed
let started = false;

async function refresh(): Promise<void> {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "music-widget",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      log("warn", "github.stars.upstream", { status: r.status, repo: REPO });
      return; // keep the last good value
    }
    const d = (await r.json()) as { stargazers_count?: unknown };
    const n = typeof d.stargazers_count === "number" ? d.stargazers_count : NaN;
    if (!Number.isFinite(n) || n < 0) return;
    cachedStars = n;
    refreshedAt = Date.now();
  } catch (err) {
    log("warn", "github.stars.failed", { repo: REPO, err: String(err) });
  }
}

/**
 * Start the background star-count task exactly once. Warms the value on boot,
 * then refreshes every REFRESH_MS. The interval is unref'd so it never keeps the
 * process alive on its own.
 */
export function startGithubStarsRefresh(): void {
  if (started) return;
  started = true;

  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  timer.unref?.();
}

/**
 * GET /api/github-stars: the pre-computed star count straight from memory. Never
 * calls GitHub itself. `stars` is 0 until the first refresh lands (the editor
 * hides the count in that case rather than showing a bare zero).
 */
export const handleGithubStars = (_c: Context<AppEnv>) =>
  json(
    { stars: cachedStars, repo: REPO, refreshedAt: refreshedAt || null },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
