// src/pages/w.tsx
import { useEffect, useState } from "react";
import { decodeConfig, WidgetConfig } from "../utils/config";
import { useNowPlaying } from "../hooks/useNowPlaying";

export default function WidgetPage() {
  const [cfg, setCfg] = useState<WidgetConfig | null>(null);

  useEffect(() => {
    setCfg(decodeConfig(window.location.hash));
  }, []);

  // Call hooks unconditionally to keep hook order stable across renders
  const { track, isLive, percent } = useNowPlaying({
    username: cfg?.lfmUser ?? "",
    pollMs: 15000,
    sessionKey: null, // keep widget public-only; preview handles private via editor
  });

  if (!cfg) return null;

  const art = track?.image?.slice(-1)?.[0]?.["#text"] ?? "";
  const title = track?.name ?? "—";
  const artist = track?.artist?.["#text"] ?? "—";
  const album = track?.album?.["#text"] ?? "";

  return (
    <div
      style={{
        width: cfg.layout.w, height: cfg.layout.h,
        display: "grid",
        gridTemplateColumns: cfg.layout.showArt ? "auto 1fr" : "1fr",
        gap: 12, alignItems: "center",
        background: cfg.theme.bg, color: cfg.theme.text, padding: 12, borderRadius: 16
      }}
    >
      {cfg.layout.showArt && <img src={art} alt="" style={{ width: cfg.layout.h - 24, height: cfg.layout.h - 24, objectFit: "cover", borderRadius: 12 }} />}
      <div style={{ textAlign: cfg.layout.align }}>
        {cfg.fields.title && <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>}
        {cfg.fields.artist && <div style={{ opacity: .9 }}>{artist}</div>}
        {cfg.fields.album && <div style={{ opacity: .7, fontSize: 12 }}>{album}</div>}
        {cfg.fields.progress && (
          <div style={{ marginTop: 8, height: 6, background: "#ffffff30", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${percent}%`, background: cfg.theme.accent }} />
          </div>
        )}
        <div style={{ marginTop: 4, fontSize: 12, opacity: .7 }}>{isLive ? "Now playing" : "Paused / Not playing"}</div>
      </div>
    </div>
  );
}
