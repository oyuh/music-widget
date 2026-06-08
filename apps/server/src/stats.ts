import type { Context } from "hono";
import type { AppEnv } from "./types";
import { countWidgetUsers, dbEnabled } from "./db";
import { json } from "./util";

// Site-wide usage stats, computed in the BACKGROUND and held in memory. The
// editor wants to show "N people use this" on load WITHOUT polling and WITHOUT
// touching the database on every visit. So a slow background task does all the
// real work , counting distinct usernames (some people have many rows under one
// username; that dedup happens here, not per-request) , and stashes the result.
// The public route is dumb: it just hands back the number already in memory.
// No cron job, no per-request query , a single read of a module variable.

// How often the background task recomputes. The number drifts slowly and this is
// a vanity stat, so a relaxed cadence is plenty.
const REFRESH_MS = 7 * 60 * 1000; // 7 minutes

let cachedUsers = 0;
let refreshedAt = 0; // epoch ms of the last successful refresh, 0 until warmed
let started = false;

async function refresh(): Promise<void> {
  const n = await countWidgetUsers(); // null on failure , keep the last good value
  if (n != null) {
    cachedUsers = n;
    refreshedAt = Date.now();
    console.log('Users counted: ', cachedUsers.toString)
    console.log('Happened ', refreshedAt.toString)
  }

}

/**
 * Start the background stats task exactly once. Warms the value immediately, then
 * recomputes every REFRESH_MS. No-op when storage isn't configured (the count
 * stays 0 and the editor simply hides it). The interval is unref'd so it never
 * keeps the process alive on its own (clean shutdown / test exit).
 */
export function startStatsRefresh(): void {
  if (started || !dbEnabled()) return;
  started = true;



  void refresh(); // warm on boot so the first request already has a value
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  timer.unref?.();
}

/**
 * GET /api/site-stats , returns the pre-computed site stats straight from memory.
 * Does NOT query the database; the background task above is the only thing that
 * does. `refreshedAt` is null until the first successful refresh. Short cache
 * header since the value only changes every REFRESH_MS anyway.
 */
export const handleSiteStats = (_c: Context<AppEnv>) =>
  json(
    { users: cachedUsers, refreshedAt: refreshedAt || null },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
