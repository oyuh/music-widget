// src/pages/index.tsx
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import LastfmConnect from "../components/LastfmConnect";
import { defaultConfig, encodeConfig, decodeConfig, WidgetConfig } from "../utils/config";
import { useNowPlaying } from "../hooks/useNowPlaying";
import { extractDominantColor, getContrastText } from "../utils/colors";
import ScrollText from "../components/ScrollText";

export default function Editor() {
  const [cfg, setCfg] = useState<WidgetConfig>(defaultConfig);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Import existing widget link via ?import=<url>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pasted = params.get("import");
    if (pasted) {
      try {
        const u = new URL(pasted);
        const parsed = decodeConfig(u.hash);
        if (parsed) setCfg(parsed);
      } catch { /* ignore */ }
    }
    // pull Last.fm session if the user connected
    const n = localStorage.getItem("lfm_session_name");
    const k = localStorage.getItem("lfm_session_key");
    if (n) setConnectedName(n);
    if (k) setSessionKey(k);
  }, []);

  // Autofill username from connection
  useEffect(() => {
    if (connectedName && !cfg.lfmUser) setCfg(prev => ({ ...prev, lfmUser: connectedName }));
  }, [connectedName, cfg.lfmUser]);

  const [share, setShare] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setShare(`${window.location.origin}/w#${encodeConfig(cfg)}`);
    }
  }, [cfg]);
  const editorImportUrl = useMemo(() => {
    if (!mounted || !share) return "";
    return `${window.location.origin}/?import=${encodeURIComponent(share)}`;
  }, [mounted, share]);
  const { track, isLive, percent } = useNowPlaying({
    username: cfg.lfmUser,
    pollMs: 15000,
    sessionKey, // if present, preview will work even for private profiles
  });

  // Auto theme from album art
  useEffect(() => {
    const art = track?.image?.slice(-1)?.[0]?.["#text"];
    if (!cfg.theme.autoFromArt || !art) return;
    (async () => {
      const color = await extractDominantColor(art);
      if (!color) return;
      const textColor = getContrastText(color); // Get contrast text color
      setCfg(prev => ({
        ...prev,
        theme: {
          ...prev.theme,
          // Only update selected text colors, do not change background
          text: {
            ...prev.theme.text,
            title: prev.theme.autoTargets?.title ? textColor : prev.theme.text.title,
            artist: prev.theme.autoTargets?.artist ? textColor : prev.theme.text.artist,
            album: prev.theme.autoTargets?.album ? textColor : prev.theme.text.album,
            meta: prev.theme.autoTargets?.meta ? textColor : prev.theme.text.meta,
          },
        },
      }));
    })();
  }, [cfg.theme.autoFromArt, track?.image]);

  const update = <K extends keyof WidgetConfig>(k: K, v: WidgetConfig[K]) =>
    setCfg(prev => ({ ...prev, [k]: v }));

  return (
    <main className="min-h-screen text-white" style={{ background: "radial-gradient(1200px 600px at 20% -10%, rgba(255,255,255,0.06), transparent), radial-gradient(800px 400px at 80% 10%, rgba(255,255,255,0.04), transparent), #0a0a0a" }}>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.theme.font)}:wght@400;600;700&display=swap`} rel="stylesheet" />
      </Head>
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-semibold tracking-tight">Fast Music (via Last.fm) Stream Widget</h1>
          <a
            href="https://lawsonhart.me"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center rounded-md px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white/80"
            title="Open lawsonhart.me"
          >
            made by <span className="ml-1 font-medium text-white">Lawson Hart</span> <span className="ml-1 text-white/60">(wthlaw)</span>
          </a>
        </div>
        <p className="text-white/70 mb-6 leading-relaxed">
          Enter your Last.fm username, customize the card, and copy your unique link to use as a Browser Source in OBS. <a href="https://www.last.fm/about/trackmymusic" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 decoration-white/70 hover:decoration-white text-white">Set up scrobbles before using this app</a>.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <LastfmConnect />
          {sessionKey ? (
            <span className="text-green-400">Connected as <b>{connectedName}</b> (private OK)</span>
          ) : (
            <span className="text-white/60">Not connected (public profiles work without connecting)</span>
          )}
        </div>

        <label className="block text-sm mb-1">Last.fm Username</label>
        <input
          className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 mb-4"
          value={cfg.lfmUser}
          onChange={(e) => update("lfmUser", e.target.value)}
          placeholder="your-lastfm-username"
        />

        <h3 className="font-medium mt-8 mb-3">Theme</h3>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Background</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.theme.bg} onChange={e => update("theme", { ...cfg.theme, bg: e.target.value })}/>
          </div>
          <div>
            <label className="block text-sm mb-1">Accent</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.theme.accent} onChange={e => update("theme", { ...cfg.theme, accent: e.target.value })}/>
          </div>
          <div>
            <label className="block text-sm mb-1">Font</label>
            <select
              className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.theme.font}
              onChange={(e)=> update("theme", { ...cfg.theme, font: e.target.value })}
            >
              {['Inter','Poppins','Roboto','Montserrat','Nunito','Oswald','Lato'].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" checked={cfg.theme.bgEnabled ?? true}
            onChange={e=> update("theme", { ...cfg.theme, bgEnabled: e.target.checked })} />
          Show background
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
          <div>
            <label className="block text-sm mb-1">Title color</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2" value={cfg.theme.text.title}
              onChange={e=> update("theme", { ...cfg.theme, text: { ...cfg.theme.text, title: e.target.value }})} />
          </div>
          <div>
            <label className="block text-sm mb-1">Artist color</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2" value={cfg.theme.text.artist}
              onChange={e=> update("theme", { ...cfg.theme, text: { ...cfg.theme.text, artist: e.target.value }})} />
          </div>
          <div>
            <label className="block text-sm mb-1">Album color</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2" value={cfg.theme.text.album}
              onChange={e=> update("theme", { ...cfg.theme, text: { ...cfg.theme.text, album: e.target.value }})} />
          </div>
          <div>
            <label className="block text-sm mb-1">Meta color</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2" value={cfg.theme.text.meta}
              onChange={e=> update("theme", { ...cfg.theme, text: { ...cfg.theme.text, meta: e.target.value }})} />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" checked={cfg.theme.autoFromArt}
            onChange={e=> update("theme", { ...cfg.theme, autoFromArt: e.target.checked })} />
          Auto theme from album art
        </label>
        {cfg.theme.autoFromArt && (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {(["title","artist","album","meta"] as const).map(k => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(cfg.theme.autoTargets?.[k])}
                  onChange={(e)=> update("theme", { ...cfg.theme, autoTargets: { ...(cfg.theme.autoTargets ?? { title:false, artist:false, album:false, meta:false }), [k]: e.target.checked }})} />
                Apply to {k}
              </label>
            ))}
          </div>
        )}

        <h3 className="font-medium mt-8 mb-2">Layout</h3>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm mb-1">Width</label>
            <input type="number" className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.layout.w} onChange={e => update("layout", { ...cfg.layout, w: +e.target.value })}/>
          </div>
          <div>
            <label className="block text-sm mb-1">Height</label>
            <input type="number" className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.layout.h} onChange={e => update("layout", { ...cfg.layout, h: +e.target.value })}/>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.layout.showArt}
              onChange={e => update("layout", { ...cfg.layout, showArt: e.target.checked })}/>
            Show art
          </label>
          <div>
            <label className="block text-sm mb-1">Text align</label>
            <select className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.layout.align} onChange={e => update("layout", { ...cfg.layout, align: e.target.value as WidgetConfig["layout"]["align"] })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Art size (px)</label>
            <input type="number" className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.layout.artSize} onChange={e => update("layout", { ...cfg.layout, artSize: +e.target.value })}/>
          </div>
          <div>
            <label className="block text-sm mb-1">Scroll trigger width (px)</label>
            <input
              type="number"
              className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.layout.scrollTriggerWidth ?? 180}
              onChange={(e) => update("layout", { ...cfg.layout, scrollTriggerWidth: Math.max(0, +e.target.value) })}
            />
          </div>
          {/* Art position now derives from text alignment (left/right) and center places art above */}
        </div>

        <h3 className="font-medium mt-6 mb-2">Fields</h3>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
      {(["title","artist","album","progress","duration"] as const).map(f => (
            <label key={f} className="flex items-center gap-2">
              <input type="checkbox"
        checked={cfg.fields[f]}
                onChange={(e) => setCfg({...cfg, fields: {...cfg.fields, [f]: e.target.checked}})} />
              {f}
            </label>
          ))}
          <div>
            <label className="block text-sm mb-1">History count</label>
            <input type="number" min={1} max={50}
              className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.fields.history}
              onChange={(e) => setCfg({...cfg, fields: {...cfg.fields, history: +e.target.value}})} />
          </div>
        </div>

        <div className="mt-8 mb-2 flex items-center justify-between">
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
        <WidgetPreview key={refreshKey} cfg={cfg} isLive={isLive} percent={percent} trackTitle={track?.name} artist={track?.artist?.["#text"]} album={track?.album?.["#text"]} art={track?.image?.slice(-1)?.[0]?.["#text"] ?? ""} />

        <h3 className="font-medium mt-8 mb-2">Your unique widget link</h3>
        {mounted && (
          <div className="space-y-3">
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
                onClick={async () => { try { await navigator.clipboard.writeText(share); } catch { /* noop */ } }}
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
                onClick={async () => { try { await navigator.clipboard.writeText(editorImportUrl); } catch { /* noop */ } }}
              >
                Copy editor import URL
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
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

  return (
    <div
      className="rounded-2xl p-4 gap-3 items-center shadow-lg/30"
      style={{
        background: (cfg.theme.bgEnabled ?? true) ? cfg.theme.bg : "transparent",
        width: cfg.layout.w, height: cfg.layout.h,
        ...grid,
        fontFamily,
      }}
    >
      {/* Render order based on alignment: right => text then art; left/center => art then text */}
  {textAlign === 'right' ? (
        <>
          <div className={{ left: "text-left", center: "text-center", right: "text-right" }[textAlign]}>
  {cfg.fields.title && <ScrollText className="font-semibold text-base" color={cfg.theme.text.title} text={trackTitle ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
  {cfg.fields.artist && <ScrollText className="opacity-95" color={cfg.theme.text.artist} text={artist ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
  {cfg.fields.album && <ScrollText className="text-sm opacity-85" color={cfg.theme.text.album} text={album ?? ""} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
            {cfg.fields.progress && (
              <div className="mt-2 h-1.5 rounded overflow-hidden" style={{ background: "#ffffff30" }}>
                <div className="h-full" style={{ width: `${percent}%`, background: cfg.theme.accent, transition: "width 120ms linear" }} />
              </div>
            )}
            <div className="mt-1 text-xs" style={{ color: cfg.theme.text.meta, opacity: .8 }}>{isLive ? "" : "Paused / Not playing"}</div>
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
            {cfg.fields.title && <ScrollText className="font-semibold text-base" color={cfg.theme.text.title} text={trackTitle ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
            {cfg.fields.artist && <ScrollText className="opacity-95" color={cfg.theme.text.artist} text={artist ?? "—"} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
            {cfg.fields.album && <ScrollText className="text-sm opacity-85" color={cfg.theme.text.album} text={album ?? ""} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
            {cfg.fields.progress && (
              <div className="mt-2 h-1.5 rounded overflow-hidden" style={{ background: "#ffffff30" }}>
                <div className="h-full" style={{ width: `${percent}%`, background: cfg.theme.accent, transition: "width 120ms linear" }} />
              </div>
            )}
            <div className="mt-1 text-xs" style={{ color: cfg.theme.text.meta, opacity: .8 }}>{isLive ? "" : "Paused / Not playing"}</div>
          </div>
        </>
      )}
    </div>
  );
}
