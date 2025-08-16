// src/pages/index.tsx
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import LastfmConnect from "../components/LastfmConnect";
import { WidgetConfig, defaultConfig, encodeConfig } from "../utils/config";
import { useNowPlaying } from "../hooks/useNowPlaying";
import ScrollText from "../components/ScrollText";
import { extractDominantColor, getReadableTextOn } from "../utils/colors";
import { KEYWORDS_META } from "../utils/keywords";
import { Analytics } from "@vercel/analytics/next"

export default function EditorPage() {
  // Config state
  const [cfg, setCfg] = useState<WidgetConfig>(defaultConfig);

  // Connection (optional; preview only)
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);

  // UI helpers
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [share, setShare] = useState("");

  useEffect(() => {
    setMounted(true);
    try {
      const sk = localStorage.getItem("lfm_session_key");
      const nm = localStorage.getItem("lfm_session_name");
      if (sk) setSessionKey(sk);
      if (nm) setConnectedName(nm);
    } catch {}
  }, []);

  // Basic SEO constants
  const seo = useMemo(() => {
    const title = "Fast Music Stream Widget (Last.fm)";
    const description = "A fast, customizable music overlay for streamers powered by Last.fm. Pick fonts, colors, marquee scrolling, and auto-theme from album art. Works great in OBS as a Browser Source.";
    const keywords = KEYWORDS_META;
    return { title, description, keywords };
  }, []);
  const siteOrigin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);
  const socialImage = `${siteOrigin || ""}/window.svg`;

  // Build share and editor-import URLs when config changes on client
  const editorImportUrl = useMemo(() => {
    if (!mounted) return "";
    const origin = window.location.origin;
    const b64 = encodeConfig(cfg);
    return `${origin}/?import=${b64}`;
  }, [cfg, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const origin = window.location.origin;
    const b64 = encodeConfig(cfg);
    setShare(`${origin}/w#${b64}`);
  }, [cfg, mounted]);

  // Live data for preview (uses connection if present)
  const { track, isLive, percent } = useNowPlaying({
    username: cfg.lfmUser,
  pollMs: 5000,
    sessionKey,
  });

  // Editor-level computed colors for auto-from-art so the controls reflect them
  const isLastfmPlaceholder = (u?: string) => !!u && /2a96cbd8b46e442fc41c2b86b821562f/i.test(u);
  const artUrl = useMemo(() => {
    const imgs = track?.image ?? [];
    for (let i = imgs.length - 1; i >= 0; i--) {
      const u = imgs[i]?.["#text"] ?? "";
      if (u && !isLastfmPlaceholder(u)) return u;
    }
    return "";
  }, [track]);
  const [computedText, setComputedText] = useState(cfg.theme.text);
  const [computedAccent, setComputedAccent] = useState(cfg.theme.accent);
  useEffect(() => {
    let t = 0 as unknown as number;
    let retryCount = 0;
    const maxRetries = 3; // Stop retrying after 3 attempts to avoid infinite flickering

    const tick = async () => {
      if (!cfg.theme.autoFromArt) {
        // Auto-from-art disabled: reflect configured colors
        const newText = cfg.theme.text;
        const newAccent = cfg.theme.accent;
        // Only update if actually different to prevent flicker
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);
        return; // Don't schedule another retry for non-auto mode
      } else if (artUrl) {
        // Auto-from-art enabled with an image: try to extract via proxy; keep last-good on failure
        const color = await extractDominantColor(artUrl);
        if (color) {
          const textColor = (cfg.theme.bgEnabled ?? true)
            ? getReadableTextOn(cfg.theme.bg)
            : "#ffffff"; // with transparent background, default to white for readability
          const newText = { title: textColor, artist: textColor, album: textColor, meta: textColor };
          const newAccent = color;
          // Only update if colors actually changed - use functional updates to access current values
          setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
          setComputedAccent(prev => prev !== newAccent ? newAccent : prev);

          // If we got a successful extraction, stop retrying
          return;
        } else {
          // Extraction failed: reset to a safe white text and default accent
          const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff" };
          const newAccent = cfg.fallbackAccent || cfg.theme.accent;
          setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
          setComputedAccent(prev => prev !== newAccent ? newAccent : prev);

          // Retry extraction a few times in case of transient failures
          retryCount++;
          if (retryCount < maxRetries) {
            t = window.setTimeout(tick, 2000) as unknown as number; // Longer delay between retries
          }
        }
      } else {
        // Auto-from-art enabled but no art: reset to white text and default accent
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff" };
        const newAccent = cfg.fallbackAccent || cfg.theme.accent;
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);
        return; // Don't schedule retry for no-art case
      }
    };

    // Reset retry count when dependencies change (new track, etc.)
    retryCount = 0;
    tick();
    return () => { if (t) clearTimeout(t); };
  }, [cfg.theme.autoFromArt, cfg.theme.text, cfg.theme.accent, cfg.theme.bg, cfg.theme.bgEnabled, cfg.fallbackAccent, artUrl]);

  // config helpers
  function update<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  function isAccent(k: keyof WidgetConfig["theme"]["text"]) {
    return cfg.theme.text[k] === "accent";
  }

  function toggleAccentFor(k: keyof WidgetConfig["theme"]["text"], on: boolean) {
    if (on) {
      update("theme", { ...cfg.theme, text: { ...cfg.theme.text, [k]: "accent" } });
    } else {
      // When turning off accent, restore a reasonable hex value
      const current = cfg.theme.text[k];
      const fallback = (typeof current === 'string' && current !== 'accent')
        ? (current as string)
        : (cfg.theme.autoFromArt ? (computedText[k] as string) : (defaultConfig.theme.text[k] as string));
      update("theme", { ...cfg.theme, text: { ...cfg.theme.text, [k]: fallback || "#ffffff" } });
    }
  }

  async function copySettings() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(cfg));
    } catch {}
  }

  async function pasteSettings() {
    try {
      const t = await navigator.clipboard.readText();
      const parsed = JSON.parse(t);
      // shallow + selective deep merge to keep required keys
      const next: WidgetConfig = {
        ...defaultConfig,
        ...parsed,
        theme: {
          ...defaultConfig.theme,
          ...parsed?.theme,
          text: { ...defaultConfig.theme.text, ...(parsed?.theme?.text ?? {}) },
          textSize: {
            title: parsed?.theme?.textSize?.title ?? defaultConfig.theme.textSize!.title,
            artist: parsed?.theme?.textSize?.artist ?? defaultConfig.theme.textSize!.artist,
            album: parsed?.theme?.textSize?.album ?? defaultConfig.theme.textSize!.album,
            meta: parsed?.theme?.textSize?.meta ?? defaultConfig.theme.textSize!.meta,
          },
          textStyle: {
            title: {
              italic: parsed?.theme?.textStyle?.title?.italic ?? defaultConfig.theme.textStyle!.title.italic,
              underline: parsed?.theme?.textStyle?.title?.underline ?? defaultConfig.theme.textStyle!.title.underline,
              bold: parsed?.theme?.textStyle?.title?.bold ?? defaultConfig.theme.textStyle!.title.bold,
              strike: parsed?.theme?.textStyle?.title?.strike ?? defaultConfig.theme.textStyle!.title.strike,
            },
            artist: {
              italic: parsed?.theme?.textStyle?.artist?.italic ?? defaultConfig.theme.textStyle!.artist.italic,
              underline: parsed?.theme?.textStyle?.artist?.underline ?? defaultConfig.theme.textStyle!.artist.underline,
              bold: parsed?.theme?.textStyle?.artist?.bold ?? defaultConfig.theme.textStyle!.artist.bold,
              strike: parsed?.theme?.textStyle?.artist?.strike ?? defaultConfig.theme.textStyle!.artist.strike,
            },
            album: {
              italic: parsed?.theme?.textStyle?.album?.italic ?? defaultConfig.theme.textStyle!.album.italic,
              underline: parsed?.theme?.textStyle?.album?.underline ?? defaultConfig.theme.textStyle!.album.underline,
              bold: parsed?.theme?.textStyle?.album?.bold ?? defaultConfig.theme.textStyle!.album.bold,
              strike: parsed?.theme?.textStyle?.album?.strike ?? defaultConfig.theme.textStyle!.album.strike,
            },
            meta: {
              italic: parsed?.theme?.textStyle?.meta?.italic ?? defaultConfig.theme.textStyle!.meta.italic,
              underline: parsed?.theme?.textStyle?.meta?.underline ?? defaultConfig.theme.textStyle!.meta.underline,
              bold: parsed?.theme?.textStyle?.meta?.bold ?? defaultConfig.theme.textStyle!.meta.bold,
              strike: parsed?.theme?.textStyle?.meta?.strike ?? defaultConfig.theme.textStyle!.meta.strike,
            },
          },
        },
        layout: { ...defaultConfig.layout, ...(parsed?.layout ?? {}) },
        fields: { ...defaultConfig.fields, ...(parsed?.fields ?? {}) },
      };
      setCfg(next);
    } catch {}
  }

  return (
    <>
      <Head>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="application-name" content="Fast Music Stream Widget" />
        <meta name="theme-color" content={cfg.theme.bg} />
        {siteOrigin && <link rel="canonical" href={siteOrigin} />}

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Fast Music Stream Widget" />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        {siteOrigin && <meta property="og:url" content={siteOrigin} />}
        {siteOrigin && <meta property="og:image" content={socialImage} />}
        <meta property="og:image:alt" content="Fast Music Stream Widget preview" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        {siteOrigin && <meta name="twitter:image" content={socialImage} />}

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          // Using a string to avoid hydration warnings
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Fast Music Stream Widget",
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Windows, macOS, Linux",
              description: seo.description,
              url: siteOrigin || undefined,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }),
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.theme.font).replace(/%20/g, "+")}:wght@400;600;700&display=swap`}
          rel="stylesheet"
        />
      </Head>
      <main className="min-h-screen bg-neutral-950 text-white">
        <div className="max-w-3xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold tracking-tight">Fast Music (via Last.fm) Stream Widget</h1>
            <a
              href="https://lawsonhart.me"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white/80"
            >
              Creator
            </a>
            <a
              href="https://github.com/oyuh/applem-util"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white/80"
            >
              Source
            </a>
          </div>
          <p className="text-white/70 mb-6 leading-relaxed">
            Enter your Last.fm username, customize the card, and copy your unique link to use as a Browser Source in OBS. {" "}
            <a href="https://www.last.fm/about/trackmymusic" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 decoration-white/70 hover:decoration-white text-white">Set up scrobbles before using this app</a>.
          </p>

          {/* Connection */}
          <details open className="mb-4 bg-neutral-900/40 border border-white/10 rounded-lg">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Connection</summary>
            <div className="px-3 pb-3 pt-1">
              <div className="flex items-center gap-3 mb-3">
                <LastfmConnect />
                {sessionKey ? (
                  <span className="text-green-400">Connected as <b>{connectedName}</b> (private OK)</span>
                ) : (
                  <span className="text-white/60">Not connected (public profiles work without connecting)</span>
                )}
              </div>
              <label className="block text-sm mb-1">Last.fm Username</label>
              <input
                className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2"
                value={cfg.lfmUser}
                onChange={(e) => update("lfmUser", e.target.value)}
                placeholder="your-lastfm-username"
              />
            </div>
          </details>

          {/* Preview + share near the top */}
          <div className="mt-6 mb-2 flex items-center justify-between">
            <h3 className="font-medium">Preview</h3>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 px-3 py-1.5 text-sm border border-white/10"
              title="Force refresh the preview"
            >
              ↻ Refresh
            </button>
          </div>
          <WidgetPreview
            key={refreshKey}
            cfg={cfg}
            isLive={isLive}
            percent={percent}
            trackTitle={track?.name}
            artist={track?.artist?.["#text"]}
            album={track?.album?.["#text"]}
            art={artUrl}
          />

          {mounted && (
            <div className="mt-6 space-y-3">
              <h3 className="font-medium">Your unique widget link</h3>
              <div className="flex gap-2">
                <input
                  readOnly
                  className="flex-1 min-w-0 rounded bg-neutral-800 border border-white/10 px-3 py-2"
                  value={share}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="rounded bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 px-3 py-2 text-sm border border-white/10 whitespace-nowrap"
                  onClick={async () => { try { await navigator.clipboard.writeText(share); } catch {} }}
                >
                  Copy link
                </button>
                <a
                  className="rounded bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 px-3 py-2 text-sm border border-white/10 whitespace-nowrap"
                  href={share}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open widget
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                <span>Edit later:</span>
                <a
                  href={editorImportUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 px-3 py-1.5 border border-white/10"
                >
                  Open in editor
                </a>
                <button
                  type="button"
                  className="rounded bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 px-3 py-1.5 border border-white/10"
                  onClick={async () => { try { await navigator.clipboard.writeText(editorImportUrl); } catch {} }}
                >
                  Copy editor import URL
                </button>
                <span className="ml-2">Settings:</span>
                <button
                  type="button"
                  className="rounded bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 px-3 py-1.5 border border-white/10"
                  onClick={copySettings}
                >
                  Copy settings
                </button>
                <button
                  type="button"
                  className="rounded bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 px-3 py-1.5 border border-white/10"
                  onClick={pasteSettings}
                >
                  Paste settings
                </button>
              </div>
            </div>
          )}

          {/* Collapsible settings */}
          <details open className="mt-8 mb-4 bg-neutral-900/40 border border-white/10 rounded-lg">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Theme basics</summary>
            <div className="px-3 pb-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Background</label>
                  <input
                    type="color"
                    className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2 h-9"
                    value={cfg.theme.bg}
                    onChange={(e) => update("theme", { ...cfg.theme, bg: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Accent</label>
                  <input
                    type="color"
                    className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2 h-9"
                    value={cfg.theme.autoFromArt ? computedAccent : cfg.theme.accent}
                    disabled={cfg.theme.autoFromArt}
                    onChange={(e) => update("theme", { ...cfg.theme, accent: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1">Fallback accent (used when album color is unavailable)</label>
                  <input
                    type="color"
                    className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2 h-9"
                    value={cfg.fallbackAccent || cfg.theme.accent}
                    onChange={(e) => setCfg({ ...cfg, fallbackAccent: e.target.value })}
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 mt-3 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.theme.bgEnabled ?? true}
                  onChange={(e) => update("theme", { ...cfg.theme, bgEnabled: e.target.checked })}
                />
                Show background
              </label>
              <div className="mt-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cfg.layout.showArt}
                    onChange={(e) => update("layout", { ...cfg.layout, showArt: e.target.checked })}
                  />
                  Show album art
                </label>
              </div>
            </div>
          </details>

          <details className="mb-4 bg-neutral-900/40 border border-white/10 rounded-lg">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Theme: per-text colors</summary>
            <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-4 gap-3 mt-1">
              {(["title", "artist", "album", "meta"] as const).map((k) => (
                <div key={k}>
                  <label className="block text-sm mb-1 capitalize">{k} color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="rounded bg-neutral-800 border border-white/10 h-9 w-9"
                      disabled={isAccent(k)}
                      value={isAccent(k) ? (cfg.theme.autoFromArt ? computedAccent : cfg.theme.accent) : (cfg.theme.autoFromArt ? (computedText[k] as string) : (cfg.theme.text[k] as string))}
                      onChange={(e) => update("theme", { ...cfg.theme, text: { ...cfg.theme.text, [k]: e.target.value } })}
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-white/80">
                      <input type="checkbox" checked={isAccent(k)} onChange={(e) => toggleAccentFor(k, e.target.checked)} />
                      Use accent
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </details>

          <details className="mb-4 bg-neutral-900/40 border border-white/10 rounded-lg">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Theme: auto from album art</summary>
            <div className="px-3 pb-3 pt-1">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.theme.autoFromArt}
                  onChange={(e) => update("theme", { ...cfg.theme, autoFromArt: e.target.checked })}
                />
                Auto theme from album art
              </label>
              {/* Per-text apply toggles removed: auto-from-art applies to all text fields when enabled */}
            </div>
          </details>

          <details className="mb-4 bg-neutral-900/40 border border-white/10 rounded-lg">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Typography</summary>
            <div className="px-3 pb-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Font</label>
                  <select
                    className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
                    value={cfg.theme.font}
                    onChange={(e) => update("theme", { ...cfg.theme, font: e.target.value })}
                  >
                    {["Inter", "Poppins", "Roboto", "Montserrat", "Nunito", "Oswald", "Lato"].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <details className="mt-3 bg-neutral-900/30 border border-white/10 rounded-lg">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Text sizes</summary>
                <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                  <label className="block">Title size
                    <input type="range" min={10} max={48} value={cfg.theme.textSize?.title ?? 16} onChange={(e)=> update("theme", { ...cfg.theme, textSize: { ...(cfg.theme.textSize ?? { title:16, artist:14, album:12, meta:12 }), title: +e.target.value }})} className="w-full" />
                  </label>
                  <label className="block">Artist size
                    <input type="range" min={10} max={40} value={cfg.theme.textSize?.artist ?? 14} onChange={(e)=> update("theme", { ...cfg.theme, textSize: { ...(cfg.theme.textSize ?? { title:16, artist:14, album:12, meta:12 }), artist: +e.target.value }})} className="w-full" />
                  </label>
                  <label className="block">Album size
                    <input type="range" min={10} max={32} value={cfg.theme.textSize?.album ?? 12} onChange={(e)=> update("theme", { ...cfg.theme, textSize: { ...(cfg.theme.textSize ?? { title:16, artist:14, album:12, meta:12 }), album: +e.target.value }})} className="w-full" />
                  </label>
                  <label className="block">Meta size
                    <input type="range" min={10} max={24} value={cfg.theme.textSize?.meta ?? 12} onChange={(e)=> update("theme", { ...cfg.theme, textSize: { ...(cfg.theme.textSize ?? { title:16, artist:14, album:12, meta:12 }), meta: +e.target.value }})} className="w-full" />
                  </label>
                </div>
              </details>

              <details className="mt-3 bg-neutral-900/30 border border-white/10 rounded-lg">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Text styles</summary>
                <div className="px-3 pb-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                    {(["title", "artist", "album", "meta"] as const).map((k) => (
                      <div key={k} className="bg-neutral-900/40 border border-white/10 rounded-lg p-3">
                        <div className="mb-2 capitalize text-white/80">{k}</div>
                        <div className="flex flex-wrap gap-3">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={cfg.theme.textStyle?.[k]?.italic ?? false}
                              onChange={(e)=> update("theme", { ...cfg.theme, textStyle: { ...(cfg.theme.textStyle ?? defaultConfig.theme.textStyle!), [k]: { ...(cfg.theme.textStyle?.[k] ?? defaultConfig.theme.textStyle![k]), italic: e.target.checked } } })}
                            />
                            Italic
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={cfg.theme.textStyle?.[k]?.underline ?? false}
                              onChange={(e)=> update("theme", { ...cfg.theme, textStyle: { ...(cfg.theme.textStyle ?? defaultConfig.theme.textStyle!), [k]: { ...(cfg.theme.textStyle?.[k] ?? defaultConfig.theme.textStyle![k]), underline: e.target.checked } } })}
                            />
                            Underline
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={cfg.theme.textStyle?.[k]?.bold ?? (k === 'title')}
                              onChange={(e)=> update("theme", { ...cfg.theme, textStyle: { ...(cfg.theme.textStyle ?? defaultConfig.theme.textStyle!), [k]: { ...(cfg.theme.textStyle?.[k] ?? defaultConfig.theme.textStyle![k]), bold: e.target.checked } } })}
                            />
                            Bold
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={cfg.theme.textStyle?.[k]?.strike ?? false}
                              onChange={(e)=> update("theme", { ...cfg.theme, textStyle: { ...(cfg.theme.textStyle ?? defaultConfig.theme.textStyle!), [k]: { ...(cfg.theme.textStyle?.[k] ?? defaultConfig.theme.textStyle![k]), strike: e.target.checked } } })}
                            />
                            Strikethrough
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </details>

          <details className="mb-4 bg-neutral-900/40 border border-white/10 rounded-lg">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Layout</summary>
            <div className="px-3 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div>
                <label className="block text-sm mb-1">Width</label>
                <input type="range" min={200} max={900} className="w-full" value={cfg.layout.w} onChange={e => update("layout", { ...cfg.layout, w: +e.target.value })}/>
              </div>
              <div>
                <label className="block text-sm mb-1">Height</label>
                <input type="range" min={80} max={400} className="w-full" value={cfg.layout.h} onChange={e => update("layout", { ...cfg.layout, h: +e.target.value })}/>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cfg.layout.showArt} onChange={e => update("layout", { ...cfg.layout, showArt: e.target.checked })}/>
                Show art
              </label>
              <div>
                <label className="block text-sm mb-1">Text align</label>
                <select className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2" value={cfg.layout.align} onChange={e => update("layout", { ...cfg.layout, align: e.target.value as WidgetConfig["layout"]["align"] })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Art size</label>
                <input type="range" min={32} max={240} className="w-full" value={cfg.layout.artSize} onChange={e => update("layout", { ...cfg.layout, artSize: +e.target.value })}/>
              </div>
              <div>
                <label className="block text-sm mb-1">Scroll trigger width</label>
                <input type="range" min={0} max={600} className="w-full" value={cfg.layout.scrollTriggerWidth ?? 180} onChange={e => update("layout", { ...cfg.layout, scrollTriggerWidth: Math.max(0, +e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm mb-1">Text gap</label>
                <input type="range" min={-16} max={16} className="w-full" value={cfg.layout.textGap ?? 2} onChange={e => update("layout", { ...cfg.layout, textGap: +e.target.value })} />
              </div>
              <div className="col-span-2 sm:col-span-6">
                <details className="bg-neutral-900/30 border border-white/10 rounded-lg">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Per-text offsets (X/Y)</summary>
                  <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                    {(["title","artist","album","meta"] as const).map((k) => (
                      <div key={k} className="bg-neutral-900/40 border border-white/10 rounded-lg p-3">
                        <div className="mb-2 capitalize text-white/80">{k}</div>
                        <label className="block mb-2">X offset
                          <input type="range" min={-100} max={100} className="w-full" value={cfg.layout.textOffset?.[k]?.x ?? 0} onChange={(e)=> update("layout", { ...cfg.layout, textOffset: { ...(cfg.layout.textOffset ?? { title:{x:0,y:0}, artist:{x:0,y:0}, album:{x:0,y:0}, meta:{x:0,y:0} }), [k]: { ...(cfg.layout.textOffset?.[k] ?? {x:0,y:0}), x: +e.target.value } } })} />
                        </label>
                        <label className="block">Y offset
                          <input type="range" min={-100} max={100} className="w-full" value={cfg.layout.textOffset?.[k]?.y ?? 0} onChange={(e)=> update("layout", { ...cfg.layout, textOffset: { ...(cfg.layout.textOffset ?? { title:{x:0,y:0}, artist:{x:0,y:0}, album:{x:0,y:0}, meta:{x:0,y:0} }), [k]: { ...(cfg.layout.textOffset?.[k] ?? {x:0,y:0}), y: +e.target.value } } })} />
                        </label>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </details>

          <details className="mb-4 bg-neutral-900/40 border border-white/10 rounded-lg">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Marquee</summary>
            <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="block">Speed (px/s)
                <input
                  type="range"
                  min={4}
                  max={120}
                  value={cfg.marquee?.speedPxPerSec ?? 24}
                  onChange={(e) => setCfg({ ...cfg, marquee: { ...(cfg.marquee ?? { speedPxPerSec: 24, gapPx: 32 }), speedPxPerSec: +e.target.value } })}
                  className="w-full"
                />
              </label>
              <label className="block">Gap (px)
                <input
                  type="range"
                  min={8}
                  max={128}
                  value={cfg.marquee?.gapPx ?? 32}
                  onChange={(e) => setCfg({ ...cfg, marquee: { ...(cfg.marquee ?? { speedPxPerSec: 24, gapPx: 32 }), gapPx: +e.target.value } })}
                  className="w-full"
                />
              </label>
              <div className="sm:col-span-2">
                <details className="bg-neutral-900/30 border border-white/10 rounded-lg">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Per-text overrides</summary>
                  <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(["title","artist","album"] as const).map((k) => (
                      <div key={k} className="bg-neutral-900/40 border border-white/10 rounded-lg p-3">
                        <div className="mb-2 capitalize text-white/80">{k}</div>
                        <label className="block mb-2">Speed (px/s)
                          <input type="range" min={4} max={120} className="w-full" value={cfg.marquee?.perText?.[k]?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} onChange={(e)=> setCfg({ ...cfg, marquee: { ...(cfg.marquee ?? { speedPxPerSec: 24, gapPx: 32 }), perText: { ...(cfg.marquee?.perText ?? {}), [k]: { ...(cfg.marquee?.perText?.[k] ?? {}), speedPxPerSec: +e.target.value } } } })} />
                        </label>
                        <label className="block">Gap (px)
                          <input type="range" min={8} max={128} className="w-full" value={cfg.marquee?.perText?.[k]?.gapPx ?? cfg.marquee?.gapPx ?? 32} onChange={(e)=> setCfg({ ...cfg, marquee: { ...(cfg.marquee ?? { speedPxPerSec: 24, gapPx: 32 }), perText: { ...(cfg.marquee?.perText ?? {}), [k]: { ...(cfg.marquee?.perText?.[k] ?? {}), gapPx: +e.target.value } } } })} />
                        </label>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </details>

          <details className="mb-8 bg-neutral-900/40 border border-white/10 rounded-lg">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-white/80">Fields</summary>
            <div className="px-3 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
              {(["title","artist","album","progress","duration"] as const).map(f => (
                <label key={f} className="flex items-center gap-2">
                  <input type="checkbox" checked={cfg.fields[f]} onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, [f]: e.target.checked } })} />
                  {f}
                </label>
              ))}
              <div>
                <label className="block text-sm mb-1">History count</label>
                <input type="number" min={1} max={50} className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2" value={cfg.fields.history} onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, history: +e.target.value } })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm mb-1">When paused / not playing</label>
                <select className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2" value={cfg.fields.pausedMode ?? "label"} onChange={(e)=> setCfg({ ...cfg, fields: { ...cfg.fields, pausedMode: (e.target.value as "label" | "transparent") } })}>
                  <option value="label">Show card with label</option>
                  <option value="transparent">Hide card (transparent)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm mb-1">Paused text (when no album art)</label>
                <input
                  type="text"
                  className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
                  value={cfg.fields.pausedText || "Paused"}
                  onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, pausedText: e.target.value } })}
                  placeholder="Paused"
                />
              </div>
            </div>
          </details>
        </div>
      </main>
    </>
  );
}

function WidgetPreview(props: {
  cfg: WidgetConfig;
  isLive: boolean;
  percent: number;
  trackTitle?: string; artist?: string; album?: string; art?: string;
}) {
  const { cfg, isLive, percent, trackTitle, artist, album, art } = props;
  // Keep a stable art src (last non-empty); use a safe fallback on errors
  const [artSrc, setArtSrc] = useState<string>(art || "");
  useEffect(() => {
  setArtSrc((art || "").trim());
  }, [art]);
  // Build a robust, display-ready image URL via Blob to avoid loader/CORS quirks
  const [imgUrl, setImgUrl] = useState<string>("");
  useEffect(() => {
    let active = true;
    let currentObjUrl: string | null = null;
    async function load() {
      if (!artSrc) {
        setImgUrl("");
        return;
      }
      const tryMakeUrl = async (url: string): Promise<string | null> => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          return URL.createObjectURL(blob);
        } catch {
          return null;
        }
      };
      const proxied = `/api/proxy-image?url=${encodeURIComponent(artSrc)}`;
      const viaProxy = await tryMakeUrl(proxied);
      const viaDirect = viaProxy ? null : await tryMakeUrl(artSrc);
      const finalUrl = viaProxy || viaDirect || "";
      if (!active) return;
      if (currentObjUrl) URL.revokeObjectURL(currentObjUrl);
      currentObjUrl = finalUrl || null;
      setImgUrl(finalUrl);
    }
    load();
    return () => {
      active = false;
      if (currentObjUrl) URL.revokeObjectURL(currentObjUrl);
    };
  }, [artSrc]);
  const showImage = cfg.layout.showArt && !!imgUrl;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const grid = useMemo(() => {
    // Place art relative to text alignment: center => art above, left => art left, right => art right
    if (!showImage) return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "auto" } as const;
    if (cfg.layout.align === "center") return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "auto 1fr", justifyItems: "center" } as const;
    if (cfg.layout.align === "right") return { display: "grid", gridTemplateColumns: `1fr auto`, gridTemplateRows: "auto", alignItems: "center" } as const;
    return { display: "grid", gridTemplateColumns: `auto 1fr`, gridTemplateRows: "auto", alignItems: "center" } as const;
  }, [showImage, cfg.layout.align]);

  const textAlign = cfg.layout.align;
  const fontFamily = cfg.theme.font ? `'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system` : undefined;

  // Compute runtime colors when auto-from-art is enabled (prefer the blob imgUrl when present)
  const [computedText, setComputedText] = useState(cfg.theme.text);
  const [computedAccent, setComputedAccent] = useState(cfg.theme.accent);

  // Track last successful extraction to prevent unnecessary updates
  const [lastExtractedColor, setLastExtractedColor] = useState<string | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string>("");
  // Extract dominant color directly from the displayed <img> when it loads for maximum reliability
  const extractFromImgEl = useMemo(() => {
    return () => {
      if (!cfg.theme.autoFromArt) return;
      const el = imgRef.current;
      if (!el) return;
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(el, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const counts = new Map<string, number>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if (a < 200) continue;
          const key = `${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        let max = 0; let best = '255,255,255';
        for (const [k,v] of counts) { if (v > max) { max = v; best = k; } }
        const [r,g,b] = best.split(',').map(Number);
    const toHex = (n:number)=> n.toString(16).padStart(2,'0');
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    const textColor = (cfg.theme.bgEnabled ?? true)
      ? getReadableTextOn(cfg.theme.bg)
      : "#ffffff";
  setComputedText({ title: textColor, artist: textColor, album: textColor, meta: textColor });
    setComputedAccent(hex || (cfg.fallbackAccent || cfg.theme.accent));
      } catch { /* ignore */ }
    };
  }, [cfg.theme.autoFromArt, cfg.theme.bg, cfg.theme.bgEnabled, cfg.fallbackAccent, cfg.theme.accent]);
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!cfg.theme.autoFromArt) {
        const newText = cfg.theme.text;
        const newAccent = cfg.theme.accent;
        // Only update if actually different to prevent flicker
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);
        // Reset tracking when auto-from-art is disabled
        setLastExtractedColor(null);
        setLastImageUrl("");
        return;
      }

      const source = imgUrl || artSrc;

      if (!source) {
        // No image available: use white text and fallback accent
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff" };
        const newAccent = cfg.fallbackAccent || cfg.theme.accent;
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);
        setLastExtractedColor(null);
        setLastImageUrl("");
        return;
      }

      // Skip extraction if the image URL hasn't changed and we have a successful extraction
      if (source === lastImageUrl && lastExtractedColor) {
        // Image is the same and we have a valid color - no need to re-extract
        return;
      }

      // Perform extraction in the background
      const color = await extractDominantColor(source);
      if (cancelled) return;

      if (color) {
        // Successful extraction: update colors and tracking
        const textColor = (cfg.theme.bgEnabled ?? true)
          ? getReadableTextOn(cfg.theme.bg)
          : "#ffffff";
        const newText = { title: textColor, artist: textColor, album: textColor, meta: textColor };
        const newAccent = color;

        // Only update if colors actually changed
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);

        // Update tracking state
        setLastExtractedColor(color);
        setLastImageUrl(source);
      } else if (source !== lastImageUrl) {
        // Extraction failed for a NEW image: use fallback only if image URL changed
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff" };
        const newAccent = cfg.fallbackAccent || cfg.theme.accent;
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);
        setLastExtractedColor(null);
        setLastImageUrl(source);
      }
      // If extraction failed but image URL is the same, keep current colors (don't flicker to fallback)
    };

    run();
    return () => { cancelled = true; };
  }, [cfg.theme.autoFromArt, cfg.theme.text, imgUrl, artSrc, cfg.theme.accent, cfg.fallbackAccent, cfg.theme.bg, cfg.theme.bgEnabled, lastExtractedColor, lastImageUrl]);

  return (
    <div
      className="rounded-2xl p-4 gap-3 items-center"
      style={{
  background: (!isLive && (cfg.fields.pausedMode ?? "label") === "transparent") ? "transparent" : ((cfg.theme.bgEnabled ?? true) ? cfg.theme.bg : "transparent"),
        width: cfg.layout.w, height: cfg.layout.h,
        ...grid,
        fontFamily,
  // No drop shadow when background is disabled
  color: ((!isLive && (cfg.fields.pausedMode ?? "label") === "transparent") || !(cfg.theme.bgEnabled ?? true)) ? "#ffffff" : undefined,
        opacity: (!isLive && (cfg.fields.pausedMode ?? "label") === "transparent") ? 0 : 1,
      }}
    >
      {/* Render order based on alignment: right => text then art; left/center => art then text */}
      {textAlign === 'right' ? (
        <>
          <div className={{ left: "text-left", center: "text-center", right: "text-right" }[textAlign]} style={{ minWidth: 0 }}>
          {cfg.fields.title && <ScrollText className={cfg.theme.textStyle?.title?.bold ? "font-semibold" : undefined} style={{ fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}` }} color={cfg.theme.autoFromArt ? (cfg.theme.text.title === 'accent' ? computedAccent : (computedText.title as string)) : (cfg.theme.text.title === 'accent' ? computedAccent : (cfg.theme.text.title as string))} text={trackTitle ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
          {cfg.fields.artist && <ScrollText style={{ opacity: .95, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400) }} color={cfg.theme.autoFromArt ? (cfg.theme.text.artist === 'accent' ? computedAccent : (computedText.artist as string)) : (cfg.theme.text.artist === 'accent' ? computedAccent : (cfg.theme.text.artist as string))} text={artist ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
          {cfg.fields.album && <ScrollText style={{ fontSize: cfg.theme.textSize?.album ?? 12, opacity: .85, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400) }} color={cfg.theme.autoFromArt ? (cfg.theme.text.album === 'accent' ? computedAccent : (computedText.album as string)) : (cfg.theme.text.album === 'accent' ? computedAccent : (cfg.theme.text.album as string))} text={album ?? ""} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
            {cfg.fields.progress && (
              <div className="mt-2 h-1.5 rounded overflow-hidden" style={{ background: "#ffffff30" }}>
        <div className="h-full" style={{ width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
              </div>
            )}
          </div>
      {cfg.layout.showArt && imgUrl && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={imgUrl}
                alt=""
                style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: 12, justifySelf: 'end' }}
                onLoad={extractFromImgEl}
              />
              {!isLive && cfg.fields.pausedMode === "label" && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 24, height: 24,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '2px'
                }}>
                  <div style={{ width: '3px', height: '8px', backgroundColor: 'white', borderRadius: '1px' }} />
                  <div style={{ width: '3px', height: '8px', backgroundColor: 'white', borderRadius: '1px' }} />
                </div>
              )}
            </div>
          )}
          {!cfg.layout.showArt && !isLive && cfg.fields.pausedMode === "label" && (
            <div style={{
              fontSize: cfg.theme.textSize?.meta ?? 12,
              opacity: .8,
              color: computedText.meta,
              textAlign: 'right'
            }}>
              {cfg.fields.pausedText || "Paused"}
            </div>
          )}
        </>
      ) : (
        <>
      {cfg.layout.showArt && imgUrl && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={imgUrl}
                alt=""
                style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: 12, justifySelf: textAlign === 'center' ? 'center' : 'start' }}
                onLoad={extractFromImgEl}
              />
              {!isLive && cfg.fields.pausedMode === "label" && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 24, height: 24,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '2px'
                }}>
                  <div style={{ width: '3px', height: '8px', backgroundColor: 'white', borderRadius: '1px' }} />
                  <div style={{ width: '3px', height: '8px', backgroundColor: 'white', borderRadius: '1px' }} />
                </div>
              )}
            </div>
          )}
    <div className={{ left: "text-left", center: "text-center", right: "text-right" }[textAlign]} style={{ minWidth: 0 }}>
  {cfg.fields.title && <ScrollText className={cfg.theme.textStyle?.title?.bold ? "font-semibold" : undefined} style={{ fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}` }} color={cfg.theme.autoFromArt ? (cfg.theme.text.title === 'accent' ? computedAccent : (computedText.title as string)) : (cfg.theme.text.title === 'accent' ? computedAccent : (cfg.theme.text.title as string))} text={trackTitle ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
  {cfg.fields.artist && <ScrollText style={{ opacity: .95, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400) }} color={cfg.theme.autoFromArt ? (cfg.theme.text.artist === 'accent' ? computedAccent : (computedText.artist as string)) : (cfg.theme.text.artist === 'accent' ? computedAccent : (cfg.theme.text.artist as string))} text={artist ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
  {cfg.fields.album && <ScrollText style={{ fontSize: cfg.theme.textSize?.album ?? 12, opacity: .85, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400) }} color={cfg.theme.autoFromArt ? (cfg.theme.text.album === 'accent' ? computedAccent : (computedText.album as string)) : (cfg.theme.text.album === 'accent' ? computedAccent : (cfg.theme.text.album as string))} text={album ?? ""} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
            {cfg.fields.progress && (
              <div className="mt-2 h-1.5 rounded overflow-hidden" style={{ background: "#ffffff30" }}>
        <div className="h-full" style={{ width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
              </div>
            )}
          </div>
          {!cfg.layout.showArt && !isLive && cfg.fields.pausedMode === "label" && (
            <div style={{
              fontSize: cfg.theme.textSize?.meta ?? 12,
              opacity: .8,
              color: computedText.meta,
              textAlign: textAlign
            }}>
              {cfg.fields.pausedText || "Paused"}
            </div>
          )}
        </>
      )}
      <Analytics />
    </div>
  );
}
