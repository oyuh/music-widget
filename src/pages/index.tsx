// src/pages/index.tsx
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import LastfmConnect from "../components/LastfmConnect";
import { WidgetConfig, defaultConfig, encodeConfig, formatDurationText } from "../utils/config";
import { useNowPlaying } from "../hooks/useNowPlaying";
import ScrollText from "../components/ScrollText";
import { extractDominantColor, getReadableTextOn, generateDropShadowCSS } from "../utils/colors";
import { KEYWORDS_META } from "../utils/keywords";
import { Analytics } from "@vercel/analytics/next";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Label } from "../components/ui/label";

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
  const { track, isLive, percent, progressMs, durationMs } = useNowPlaying({
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
          const newText = { title: textColor, artist: textColor, album: textColor, meta: textColor, duration: textColor };
          const newAccent = color;
          // Only update if colors actually changed - use functional updates to access current values
          setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
          setComputedAccent(prev => prev !== newAccent ? newAccent : prev);

          // If we got a successful extraction, stop retrying
          return;
        } else {
          // Extraction failed: reset to a safe white text and default accent
          const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff", duration: "#ffffff" };
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
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff", duration: "#ffffff" };
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
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Fast Music (via Last.fm) Stream Widget</h1>
            <a
              href="https://github.com/oyuh/applem-util"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white/80"
            >
              Source
            </a>
            <a
              href="https://buymeacoffee.com/lawsonhart"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white/80"
            >
              Support
            </a>
          </div>

          {/* Main Layout: Split into preview on left, controls on right */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column: Preview and Share */}
            <div>
              <Card className="bg-neutral-900/40 border-white/10 mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Live Preview</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRefreshKey((k) => k + 1)}
                      className="border-white/10 bg-neutral-700 hover:bg-neutral-600 text-white"
                    >
                      ↻ Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <WidgetPreview
                      key={refreshKey}
                      cfg={cfg}
                      isLive={isLive}
                      percent={percent}
                      progressMs={progressMs}
                      durationMs={durationMs}
                      trackTitle={track?.name}
                      artist={track?.artist?.["#text"]}
                      album={track?.album?.["#text"]}
                      art={artUrl}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Connection */}
              <Card className="bg-neutral-900/40 border-white/10 mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <LastfmConnect />
                    {sessionKey ? (
                      <span className="text-green-400">Connected as <b>{connectedName}</b></span>
                    ) : (
                      <span className="text-white/60">Not connected</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-white/80">Last.fm Username</Label>
                    <input
                      id="username"
                      className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-white"
                      value={cfg.lfmUser}
                      onChange={(e) => update("lfmUser", e.target.value)}
                      placeholder="your-lastfm-username"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Share */}
              {mounted && (
                <Card className="bg-neutral-900/40 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Your Widget Link</CardTitle>
                    <CardDescription className="text-white/70">
                      Copy this link to use as a Browser Source in OBS
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        readOnly
                        className="flex-1 min-w-0 rounded bg-neutral-800 border border-white/10 px-3 py-2 text-white"
                        value={share}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-neutral-700 hover:bg-neutral-600 text-white"
                        onClick={async () => { try { await navigator.clipboard.writeText(share); } catch {} }}
                      >
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-neutral-700 hover:bg-neutral-600 text-white"
                        asChild
                      >
                        <a href={share} target="_blank" rel="noreferrer noopener">
                          Open
                        </a>
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm text-white/70">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-neutral-800 hover:bg-neutral-700 text-white h-8 px-3"
                        asChild
                      >
                        <a href={editorImportUrl} target="_blank" rel="noreferrer noopener">
                          Open in Editor
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-neutral-800 hover:bg-neutral-700 text-white h-8 px-3"
                        onClick={copySettings}
                      >
                        Copy Settings
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-neutral-800 hover:bg-neutral-700 text-white h-8 px-3"
                        onClick={pasteSettings}
                      >
                        Paste Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Configuration Tabs */}
            <div>
              <Tabs defaultValue="theme" className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-neutral-900/40 border border-white/10">
                  <TabsTrigger value="theme" className="data-[state=active]:bg-neutral-700 text-white/80 data-[state=active]:text-white">Theme</TabsTrigger>
                  <TabsTrigger value="layout" className="data-[state=active]:bg-neutral-700 text-white/80 data-[state=active]:text-white">Layout</TabsTrigger>
                  <TabsTrigger value="text" className="data-[state=active]:bg-neutral-700 text-white/80 data-[state=active]:text-white">Text</TabsTrigger>
                  <TabsTrigger value="shadows" className="data-[state=active]:bg-neutral-700 text-white/80 data-[state=active]:text-white">Shadows</TabsTrigger>
                  <TabsTrigger value="behavior" className="data-[state=active]:bg-neutral-700 text-white/80 data-[state=active]:text-white">Behavior</TabsTrigger>
                </TabsList>

                {/* Theme Tab */}
                <TabsContent value="theme" className="mt-6">
                  <Card className="bg-neutral-900/40 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white">Colors & Themes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Basic Colors */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white/80">Background Color</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="w-12 h-10 rounded bg-neutral-800 border border-white/10"
                              value={cfg.theme.bg}
                              onChange={(e) => update("theme", { ...cfg.theme, bg: e.target.value })}
                            />
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="show-bg"
                                checked={cfg.theme.bgEnabled ?? true}
                                onChange={(e) => update("theme", { ...cfg.theme, bgEnabled: e.target.checked })}
                                className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <Label htmlFor="show-bg" className="text-white/80">Show Background</Label>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-white/80">Accent Color</Label>
                          <input
                            type="color"
                            className="w-12 h-10 rounded bg-neutral-800 border border-white/10"
                            value={cfg.theme.autoFromArt ? computedAccent : cfg.theme.accent}
                            disabled={cfg.theme.autoFromArt}
                            onChange={(e) => update("theme", { ...cfg.theme, accent: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Auto from Art */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="auto-theme"
                            checked={cfg.theme.autoFromArt}
                            onChange={(e) => update("theme", { ...cfg.theme, autoFromArt: e.target.checked })}
                            className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                          />
                          <Label htmlFor="auto-theme" className="text-white/80">Auto theme from album art</Label>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-white/80">Fallback Accent (when album art unavailable)</Label>
                          <input
                            type="color"
                            className="w-12 h-10 rounded bg-neutral-800 border border-white/10"
                            value={cfg.fallbackAccent || cfg.theme.accent}
                            onChange={(e) => setCfg({ ...cfg, fallbackAccent: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Individual Text Colors */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium">Individual Text Colors</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {(["title", "artist", "album", "meta", "duration"] as const).map((k) => (
                            <div key={k} className="space-y-2">
                              <Label className="text-white/80 capitalize">{k} Color</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  className="w-10 h-10 rounded bg-neutral-800 border border-white/10"
                                  disabled={isAccent(k)}
                                  value={isAccent(k) ? (cfg.theme.autoFromArt ? computedAccent : cfg.theme.accent) : (cfg.theme.autoFromArt ? (computedText[k] as string) : (cfg.theme.text[k] as string))}
                                  onChange={(e) => update("theme", { ...cfg.theme, text: { ...cfg.theme.text, [k]: e.target.value } })}
                                />
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`accent-${k}`}
                                    checked={isAccent(k)}
                                    onChange={(e) => toggleAccentFor(k, e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                  />
                                  <Label htmlFor={`accent-${k}`} className="text-white/80 text-sm">Use accent</Label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Layout Tab */}
                <TabsContent value="layout" className="mt-6">
                  <Card className="bg-neutral-900/40 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white">Layout & Positioning</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Basic Layout */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white/80">Width ({cfg.layout.w}px)</Label>
                          <div className="px-2">
                            <input
                              type="range"
                              min={200}
                              max={900}
                              step={10}
                              value={cfg.layout.w}
                              onChange={(e) => update("layout", { ...cfg.layout, w: +e.target.value })}
                              className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Height ({cfg.layout.h}px)</Label>
                          <div className="px-2">
                            <input
                              type="range"
                              min={80}
                              max={400}
                              step={10}
                              value={cfg.layout.h}
                              onChange={(e) => update("layout", { ...cfg.layout, h: +e.target.value })}
                              className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Background Corner Radius */}
                      <div className="space-y-2">
                        <Label className="text-white/80">Background Corner Radius ({cfg.layout.backgroundRadius ?? 16}px)</Label>
                        <div className="px-2">
                          <input
                            type="range"
                            min={0}
                            max={50}
                            step={1}
                            value={cfg.layout.backgroundRadius ?? 16}
                            onChange={(e) => update("layout", { ...cfg.layout, backgroundRadius: +e.target.value })}
                            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                          />
                        </div>
                      </div>

                      {/* Album Art */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-art"
                            checked={cfg.layout.showArt}
                            onChange={(e) => update("layout", { ...cfg.layout, showArt: e.target.checked })}
                            className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                          />
                          <Label htmlFor="show-art" className="text-white/80">Show album art</Label>
                        </div>

                        {cfg.layout.showArt && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-white/80">Art Size ({cfg.layout.artSize}px)</Label>
                              <div className="px-2">
                                <input
                                  type="range"
                                  min={32}
                                  max={240}
                                  step={4}
                                  value={cfg.layout.artSize}
                                  onChange={(e) => update("layout", { ...cfg.layout, artSize: +e.target.value })}
                                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-white/80">Album Art Corner Radius ({cfg.layout.artRadius ?? 12}px)</Label>
                              <div className="px-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={50}
                                  step={1}
                                  value={cfg.layout.artRadius ?? 12}
                                  onChange={(e) => update("layout", { ...cfg.layout, artRadius: +e.target.value })}
                                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Text Alignment */}
                      <div className="space-y-2">
                        <Label className="text-white/80">Text Alignment</Label>
                        <div className="flex gap-2">
                          {["left", "center", "right"].map((align) => (
                            <Button
                              key={align}
                              variant={cfg.layout.align === align ? "default" : "outline"}
                              size="sm"
                              className={cfg.layout.align === align
                                ? "bg-neutral-700 text-white"
                                : "border-white/10 bg-transparent hover:bg-neutral-700 text-white/80"
                              }
                              onClick={() => update("layout", {
                                ...cfg.layout,
                                align: align as WidgetConfig["layout"]["align"],
                                artPosition: align === "center" ? "top" : align as WidgetConfig["layout"]["artPosition"]
                              })}
                            >
                              {align.charAt(0).toUpperCase() + align.slice(1)}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Spacing */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white/80">Text Gap ({cfg.layout.textGap ?? 2}px)</Label>
                          <div className="px-2">
                            <input
                              type="range"
                              min={-16}
                              max={16}
                              step={1}
                              value={cfg.layout.textGap ?? 2}
                              onChange={(e) => update("layout", { ...cfg.layout, textGap: +e.target.value })}
                              className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Scroll Trigger Width ({cfg.layout.scrollTriggerWidth ?? 180}px)</Label>
                          <div className="px-2">
                            <input
                              type="range"
                              min={0}
                              max={600}
                              step={10}
                              value={cfg.layout.scrollTriggerWidth ?? 180}
                              onChange={(e) => update("layout", { ...cfg.layout, scrollTriggerWidth: Math.max(0, +e.target.value) })}
                              className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Text Offsets - RESTORED */}
                      <Card className="bg-neutral-900/30 border-white/10">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-white text-sm">Per-text Position Offsets</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(["title","artist","album","meta","duration"] as const).map((k) => (
                              <Card key={k} className="bg-neutral-900/40 border-white/10">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-white capitalize text-xs">{k}</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-3">
                                  <div className="space-y-1">
                                    <Label className="text-white/70 text-xs">X Offset ({cfg.layout.textOffset?.[k]?.x ?? 0}px)</Label>
                                    <div className="px-1">
                                      <input
                                        type="range"
                                        min={-100}
                                        max={100}
                                        step={1}
                                        value={cfg.layout.textOffset?.[k]?.x ?? 0}
                                        onChange={(e) => update("layout", {
                                          ...cfg.layout,
                                          textOffset: {
                                            ...(cfg.layout.textOffset ?? { title:{x:0,y:0}, artist:{x:0,y:0}, album:{x:0,y:0}, meta:{x:0,y:0}, duration:{x:0,y:0} }),
                                            [k]: {
                                              ...(cfg.layout.textOffset?.[k] ?? {x:0,y:0}),
                                              x: +e.target.value
                                            }
                                          }
                                        })}
                                        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-white/70 text-xs">Y Offset ({cfg.layout.textOffset?.[k]?.y ?? 0}px)</Label>
                                    <div className="px-1">
                                      <input
                                        type="range"
                                        min={-100}
                                        max={100}
                                        step={1}
                                        value={cfg.layout.textOffset?.[k]?.y ?? 0}
                                        onChange={(e) => update("layout", {
                                          ...cfg.layout,
                                          textOffset: {
                                            ...(cfg.layout.textOffset ?? { title:{x:0,y:0}, artist:{x:0,y:0}, album:{x:0,y:0}, meta:{x:0,y:0}, duration:{x:0,y:0} }),
                                            [k]: {
                                              ...(cfg.layout.textOffset?.[k] ?? {x:0,y:0}),
                                              y: +e.target.value
                                            }
                                          }
                                        })}
                                        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb-sm"
                                      />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Text Tab */}
                <TabsContent value="text" className="mt-6">
                  <Card className="bg-neutral-900/40 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white">Typography</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Font Family */}
                      <div className="space-y-2">
                        <Label className="text-white/80">Font Family</Label>
                        <select
                          className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-white"
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

                      {/* Text Sizes */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium">Text Sizes</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {(["title", "artist", "album", "meta", "duration"] as const).map((k) => (
                            <div key={k} className="space-y-2">
                              <Label className="text-white/80 capitalize">
                                {k} Size ({cfg.theme.textSize?.[k] ?? (k === "title" ? 16 : k === "artist" ? 14 : 12)}px)
                              </Label>
                              <div className="px-2">
                                <input
                                  type="range"
                                  min={10}
                                  max={k === "title" ? 48 : k === "artist" ? 40 : k === "album" ? 32 : 24}
                                  step={1}
                                  value={cfg.theme.textSize?.[k] ?? (k === "title" ? 16 : k === "artist" ? 14 : 12)}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    textSize: {
                                      ...(cfg.theme.textSize ?? { title:16, artist:14, album:12, meta:12, duration:12 }),
                                      [k]: +e.target.value
                                    }
                                  })}
                                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Text Styles */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium">Text Styles</h4>
                        <div className="grid grid-cols-1 gap-4">
                          {(["title", "artist", "album", "meta", "duration"] as const).map((k) => (
                            <Card key={k} className="bg-neutral-900/30 border-white/10">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-white capitalize text-sm">{k}</CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="flex flex-wrap gap-4">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`${k}-bold`}
                                      checked={cfg.theme.textStyle?.[k]?.bold ?? (k === 'title')}
                                      onChange={(e) => update("theme", {
                                        ...cfg.theme,
                                        textStyle: {
                                          ...(cfg.theme.textStyle ?? defaultConfig.theme.textStyle!),
                                          [k]: {
                                            ...(cfg.theme.textStyle?.[k] ?? defaultConfig.theme.textStyle![k]),
                                            bold: e.target.checked
                                          }
                                        }
                                      })}
                                      className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <Label htmlFor={`${k}-bold`} className="text-white/80 text-sm">Bold</Label>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`${k}-italic`}
                                      checked={cfg.theme.textStyle?.[k]?.italic ?? false}
                                      onChange={(e) => update("theme", {
                                        ...cfg.theme,
                                        textStyle: {
                                          ...(cfg.theme.textStyle ?? defaultConfig.theme.textStyle!),
                                          [k]: {
                                            ...(cfg.theme.textStyle?.[k] ?? defaultConfig.theme.textStyle![k]),
                                            italic: e.target.checked
                                          }
                                        }
                                      })}
                                      className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <Label htmlFor={`${k}-italic`} className="text-white/80 text-sm">Italic</Label>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`${k}-underline`}
                                      checked={cfg.theme.textStyle?.[k]?.underline ?? false}
                                      onChange={(e) => update("theme", {
                                        ...cfg.theme,
                                        textStyle: {
                                          ...(cfg.theme.textStyle ?? defaultConfig.theme.textStyle!),
                                          [k]: {
                                            ...(cfg.theme.textStyle?.[k] ?? defaultConfig.theme.textStyle![k]),
                                            underline: e.target.checked
                                          }
                                        }
                                      })}
                                      className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <Label htmlFor={`${k}-underline`} className="text-white/80 text-sm">Underline</Label>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`${k}-strike`}
                                      checked={cfg.theme.textStyle?.[k]?.strike ?? false}
                                      onChange={(e) => update("theme", {
                                        ...cfg.theme,
                                        textStyle: {
                                          ...(cfg.theme.textStyle ?? defaultConfig.theme.textStyle!),
                                          [k]: {
                                            ...(cfg.theme.textStyle?.[k] ?? defaultConfig.theme.textStyle![k]),
                                            strike: e.target.checked
                                          }
                                        }
                                      })}
                                      className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <Label htmlFor={`${k}-strike`} className="text-white/80 text-sm">Strikethrough</Label>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Shadows Tab */}
                <TabsContent value="shadows" className="mt-6">
                  <Card className="bg-neutral-900/40 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white">Drop Shadows</CardTitle>
                      <CardDescription className="text-white/70">
                        Add depth and visual interest with customizable drop shadows
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Enable Drop Shadows */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="enable-shadows"
                          checked={cfg.theme.dropShadow?.enabled ?? false}
                          onChange={(e) => update("theme", {
                            ...cfg.theme,
                            dropShadow: {
                              ...(cfg.theme.dropShadow ?? {
                                enabled: false,
                                blur: 4,
                                intensity: 50,
                                offsetX: 2,
                                offsetY: 2,
                                useOppositeColor: true,
                                customColor: "#000000",
                                targets: { text: true, albumArt: true, progressBar: true, background: false }
                              }),
                              enabled: e.target.checked
                            }
                          })}
                          className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <Label htmlFor="enable-shadows" className="text-white/80">Enable Drop Shadows</Label>
                      </div>

                      {(cfg.theme.dropShadow?.enabled) && (
                        <>
                          {/* Shadow Properties */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-white/80">Blur Radius ({cfg.theme.dropShadow?.blur ?? 4}px)</Label>
                              <div className="px-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={20}
                                  step={1}
                                  value={cfg.theme.dropShadow?.blur ?? 4}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      blur: +e.target.value
                                    }
                                  })}
                                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-white/80">Intensity ({cfg.theme.dropShadow?.intensity ?? 50}%)</Label>
                              <div className="px-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={cfg.theme.dropShadow?.intensity ?? 50}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      intensity: +e.target.value
                                    }
                                  })}
                                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-white/80">X Offset ({cfg.theme.dropShadow?.offsetX ?? 2}px)</Label>
                              <div className="px-2">
                                <input
                                  type="range"
                                  min={-20}
                                  max={20}
                                  step={1}
                                  value={cfg.theme.dropShadow?.offsetX ?? 2}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      offsetX: +e.target.value
                                    }
                                  })}
                                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-white/80">Y Offset ({cfg.theme.dropShadow?.offsetY ?? 2}px)</Label>
                              <div className="px-2">
                                <input
                                  type="range"
                                  min={-20}
                                  max={20}
                                  step={1}
                                  value={cfg.theme.dropShadow?.offsetY ?? 2}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      offsetY: +e.target.value
                                    }
                                  })}
                                  className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Shadow Color */}
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="use-opposite-color"
                                checked={cfg.theme.dropShadow?.useOppositeColor ?? true}
                                onChange={(e) => update("theme", {
                                  ...cfg.theme,
                                  dropShadow: {
                                    ...(cfg.theme.dropShadow!),
                                    useOppositeColor: e.target.checked
                                  }
                                })}
                                className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <Label htmlFor="use-opposite-color" className="text-white/80">Use opposite colors automatically</Label>
                            </div>

                            {!(cfg.theme.dropShadow?.useOppositeColor ?? true) && (
                              <div className="space-y-2">
                                <Label className="text-white/80">Custom Shadow Color</Label>
                                <input
                                  type="color"
                                  className="w-12 h-10 rounded bg-neutral-800 border border-white/10"
                                  value={cfg.theme.dropShadow?.customColor ?? "#000000"}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      customColor: e.target.value
                                    }
                                  })}
                                />
                              </div>
                            )}
                          </div>

                          {/* Shadow Targets */}
                          <div className="space-y-4">
                            <h4 className="text-white font-medium">Apply Shadows To</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="shadow-text"
                                  checked={cfg.theme.dropShadow?.targets?.text ?? true}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      targets: {
                                        text: e.target.checked,
                                        albumArt: cfg.theme.dropShadow?.targets?.albumArt ?? true,
                                        progressBar: cfg.theme.dropShadow?.targets?.progressBar ?? true,
                                        background: cfg.theme.dropShadow?.targets?.background ?? false
                                      }
                                    }
                                  })}
                                  className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <Label htmlFor="shadow-text" className="text-white/80">Text Elements</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="shadow-art"
                                  checked={cfg.theme.dropShadow?.targets?.albumArt ?? true}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      targets: {
                                        text: cfg.theme.dropShadow?.targets?.text ?? true,
                                        albumArt: e.target.checked,
                                        progressBar: cfg.theme.dropShadow?.targets?.progressBar ?? true,
                                        background: cfg.theme.dropShadow?.targets?.background ?? false
                                      }
                                    }
                                  })}
                                  className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <Label htmlFor="shadow-art" className="text-white/80">Album Art</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="shadow-progress"
                                  checked={cfg.theme.dropShadow?.targets?.progressBar ?? true}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      targets: {
                                        text: cfg.theme.dropShadow?.targets?.text ?? true,
                                        albumArt: cfg.theme.dropShadow?.targets?.albumArt ?? true,
                                        progressBar: e.target.checked,
                                        background: cfg.theme.dropShadow?.targets?.background ?? false
                                      }
                                    }
                                  })}
                                  className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <Label htmlFor="shadow-progress" className="text-white/80">Progress Bar</Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="shadow-background"
                                  checked={cfg.theme.dropShadow?.targets?.background ?? false}
                                  onChange={(e) => update("theme", {
                                    ...cfg.theme,
                                    dropShadow: {
                                      ...(cfg.theme.dropShadow!),
                                      targets: {
                                        text: cfg.theme.dropShadow?.targets?.text ?? true,
                                        albumArt: cfg.theme.dropShadow?.targets?.albumArt ?? true,
                                        progressBar: cfg.theme.dropShadow?.targets?.progressBar ?? true,
                                        background: e.target.checked
                                      }
                                    }
                                  })}
                                  className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <Label htmlFor="shadow-background" className="text-white/80">Widget Background</Label>
                              </div>
                            </div>
                          </div>

                          {/* Per-Text Drop Shadow Controls */}
                          {(cfg.theme.dropShadow?.targets?.text) && (
                            <div className="space-y-4">
                              <h4 className="text-white font-medium">Per-Text Drop Shadow Settings</h4>
                              <div className="grid grid-cols-1 gap-4">
                                {(["title", "artist", "album", "meta", "duration"] as const).map((k) => (
                                  <Card key={k} className="bg-neutral-900/30 border-white/10">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-white capitalize text-sm">{k} Drop Shadow</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 space-y-4">
                                      {/* Enable for this element */}
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`${k}-shadow-enabled`}
                                          checked={cfg.theme.dropShadow?.perText?.[k]?.enabled ?? true}
                                          onChange={(e) => update("theme", {
                                            ...cfg.theme,
                                            dropShadow: {
                                              ...(cfg.theme.dropShadow!),
                                              perText: {
                                                ...(cfg.theme.dropShadow?.perText ?? {}),
                                                [k]: {
                                                  ...(cfg.theme.dropShadow?.perText?.[k] ?? {}),
                                                  enabled: e.target.checked
                                                }
                                              }
                                            }
                                          })}
                                          className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                        />
                                        <Label htmlFor={`${k}-shadow-enabled`} className="text-white/80 text-sm">Enable {k} shadow</Label>
                                      </div>

                                      {(cfg.theme.dropShadow?.perText?.[k]?.enabled ?? true) && (
                                        <>
                                          {/* Use opposite color */}
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="checkbox"
                                              id={`${k}-shadow-opposite`}
                                              checked={cfg.theme.dropShadow?.perText?.[k]?.useOppositeColor ?? cfg.theme.dropShadow?.useOppositeColor ?? true}
                                              onChange={(e) => update("theme", {
                                                ...cfg.theme,
                                                dropShadow: {
                                                  ...(cfg.theme.dropShadow!),
                                                  perText: {
                                                    ...(cfg.theme.dropShadow?.perText ?? {}),
                                                    [k]: {
                                                      ...(cfg.theme.dropShadow?.perText?.[k] ?? {}),
                                                      useOppositeColor: e.target.checked
                                                    }
                                                  }
                                                }
                                              })}
                                              className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                                            />
                                            <Label htmlFor={`${k}-shadow-opposite`} className="text-white/80 text-sm">Use opposite color automatically</Label>
                                          </div>

                                          {/* Custom color if not using opposite */}
                                          {!(cfg.theme.dropShadow?.perText?.[k]?.useOppositeColor ?? cfg.theme.dropShadow?.useOppositeColor ?? true) && (
                                            <div className="space-y-2">
                                              <Label className="text-white/80 text-sm">Custom Shadow Color</Label>
                                              <input
                                                type="color"
                                                className="w-12 h-8 rounded bg-neutral-800 border border-white/10"
                                                value={cfg.theme.dropShadow?.perText?.[k]?.customColor ?? cfg.theme.dropShadow?.customColor ?? "#000000"}
                                                onChange={(e) => update("theme", {
                                                  ...cfg.theme,
                                                  dropShadow: {
                                                    ...(cfg.theme.dropShadow!),
                                                    perText: {
                                                      ...(cfg.theme.dropShadow?.perText ?? {}),
                                                      [k]: {
                                                        ...(cfg.theme.dropShadow?.perText?.[k] ?? {}),
                                                        customColor: e.target.value
                                                      }
                                                    }
                                                  }
                                                })}
                                              />
                                            </div>
                                          )}

                                          {/* Individual blur, intensity, offset controls */}
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-white/70 text-xs">Blur ({cfg.theme.dropShadow?.perText?.[k]?.blur ?? cfg.theme.dropShadow?.blur ?? 4}px)</Label>
                                              <div className="px-1">
                                                <input
                                                  type="range"
                                                  min={0}
                                                  max={20}
                                                  step={1}
                                                  value={cfg.theme.dropShadow?.perText?.[k]?.blur ?? cfg.theme.dropShadow?.blur ?? 4}
                                                  onChange={(e) => update("theme", {
                                                    ...cfg.theme,
                                                    dropShadow: {
                                                      ...(cfg.theme.dropShadow!),
                                                      perText: {
                                                        ...(cfg.theme.dropShadow?.perText ?? {}),
                                                        [k]: {
                                                          ...(cfg.theme.dropShadow?.perText?.[k] ?? {}),
                                                          blur: +e.target.value
                                                        }
                                                      }
                                                    }
                                                  })}
                                                  className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb-sm"
                                                />
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <Label className="text-white/70 text-xs">Intensity ({cfg.theme.dropShadow?.perText?.[k]?.intensity ?? cfg.theme.dropShadow?.intensity ?? 50}%)</Label>
                                              <div className="px-1">
                                                <input
                                                  type="range"
                                                  min={0}
                                                  max={100}
                                                  step={5}
                                                  value={cfg.theme.dropShadow?.perText?.[k]?.intensity ?? cfg.theme.dropShadow?.intensity ?? 50}
                                                  onChange={(e) => update("theme", {
                                                    ...cfg.theme,
                                                    dropShadow: {
                                                      ...(cfg.theme.dropShadow!),
                                                      perText: {
                                                        ...(cfg.theme.dropShadow?.perText ?? {}),
                                                        [k]: {
                                                          ...(cfg.theme.dropShadow?.perText?.[k] ?? {}),
                                                          intensity: +e.target.value
                                                        }
                                                      }
                                                    }
                                                  })}
                                                  className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb-sm"
                                                />
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <Label className="text-white/70 text-xs">X Offset ({cfg.theme.dropShadow?.perText?.[k]?.offsetX ?? cfg.theme.dropShadow?.offsetX ?? 2}px)</Label>
                                              <div className="px-1">
                                                <input
                                                  type="range"
                                                  min={-20}
                                                  max={20}
                                                  step={1}
                                                  value={cfg.theme.dropShadow?.perText?.[k]?.offsetX ?? cfg.theme.dropShadow?.offsetX ?? 2}
                                                  onChange={(e) => update("theme", {
                                                    ...cfg.theme,
                                                    dropShadow: {
                                                      ...(cfg.theme.dropShadow!),
                                                      perText: {
                                                        ...(cfg.theme.dropShadow?.perText ?? {}),
                                                        [k]: {
                                                          ...(cfg.theme.dropShadow?.perText?.[k] ?? {}),
                                                          offsetX: +e.target.value
                                                        }
                                                      }
                                                    }
                                                  })}
                                                  className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb-sm"
                                                />
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <Label className="text-white/70 text-xs">Y Offset ({cfg.theme.dropShadow?.perText?.[k]?.offsetY ?? cfg.theme.dropShadow?.offsetY ?? 2}px)</Label>
                                              <div className="px-1">
                                                <input
                                                  type="range"
                                                  min={-20}
                                                  max={20}
                                                  step={1}
                                                  value={cfg.theme.dropShadow?.perText?.[k]?.offsetY ?? cfg.theme.dropShadow?.offsetY ?? 2}
                                                  onChange={(e) => update("theme", {
                                                    ...cfg.theme,
                                                    dropShadow: {
                                                      ...(cfg.theme.dropShadow!),
                                                      perText: {
                                                        ...(cfg.theme.dropShadow?.perText ?? {}),
                                                        [k]: {
                                                          ...(cfg.theme.dropShadow?.perText?.[k] ?? {}),
                                                          offsetY: +e.target.value
                                                        }
                                                      }
                                                    }
                                                  })}
                                                  className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb-sm"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}

                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Behavior Tab */}
                <TabsContent value="behavior" className="mt-6">
                  <Card className="bg-neutral-900/40 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white">Behavior & Features</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Fields */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium">Show Fields</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {(["title","artist","album","progress","duration"] as const).map(f => (
                            <div key={f} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`field-${f}`}
                                checked={cfg.fields[f]}
                                onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, [f]: e.target.checked } })}
                                className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <Label htmlFor={`field-${f}`} className="text-white/80 capitalize">{f}</Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Duration Settings */}
                      {cfg.fields.duration && (
                        <div className="space-y-4">
                          <h4 className="text-white font-medium">Duration Settings</h4>
<p className="text-white/60 text-sm mt-1">
  These aren't accurate due to Last.fm API limitations.
</p>

                          <div className="space-y-2">
                            <Label className="text-white/80">Duration Format</Label>
                            <select
                              className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-white"
                              value={cfg.fields.durationFormat ?? "both"}
                              onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, durationFormat: (e.target.value as "elapsed" | "remaining" | "both") } })}
                            >
                              <option value="elapsed">Elapsed only (2:30)</option>
                              <option value="remaining">Remaining only (-1:25)</option>
                              <option value="both">Both (2:30/3:55)</option>
                            </select>
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="show-duration-on-progress"
                              checked={cfg.fields.showDurationOnProgress ?? true}
                              onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, showDurationOnProgress: e.target.checked } })}
                              className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <Label htmlFor="show-duration-on-progress" className="text-white/80">Show duration on progress bar</Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="show-duration-as-text"
                              checked={cfg.fields.showDurationAsText ?? false}
                              onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, showDurationAsText: e.target.checked } })}
                              className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <Label htmlFor="show-duration-as-text" className="text-white/80">Show duration as separate text</Label>
                          </div>
                        </div>
                      )}

                      {/* Paused Behavior */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium">When Paused / Not Playing</h4>
                        <div className="space-y-2">
                          <Label className="text-white/80">Behavior</Label>
                          <select
                            className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-white"
                            value={cfg.fields.pausedMode ?? "label"}
                            onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, pausedMode: (e.target.value as "label" | "transparent") } })}
                          >
                            <option value="label">Show card with label</option>
                            <option value="transparent">Hide card (transparent)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-white/80">Paused Text (when no album art)</Label>
                          <input
                            type="text"
                            className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-white"
                            value={cfg.fields.pausedText || "Paused"}
                            onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, pausedText: e.target.value } })}
                            placeholder="Paused"
                          />
                        </div>
                      </div>

                      {/* Marquee */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium">Marquee Scrolling</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-white/80">Speed ({cfg.marquee?.speedPxPerSec ?? 24}px/s)</Label>
                            <div className="px-2">
                              <input
                                type="range"
                                min={4}
                                max={120}
                                step={1}
                                value={cfg.marquee?.speedPxPerSec ?? 24}
                                onChange={(e) => setCfg({
                                  ...cfg,
                                  marquee: {
                                    ...(cfg.marquee ?? { speedPxPerSec: 24, gapPx: 32 }),
                                    speedPxPerSec: +e.target.value
                                  }
                                })}
                                className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Gap ({cfg.marquee?.gapPx ?? 32}px)</Label>
                            <div className="px-2">
                              <input
                                type="range"
                                min={8}
                                max={128}
                                step={1}
                                value={cfg.marquee?.gapPx ?? 32}
                                onChange={(e) => setCfg({
                                  ...cfg,
                                  marquee: {
                                    ...(cfg.marquee ?? { speedPxPerSec: 24, gapPx: 32 }),
                                    gapPx: +e.target.value
                                  }
                                })}
                                className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Per-text Marquee Overrides - RESTORED */}
                        <Card className="bg-neutral-900/30 border-white/10">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-white text-sm">Per-text Marquee Overrides</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {(["title","artist","album"] as const).map((k) => (
                                <Card key={k} className="bg-neutral-900/40 border-white/10">
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-white capitalize text-xs">{k}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="pt-0 space-y-3">
                                    <div className="space-y-1">
                                      <Label className="text-white/70 text-xs">Speed ({cfg.marquee?.perText?.[k]?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}px/s)</Label>
                                      <div className="px-1">
                                        <input
                                          type="range"
                                          min={4}
                                          max={120}
                                          step={1}
                                          value={cfg.marquee?.perText?.[k]?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                                          onChange={(e) => setCfg({
                                            ...cfg,
                                            marquee: {
                                              ...(cfg.marquee ?? { speedPxPerSec: 24, gapPx: 32 }),
                                              perText: {
                                                ...(cfg.marquee?.perText ?? {}),
                                                [k]: {
                                                  ...(cfg.marquee?.perText?.[k] ?? {}),
                                                  speedPxPerSec: +e.target.value
                                                }
                                              }
                                            }
                                          })}
                                          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb-sm"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-white/70 text-xs">Gap ({cfg.marquee?.perText?.[k]?.gapPx ?? cfg.marquee?.gapPx ?? 32}px)</Label>
                                      <div className="px-1">
                                        <input
                                          type="range"
                                          min={8}
                                          max={128}
                                          step={1}
                                          value={cfg.marquee?.perText?.[k]?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                                          onChange={(e) => setCfg({
                                            ...cfg,
                                            marquee: {
                                              ...(cfg.marquee ?? { speedPxPerSec: 24, gapPx: 32 }),
                                              perText: {
                                                ...(cfg.marquee?.perText ?? {}),
                                                [k]: {
                                                  ...(cfg.marquee?.perText?.[k] ?? {}),
                                                  gapPx: +e.target.value
                                                }
                                              }
                                            }
                                          })}
                                          className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider-thumb-sm"
                                        />
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* History */}
                      <div className="space-y-2">
                        <Label className="text-white/80">History Count</Label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-white"
                          value={cfg.fields.history}
                          onChange={(e) => setCfg({ ...cfg, fields: { ...cfg.fields, history: +e.target.value } })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Description moved to bottom */}
          <div className="mt-8 text-center text-white/70">
            <p className="leading-relaxed max-w-3xl mx-auto">
              Enter your Last.fm username, customize the card, and copy your unique link to use as a Browser Source in OBS. {" "}
              <a href="https://www.last.fm/about/trackmymusic" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 decoration-white/70 hover:decoration-white text-white">Set up scrobbles before using this app</a>.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

function WidgetPreview(props: {
  cfg: WidgetConfig;
  isLive: boolean;
  percent: number;
  progressMs: number;
  durationMs: number | null;
  trackTitle?: string; artist?: string; album?: string; art?: string;
}) {
  const { cfg, isLive, percent, progressMs, durationMs, trackTitle, artist, album, art } = props;
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
    // Match the widget logic exactly: use artPosition for layout, not align
    const artPos = cfg.layout.artPosition;
    const isTop = showImage && artPos === 'top';
    if (!showImage) return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "auto" } as const;
    if (isTop) return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "auto 1fr", justifyItems: "center" } as const;
    if (artPos === 'right') return { display: "grid", gridTemplateColumns: `1fr auto`, gridTemplateRows: "auto", alignItems: "center" } as const;
    return { display: "grid", gridTemplateColumns: `auto 1fr`, gridTemplateRows: "auto", alignItems: "center" } as const;
  }, [showImage, cfg.layout.artPosition]);

  const fontFamily = cfg.theme.font ? `'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system` : undefined;

  // Compute runtime colors when auto-from-art is enabled (prefer the blob imgUrl when present)
  const [computedText, setComputedText] = useState(cfg.theme.text);
  const [computedAccent, setComputedAccent] = useState(cfg.theme.accent);

  // Track last successful extraction to prevent unnecessary updates
  const [lastExtractedColor, setLastExtractedColor] = useState<string | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string>("");

  // Drop shadow calculations
  const dropShadowConfig = cfg.theme.dropShadow;
  const dropShadows = useMemo(() => {
    if (!dropShadowConfig?.enabled) return {};

    const getTextShadow = (textColor: string) => {
      if (!dropShadowConfig.targets.text) return '';
      return generateDropShadowCSS(dropShadowConfig, textColor);
    };

    const getBoxShadow = (baseColor: string) => {
      return generateDropShadowCSS(dropShadowConfig, baseColor);
    };

    return {
      getTextShadow,
      getBoxShadow,
      backgroundShadow: dropShadowConfig.targets.background ? getBoxShadow(cfg.theme.bg) : '',
      albumArtShadow: dropShadowConfig.targets.albumArt ? getBoxShadow(cfg.theme.bg) : '',
      progressBarShadow: dropShadowConfig.targets.progressBar ? getBoxShadow(computedAccent) : ''
    };
  }, [dropShadowConfig, cfg.theme.bg, computedAccent]);

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
  setComputedText({ title: textColor, artist: textColor, album: textColor, meta: textColor, duration: textColor });
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
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff", duration: "#ffffff" };
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
        const newText = { title: textColor, artist: textColor, album: textColor, meta: textColor, duration: textColor };
        const newAccent = color;

        // Only update if colors actually changed
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);

        // Update tracking state
        setLastExtractedColor(color);
        setLastImageUrl(source);
      } else if (source !== lastImageUrl) {
        // Extraction failed for a NEW image: use fallback only if image URL changed
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff", duration: "#ffffff" };
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
        boxShadow: dropShadows.backgroundShadow || undefined,
        borderRadius: cfg.layout.backgroundRadius ?? 16,
      }}
    >
      {/* Match widget rendering logic exactly */}
      {showImage && cfg.layout.artPosition === 'right' ? (
        <>
          {/* Right layout: Text first, then art */}
          <div className={`${cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'}`} style={{ minWidth: 0 }}>
          {cfg.fields.title && <ScrollText className={cfg.theme.textStyle?.title?.bold ? "font-semibold" : undefined} style={{ fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}`, textShadow: dropShadows?.getTextShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.text ? dropShadows.getTextShadow(cfg.theme.autoFromArt ? (cfg.theme.text.title === 'accent' ? computedAccent : (computedText.title as string)) : (cfg.theme.text.title === 'accent' ? computedAccent : (cfg.theme.text.title as string))) : undefined }} color={cfg.theme.autoFromArt ? (cfg.theme.text.title === 'accent' ? computedAccent : (computedText.title as string)) : (cfg.theme.text.title === 'accent' ? computedAccent : (cfg.theme.text.title as string))} text={trackTitle ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
          {cfg.fields.artist && <ScrollText style={{ opacity: .95, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400), textShadow: dropShadows?.getTextShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.text ? dropShadows.getTextShadow(cfg.theme.autoFromArt ? (cfg.theme.text.artist === 'accent' ? computedAccent : (computedText.artist as string)) : (cfg.theme.text.artist === 'accent' ? computedAccent : (cfg.theme.text.artist as string))) : undefined }} color={cfg.theme.autoFromArt ? (cfg.theme.text.artist === 'accent' ? computedAccent : (computedText.artist as string)) : (cfg.theme.text.artist === 'accent' ? computedAccent : (cfg.theme.text.artist as string))} text={artist ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
          {cfg.fields.album && <ScrollText style={{ fontSize: cfg.theme.textSize?.album ?? 12, opacity: .85, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400), textShadow: dropShadows?.getTextShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.text ? dropShadows.getTextShadow(cfg.theme.autoFromArt ? (cfg.theme.text.album === 'accent' ? computedAccent : (computedText.album as string)) : (cfg.theme.text.album === 'accent' ? computedAccent : (cfg.theme.text.album as string))) : undefined }} color={cfg.theme.autoFromArt ? (cfg.theme.text.album === 'accent' ? computedAccent : (computedText.album as string)) : (cfg.theme.text.album === 'accent' ? computedAccent : (cfg.theme.text.album as string))} text={album ?? ""} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
            {cfg.fields.progress && (
              <div className="mt-2">
                <div className="h-1.5 rounded overflow-hidden" style={{ background: "#ffffff30", boxShadow: dropShadows?.getBoxShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.progressBar ? dropShadows.getBoxShadow("#ffffff30") : undefined }}>
          <div className="h-full" style={{ width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                </div>
                {cfg.fields.duration && cfg.fields.showDurationOnProgress && (
                  <div className={cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'} style={{
                    fontSize: cfg.theme.textSize?.duration ?? 12,
                    fontWeight: (cfg.theme.textStyle?.duration?.bold ? 700 : 400),
                    fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                    textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                    opacity: 0.8,
                    marginTop: 4,
                    transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                    color: cfg.theme.autoFromArt ? (cfg.theme.text.duration === 'accent' ? computedAccent : (computedText.duration as string)) : (cfg.theme.text.duration === 'accent' ? computedAccent : (cfg.theme.text.duration as string))
                  }}>
                    {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                  </div>
                )}
              </div>
            )}
            {cfg.fields.duration && cfg.fields.showDurationAsText && (
              <div className={cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'} style={{
                fontSize: cfg.theme.textSize?.duration ?? 12,
                fontWeight: (cfg.theme.textStyle?.duration?.bold ? 700 : 400),
                fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                opacity: 0.8,
                marginTop: 4,
                transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                color: cfg.theme.autoFromArt ? (cfg.theme.text.duration === 'accent' ? computedAccent : (computedText.duration as string)) : (cfg.theme.text.duration === 'accent' ? computedAccent : (cfg.theme.text.duration as string))
              }}>
                {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
              </div>
            )}
          </div>
      {cfg.layout.showArt && imgUrl && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={imgUrl}
                alt=""
                style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: cfg.layout.artRadius ?? 12, justifySelf: 'end', boxShadow: dropShadows?.getBoxShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.albumArt ? dropShadows.getBoxShadow("#000000") : undefined }}
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
            <div
              className={cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'}
              style={{
              fontSize: cfg.theme.textSize?.meta ?? 12,
              opacity: .8,
              color: computedText.meta
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
                style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: cfg.layout.artRadius ?? 12, justifySelf: cfg.layout.align === 'center' ? 'center' : 'start', boxShadow: dropShadows?.getBoxShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.albumArt ? dropShadows.getBoxShadow("#000000") : undefined }}
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
    <div className={`${cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'}`} style={{ minWidth: 0 }}>
  {cfg.fields.title && <ScrollText className={cfg.theme.textStyle?.title?.bold ? "font-semibold" : undefined} style={{ fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}`, textShadow: dropShadows?.getTextShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.text ? dropShadows.getTextShadow(cfg.theme.autoFromArt ? (cfg.theme.text.title === 'accent' ? computedAccent : (computedText.title as string)) : (cfg.theme.text.title === 'accent' ? computedAccent : (cfg.theme.text.title as string))) : undefined }} color={cfg.theme.autoFromArt ? (cfg.theme.text.title === 'accent' ? computedAccent : (computedText.title as string)) : (cfg.theme.text.title === 'accent' ? computedAccent : (cfg.theme.text.title as string))} text={trackTitle ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
  {cfg.fields.artist && <ScrollText style={{ opacity: .95, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400), textShadow: dropShadows?.getTextShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.text ? dropShadows.getTextShadow(cfg.theme.autoFromArt ? (cfg.theme.text.artist === 'accent' ? computedAccent : (computedText.artist as string)) : (cfg.theme.text.artist === 'accent' ? computedAccent : (cfg.theme.text.artist as string))) : undefined }} color={cfg.theme.autoFromArt ? (cfg.theme.text.artist === 'accent' ? computedAccent : (computedText.artist as string)) : (cfg.theme.text.artist === 'accent' ? computedAccent : (cfg.theme.text.artist as string))} text={artist ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
  {cfg.fields.album && <ScrollText style={{ fontSize: cfg.theme.textSize?.album ?? 12, opacity: .85, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400), textShadow: dropShadows?.getTextShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.text ? dropShadows.getTextShadow(cfg.theme.autoFromArt ? (cfg.theme.text.album === 'accent' ? computedAccent : (computedText.album as string)) : (cfg.theme.text.album === 'accent' ? computedAccent : (cfg.theme.text.album as string))) : undefined }} color={cfg.theme.autoFromArt ? (cfg.theme.text.album === 'accent' ? computedAccent : (computedText.album as string)) : (cfg.theme.text.album === 'accent' ? computedAccent : (cfg.theme.text.album as string))} text={album ?? ""} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
            {cfg.fields.progress && (
              <div className="mt-2">
                <div className="h-1.5 rounded overflow-hidden" style={{ background: "#ffffff30", boxShadow: dropShadows?.getBoxShadow && cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.progressBar ? dropShadows.getBoxShadow("#ffffff30") : undefined }}>
          <div className="h-full" style={{ width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                </div>
                {cfg.fields.duration && cfg.fields.showDurationOnProgress && (
                  <div className={cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'} style={{
                    fontSize: cfg.theme.textSize?.duration ?? 12,
                    fontWeight: (cfg.theme.textStyle?.duration?.bold ? 700 : 400),
                    fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                    textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                    opacity: 0.8,
                    marginTop: 4,
                    transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                    color: cfg.theme.autoFromArt ? (cfg.theme.text.duration === 'accent' ? computedAccent : (computedText.duration as string)) : (cfg.theme.text.duration === 'accent' ? computedAccent : (cfg.theme.text.duration as string))
                  }}>
                    {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                  </div>
                )}
              </div>
            )}
            {cfg.fields.duration && cfg.fields.showDurationAsText && (
              <div className={cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'} style={{
                fontSize: cfg.theme.textSize?.duration ?? 12,
                fontWeight: (cfg.theme.textStyle?.duration?.bold ? 700 : 400),
                fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                opacity: 0.8,
                marginTop: 4,
                transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                color: cfg.theme.autoFromArt ? (cfg.theme.text.duration === 'accent' ? computedAccent : (computedText.duration as string)) : (cfg.theme.text.duration === 'accent' ? computedAccent : (cfg.theme.text.duration as string))
              }}>
                {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
              </div>
            )}
          </div>
          {!cfg.layout.showArt && !isLive && cfg.fields.pausedMode === "label" && (
            <div
              className={cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'}
              style={{
              fontSize: cfg.theme.textSize?.meta ?? 12,
              opacity: .8,
              color: computedText.meta
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
