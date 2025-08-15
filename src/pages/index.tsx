// src/pages/index.tsx
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import LastfmConnect from "../components/LastfmConnect";
import { WidgetConfig, defaultConfig, encodeConfig } from "../utils/config";
import { useNowPlaying } from "../hooks/useNowPlaying";
import ScrollText from "../components/ScrollText";
import { extractDominantColor, getContrastText } from "../utils/colors";

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
    pollMs: 15000,
    sessionKey,
  });

  // Editor-level computed colors for auto-from-art so the controls reflect them
  const artUrl = track?.image?.slice(-1)?.[0]?.["#text"] ?? "";
  const [computedText, setComputedText] = useState(cfg.theme.text);
  const [computedAccent, setComputedAccent] = useState(cfg.theme.accent);
  useEffect(() => {
    let t = 0 as unknown as number;
    const tick = async () => {
      if (!cfg.theme.autoFromArt || !artUrl) {
        setComputedText(cfg.theme.text);
        setComputedAccent(cfg.theme.accent);
      } else {
        const color = await extractDominantColor(artUrl);
        if (!color) {
          setComputedText(cfg.theme.text);
          setComputedAccent(cfg.theme.accent);
        } else {
          const textColor = getContrastText(color);
          setComputedText({
            title: cfg.theme.autoTargets?.title ? textColor : cfg.theme.text.title,
            artist: cfg.theme.autoTargets?.artist ? textColor : cfg.theme.text.artist,
            album: cfg.theme.autoTargets?.album ? textColor : cfg.theme.text.album,
            meta: cfg.theme.autoTargets?.meta ? textColor : cfg.theme.text.meta,
          });
          setComputedAccent(color);
        }
      }
      t = window.setTimeout(tick, 1500) as unknown as number;
    };
    tick();
    return () => { if (t) clearTimeout(t); };
  }, [cfg.theme.autoFromArt, cfg.theme.text, cfg.theme.autoTargets, cfg.theme.accent, artUrl]);

  // config helpers
  function update<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  function isAccent(k: keyof WidgetConfig["theme"]["text"]) {
    return cfg.theme.text[k] === "accent";
  }

  function toggleAccentFor(k: keyof WidgetConfig["theme"]["text"], on: boolean) {
    const val = on ? ("accent" as const) : (cfg.theme.text[k] as string);
    update("theme", { ...cfg.theme, text: { ...cfg.theme.text, [k]: on ? "accent" : (val || "#ffffff") } });
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
        <title>Fast Music Widget</title>
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
              made by <span className="ml-1 font-medium text-white">Lawson Hart</span> <span className="ml-1 text-white/60">(wthlaw)</span>
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
            art={track?.image?.slice(-1)?.[0]?.["#text"] ?? ""}
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
              </div>
              <label className="inline-flex items-center gap-2 mt-3 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.theme.bgEnabled ?? true}
                  onChange={(e) => update("theme", { ...cfg.theme, bgEnabled: e.target.checked })}
                />
                Show background
              </label>
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
  const grid = useMemo(() => {
    // Place art relative to text alignment: center => art above, left => art left, right => art right
    if (!cfg.layout.showArt) return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "auto" } as const;
    if (cfg.layout.align === "center") return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "auto 1fr", justifyItems: "center" } as const;
    if (cfg.layout.align === "right") return { display: "grid", gridTemplateColumns: `1fr auto`, gridTemplateRows: "auto", alignItems: "center" } as const;
    return { display: "grid", gridTemplateColumns: `auto 1fr`, gridTemplateRows: "auto", alignItems: "center" } as const;
  }, [cfg.layout.showArt, cfg.layout.align]);

  const textAlign = cfg.layout.align;
  const fontFamily = cfg.theme.font ? `'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system` : undefined;

  // Compute runtime colors when auto-from-art is enabled
  const [computedText, setComputedText] = useState(cfg.theme.text);
  const [computedAccent, setComputedAccent] = useState(cfg.theme.accent);
  useEffect(() => {
    let t = 0 as unknown as number;
    const run = async () => {
      if (!cfg.theme.autoFromArt || !art) {
        setComputedText(cfg.theme.text);
        setComputedAccent(cfg.theme.accent);
      } else {
        const color = await extractDominantColor(art);
        if (!color) {
          setComputedText(cfg.theme.text);
          setComputedAccent(cfg.theme.accent);
        } else {
          const textColor = getContrastText(color);
          setComputedText({
            title: cfg.theme.autoTargets?.title ? textColor : cfg.theme.text.title,
            artist: cfg.theme.autoTargets?.artist ? textColor : cfg.theme.text.artist,
            album: cfg.theme.autoTargets?.album ? textColor : cfg.theme.text.album,
            meta: cfg.theme.autoTargets?.meta ? textColor : cfg.theme.text.meta,
          });
          setComputedAccent(color);
        }
      }
      t = window.setTimeout(run, 1500) as unknown as number;
    };
    run();
    return () => { if (t) clearTimeout(t); };
  }, [cfg.theme.autoFromArt, cfg.theme.text, cfg.theme.autoTargets, art, cfg.theme.accent]);

  return (
    <div
      className="rounded-2xl p-4 gap-3 items-center"
      style={{
  background: (cfg.theme.bgEnabled ?? true) ? cfg.theme.bg : "transparent",
        width: cfg.layout.w, height: cfg.layout.h,
        ...grid,
        fontFamily,
  // No drop shadow when background is disabled
      }}
    >
      {/* Render order based on alignment: right => text then art; left/center => art then text */}
      {textAlign === 'right' ? (
        <>
          <div className={{ left: "text-left", center: "text-center", right: "text-right" }[textAlign]}>
  {cfg.fields.title && <ScrollText className={cfg.theme.textStyle?.title?.bold ? "font-semibold" : undefined} style={{ fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}` }} color={cfg.theme.text.title === 'accent' ? computedAccent : computedText.title} text={trackTitle ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
  {cfg.fields.artist && <ScrollText style={{ opacity: .95, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400) }} color={cfg.theme.text.artist === 'accent' ? computedAccent : computedText.artist} text={artist ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
  {cfg.fields.album && <ScrollText style={{ fontSize: cfg.theme.textSize?.album ?? 12, opacity: .85, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400) }} color={cfg.theme.text.album === 'accent' ? computedAccent : computedText.album} text={album ?? ""} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
            {cfg.fields.progress && (
              <div className="mt-2 h-1.5 rounded overflow-hidden" style={{ background: "#ffffff30" }}>
        <div className="h-full" style={{ width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
              </div>
            )}
      <div className="mt-1 text-xs" style={{ color: computedText.meta, opacity: .8 }}>{isLive ? "" : "Paused / Not playing"}</div>
          </div>
          {cfg.layout.showArt && (
            <img src={art} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: 12, justifySelf: 'end' }} />
          )}
        </>
      ) : (
        <>
          {cfg.layout.showArt && (
            <img src={art} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: 12, justifySelf: textAlign === 'center' ? 'center' : 'start' }} />
          )}
          <div className={{ left: "text-left", center: "text-center", right: "text-right" }[textAlign]}>
  {cfg.fields.title && <ScrollText className={cfg.theme.textStyle?.title?.bold ? "font-semibold" : undefined} style={{ fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}` }} color={cfg.theme.text.title === 'accent' ? computedAccent : computedText.title} text={trackTitle ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
  {cfg.fields.artist && <ScrollText style={{ opacity: .95, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400) }} color={cfg.theme.text.artist === 'accent' ? computedAccent : computedText.artist} text={artist ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
  {cfg.fields.album && <ScrollText style={{ fontSize: cfg.theme.textSize?.album ?? 12, opacity: .85, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400) }} color={cfg.theme.text.album === 'accent' ? computedAccent : computedText.album} text={album ?? ""} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
            {cfg.fields.progress && (
              <div className="mt-2 h-1.5 rounded overflow-hidden" style={{ background: "#ffffff30" }}>
        <div className="h-full" style={{ width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
              </div>
            )}
      <div className="mt-1 text-xs" style={{ color: computedText.meta, opacity: .8 }}>{isLive ? "" : "Paused / Not playing"}</div>
          </div>
        </>
      )}
    </div>
  );
}
