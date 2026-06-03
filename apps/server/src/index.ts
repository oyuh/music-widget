import { Hono } from "hono";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppEnv } from "./types";
import { handleProxyImage, handleRecent, handleSession, handleTrackInfo } from "./lastfm";
import { handleContact, handleWidgetLog } from "./analytics";
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
        { error: "Too many requests — slow down for a moment." },
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

// Liveness probe — always 200 while the process is up (used by Railway's
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

app.all("/api/*", () => json({ error: "Not found" }, { status: 404 }));

app.get("/robots.txt", (c) => {
  const origin = getOrigin(c);
  const body = ["User-agent: *", "Allow: /", `Sitemap: ${origin}/sitemap.xml`].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

app.get("/sitemap.xml", (c) => {
  const origin = getOrigin(c);
  const urls = [
    { loc: `${origin}/`, priority: 1.0 },
    { loc: `${origin}/w`, priority: 0.8 },
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (url) =>
        `  <url>\n    <loc>${xmlEscape(url.loc)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${url.priority.toFixed(1)}</priority>\n  </url>`,
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
    return new Response(index, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }

  return c.text("Build not found. Run `bun run build:web` first.", 404);
});

const port = Number(process.env.PORT) || 8787;

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
