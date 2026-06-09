import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppEnv } from "./types";
import { handleProxyImage, handleRecent, handleSession, handleTrackInfo } from "./lastfm";
import { handleContact, handleCronCleanup, handleFeedback, handleWidgetLog } from "./analytics";
import { handleSiteStats, startStatsRefresh } from "./stats";
import { redisEnabled, redisPing } from "./redis";
import { dbEnabled, dbPing } from "./db";
import { clientIp, rateLimitOk } from "./security";
import { json, xmlEscape } from "./util";
import { log } from "./log";

const app = new Hono<AppEnv>();

/** Public origin, honoring the Railway/edge proxy headers. */
function getOrigin(c: { req: { header: (name: string) => string | undefined; url: string } }) {
  const host = c.req.header("host");
  if (host) {
    const proto = c.req.header("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

// Reject oversized request bodies before anything reads them. Every API body
// here is small JSON (a few KB at most), so a large payload is junk or an
// attempt to exhaust memory. GETs carry no body, so this only bites POSTs.
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 32 * 1024, // 32 KB
    onError: (c) => json({ error: "Request body too large." }, { status: 413 }),
  }),
);

// Request id, timing, and top-level error handling for the API surface.
app.use("/api/*", async (c, next) => {
  const reqId =
    c.req.header("x-request-id") ||
    c.req.header("x-railway-request-id") ||
    c.req.header("cf-ray") ||
    crypto.randomUUID();
  c.set("reqId", reqId);

  // Lenient per-IP rate limit (skips health/liveness + preflight).
  const path = new URL(c.req.url).pathname;
  const exempt = c.req.method === "OPTIONS" || path === "/api/ping" || path === "/api/health";
  if (!exempt) {
    const limit = await rateLimitOk(clientIp(c), reqId);
    if (!limit.ok) {
      c.res = json(
        { error: "Too many requests, slow down for a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
      return;
    }
  }

  const t0 = Date.now();
  try {
    await next();
  } catch (error) {
    log("error", "api.error", {
      requestId: reqId,
      path: new URL(c.req.url).pathname,
      durationMs: Date.now() - t0,
      error: error instanceof Error ? error.message : String(error),
    });
    c.res = json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
});

app.options("/api/*", () => new Response(null, { status: 204 }));

// Liveness probe , always 200 while the process is up (used by Railway's
// healthcheck). /api/health additionally reports Redis status and may 503.
app.get("/api/ping", () => json({ ok: true }));

app.get("/api/health", async () => {
  // Postgres backs only the optional usage log, so its status is informational
  // and never changes the response code.
  let db = "disabled";
  if (dbEnabled()) {
    try {
      db = (await dbPing()) ? "connected" : "unhealthy";
    } catch {
      db = "error";
    }
  }

  if (!redisEnabled()) return json({ ok: true, redis: "disabled", db });

  try {
    const ok = await redisPing();
    return json({ ok: true, redis: ok ? "connected" : "unhealthy", db }, { status: ok ? 200 : 503 });
  } catch (error) {
    return json(
      {
        ok: false,
        redis: "error",
        db,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
});

app.get("/api/lastfm/recent", handleRecent);
app.get("/api/lastfm/trackInfo", handleTrackInfo);
app.post("/api/lastfm/session", handleSession);
app.get("/api/proxy-image", handleProxyImage);
app.post("/api/log/widget", handleWidgetLog);
app.post("/api/contact", handleContact);
app.post("/api/feedback", handleFeedback);
app.post("/api/cron/cleanup", handleCronCleanup);
app.get("/api/site-stats", handleSiteStats);

app.all("/api/*", () => json({ error: "Not found" }, { status: 404 }));

app.get("/robots.txt", (c) => {
  const origin = getOrigin(c);
  // /w stays crawlable on purpose: shared widget links must be fetched so the
  // X-Robots-Tag noindex on them is actually seen.
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /callback",
    `Sitemap: ${origin}/sitemap.xml`,
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

// lastmod for the sitemap: the content only changes when a new build deploys,
// so the process start date is an honest approximation.
const SITEMAP_LASTMOD = new Date().toISOString().slice(0, 10);

app.get("/sitemap.xml", (c) => {
  const origin = getOrigin(c);
  // Only the editor home page; /w and /callback are noindexed app-state pages.
  const urls = [{ loc: `${origin}/`, priority: 1.0 }];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (url) =>
        `  <url>\n    <loc>${xmlEscape(url.loc)}</loc>\n    <lastmod>${SITEMAP_LASTMOD}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${url.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join("\n")}\n</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

// --- Static SvelteKit SPA (production) -------------------------------------
// In dev the Vite server serves the UI and proxies /api here, so these routes
// only matter in production where Hono serves the built assets + SPA fallback.

const WEB_DIR = process.env.WEB_DIR
  ? normalize(process.env.WEB_DIR)
  : fileURLToPath(new URL("../../web/build", import.meta.url));

const INDEX_HTML = join(WEB_DIR, "index.html");

function safeJoin(root: string, requestPath: string) {
  const rel = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.([/\\]|$))+/, "");
  return join(root, rel);
}

// The widget/callback pages get index.html with the `<!-- editor-only -->`
// blocks removed (SEO meta, JSON-LD, editor fonts, noscript copy — see
// apps/web/src/app.html). Stripped once and cached for the process lifetime;
// the file only changes when a new build deploys.
let leanIndexCache: string | null = null;
async function leanIndexHtml(index: ReturnType<typeof Bun.file>) {
  if (leanIndexCache === null) {
    const html = await index.text();
    leanIndexCache = html.replace(/<!-- editor-only -->[\s\S]*?<!-- \/editor-only -->/g, "");
  }
  return leanIndexCache;
}

app.get("*", async (c) => {
  const { pathname } = new URL(c.req.url);

  if (pathname !== "/") {
    const filePath = safeJoin(WEB_DIR, pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const immutable = pathname.startsWith("/_app/immutable/");
      return new Response(file, {
        headers: immutable
          ? { "Cache-Control": "public, max-age=31536000, immutable" }
          : { "Cache-Control": "public, max-age=3600" },
      });
    }
  }

  // SPA fallback: hand every unmatched route to the client router.
  const index = Bun.file(INDEX_HTML);
  if (await index.exists()) {
    // The widget (/w) and auth callback are app-state pages with no standalone
    // content: keep them out of search results so only the editor (/) ranks,
    // and serve them the lean shell so the OBS widget loads as fast as possible.
    const appPage = pathname === "/w" || pathname === "/callback" || pathname.startsWith("/callback/");
    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    };
    if (appPage) {
      return new Response(await leanIndexHtml(index), {
        headers: { ...headers, "X-Robots-Tag": "noindex" },
      });
    }
    return new Response(index, { headers });
  }

  return c.text("Build not found. Run `bun run build:web` first.", 404);
});

const port = Number(process.env.PORT) || 8787;

// Begin the in-memory usage-count refresh loop (no-op without a database).
startStatsRefresh();

log("info", "server.start", {
  port,
  redis: redisEnabled() ? "configured" : "disabled",
  db: dbEnabled() ? "configured" : "disabled",
  webDir: WEB_DIR,
});

export default {
  port,
  fetch: app.fetch,
};
