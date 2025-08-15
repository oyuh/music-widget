// src/pages/index.tsx
import { useEffect, useMemo, useState } from "react";
import LastfmConnect from "../components/LastfmConnect";
import { defaultConfig, encodeConfig, decodeConfig, WidgetConfig } from "../utils/config";
import { useNowPlaying } from "../hooks/useNowPlaying";

export default function Editor() {
  const [cfg, setCfg] = useState<WidgetConfig>(defaultConfig);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

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
  }, [connectedName]);

  const [share, setShare] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setShare(`${window.location.origin}/w#${encodeConfig(cfg)}`);
    }
  }, [cfg]);
  const { track, isLive, percent } = useNowPlaying({
    username: cfg.lfmUser,
    pollMs: 15000,
    sessionKey, // if present, preview will work even for private profiles
  });

  const update = <K extends keyof WidgetConfig>(k: K, v: WidgetConfig[K]) =>
    setCfg(prev => ({ ...prev, [k]: v }));

  return (
    <main className="min-h-screen bg-neutral-900 text-white">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Apple Music (via Last.fm) Stream Widget</h1>
        <p className="text-white/70 mb-6">
          Enter your Last.fm username, customize the card, and copy your unique link to use as a Browser Source in OBS.
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

        <h3 className="font-medium mt-6 mb-2">Theme</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Background</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.theme.bg} onChange={e => update("theme", { ...cfg.theme, bg: e.target.value })}/>
          </div>
          <div>
            <label className="block text-sm mb-1">Text</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.theme.text} onChange={e => update("theme", { ...cfg.theme, text: e.target.value })}/>
          </div>
          <div>
            <label className="block text-sm mb-1">Accent</label>
            <input className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.theme.accent} onChange={e => update("theme", { ...cfg.theme, accent: e.target.value })}/>
          </div>
        </div>

        <h3 className="font-medium mt-6 mb-2">Layout</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <label className="block text-sm mb-1">Align</label>
            <select className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
              value={cfg.layout.align} onChange={e => update("layout", { ...cfg.layout, align: e.target.value as any })}>
              <option value="left">Left</option><option value="right">Right</option>
            </select>
          </div>
        </div>

        <h3 className="font-medium mt-6 mb-2">Fields</h3>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
          {(["title","artist","album","progress","duration"] as const).map(f => (
            <label key={f} className="flex items-center gap-2">
              <input type="checkbox"
                checked={(cfg.fields as any)[f]}
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

        <h3 className="font-medium mt-8 mb-2">Preview</h3>
        <WidgetPreview cfg={cfg} isLive={isLive} percent={percent} trackTitle={track?.name} artist={track?.artist?.["#text"]} album={track?.album?.["#text"]} art={track?.image?.slice(-1)?.[0]?.["#text"] ?? ""} />

        <h3 className="font-medium mt-8 mb-2">Your unique widget link</h3>
        {mounted && (
          <>
            <input readOnly className="w-full rounded bg-neutral-800 border border-white/10 px-3 py-2"
                   value={share} onFocus={(e) => e.currentTarget.select()} />
            <p className="text-white/60 mt-2 text-sm">
              To edit later, paste your widget link into the editor using <code>?import=</code>:
              <br/>
              <code className="text-white">{`${window.location.origin}/?import=${encodeURIComponent(share)}`}</code>
            </p>
          </>
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
  return (
    <div
      className="rounded-2xl p-3 grid gap-3 items-center"
      style={{
        background: cfg.theme.bg, color: cfg.theme.text,
        width: cfg.layout.w, height: cfg.layout.h,
        gridTemplateColumns: cfg.layout.showArt ? "auto 1fr" : "1fr"
      }}
    >
      {cfg.layout.showArt && (
        <img src={art} alt="" style={{ width: cfg.layout.h - 24, height: cfg.layout.h - 24, objectFit: "cover", borderRadius: 12 }} />
      )}
      <div className={cfg.layout.align === "right" ? "text-right" : "text-left"}>
        {cfg.fields.title && <div className="font-semibold text-base truncate">{trackTitle ?? "—"}</div>}
        {cfg.fields.artist && <div className="opacity-90 truncate">{artist ?? "—"}</div>}
        {cfg.fields.album && <div className="opacity-70 text-sm truncate">{album ?? ""}</div>}
        {cfg.fields.progress && (
          <div className="mt-2 h-1.5 bg-white/30 rounded overflow-hidden">
            <div className="h-full" style={{ width: `${percent}%`, background: cfg.theme.accent }} />
          </div>
        )}
        <div className="mt-1 text-xs opacity-70">{isLive ? "Now playing" : "Paused / Not playing"}</div>
      </div>
    </div>
  );
}
