// src/pages/w.tsx
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { decodeConfig, WidgetConfig, defaultConfig } from "../utils/config";
import Head from "next/head";
import { useNowPlaying } from "../hooks/useNowPlaying";
import ScrollText from "../components/ScrollText";
import { extractDominantColor, getContrastText } from "../utils/colors";

export default function WidgetPage() {
  const [cfg, setCfg] = useState<WidgetConfig | null>(null);

  useEffect(() => {
    const parsed = decodeConfig(window.location.hash);
    if (parsed) {
      const p = parsed as Partial<WidgetConfig>;
      const merged: WidgetConfig = {
        ...defaultConfig,
        ...p,
        theme: {
          ...defaultConfig.theme,
          ...p.theme,
          text: { ...defaultConfig.theme.text, ...p.theme?.text },
        },
        layout: { ...defaultConfig.layout, ...p.layout },
        fields: { ...defaultConfig.fields, ...p.fields },
      };
      setCfg(merged);
    } else {
      setCfg(defaultConfig);
    }
  }, []);

  // Call hooks unconditionally to keep hook order stable across renders
  const { track, isLive, percent } = useNowPlaying({
    username: cfg?.lfmUser ?? "",
    pollMs: 15000,
    sessionKey: null, // keep widget public-only; preview handles private via editor
  });

  // Derive common values before any early returns
  const art = track?.image?.slice(-1)?.[0]?.["#text"] ?? "";
  const title = track?.name ?? "—";
  const artist = track?.artist?.["#text"] ?? "—";
  const album = track?.album?.["#text"] ?? "";

  // Compute runtime text colors if autoFromArt is enabled (use safe fallback config on first render)
  const effectiveCfg = cfg ?? defaultConfig;
  const [computedText, setComputedText] = useState(effectiveCfg.theme.text);
  useEffect(() => {
    if (!effectiveCfg.theme.autoFromArt || !art) {
      setComputedText(effectiveCfg.theme.text);
      return;
    }
    (async () => {
      const color = await extractDominantColor(art);
      if (!color) return setComputedText(effectiveCfg.theme.text);
      const textColor = getContrastText(color);
      setComputedText({
        title: effectiveCfg.theme.autoTargets?.title ? textColor : effectiveCfg.theme.text.title,
        artist: effectiveCfg.theme.autoTargets?.artist ? textColor : effectiveCfg.theme.text.artist,
        album: effectiveCfg.theme.autoTargets?.album ? textColor : effectiveCfg.theme.text.album,
        meta: effectiveCfg.theme.autoTargets?.meta ? textColor : effectiveCfg.theme.text.meta,
      });
    })();
  }, [effectiveCfg.theme.autoFromArt, effectiveCfg.theme.text, effectiveCfg.theme.autoTargets, art]);

  if (!cfg) return null;

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.theme.font)}:wght@400;600;700&display=swap`} rel="stylesheet" />
      </Head>
      <div
        style={{
          width: cfg.layout.w, height: cfg.layout.h,
          display: "grid",
          gridTemplateColumns: !cfg.layout.showArt ? "1fr" : cfg.layout.align === 'center' ? "1fr" : cfg.layout.align === 'right' ? "1fr auto" : "auto 1fr",
          gridTemplateRows: cfg.layout.showArt && cfg.layout.align === 'center' ? "auto 1fr" : "auto",
          gap: 12,
          background: (cfg.theme.bgEnabled ?? true) ? cfg.theme.bg : "transparent",
          padding: 12, borderRadius: 16,
          fontFamily: `'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system`,
          alignItems: 'center', justifyItems: cfg.layout.align === 'center' ? 'center' : undefined,
        }}
      >
        {cfg.layout.align === 'right' ? (
          <>
            <div style={{ textAlign: 'right' }}>
              {cfg.fields.title && <ScrollText style={{ fontWeight: 700, fontSize: 16 }} color={computedText.title} text={title} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
              {cfg.fields.artist && <ScrollText style={{ opacity: .95 }} color={computedText.artist} text={artist} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
              {cfg.fields.album && <ScrollText style={{ opacity: .85, fontSize: 12 }} color={computedText.album} text={album} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
              {cfg.fields.progress && (
                <div style={{ marginTop: 8, height: 6, background: "#ffffff30", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${percent}%`, background: cfg.theme.accent, transition: "width 120ms linear" }} />
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: 12, opacity: .8, color: computedText.meta }}>{isLive ? "" : "Paused / Not playing"}</div>
            </div>
            {cfg.layout.showArt && <img src={art} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: 12 }} />}
          </>
        ) : (
          <>
            {cfg.layout.showArt && <img src={art} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: 12 }} />}
            <div style={{ textAlign: (cfg.layout.align === 'center' ? 'center' : 'left') }}>
              {cfg.fields.title && <ScrollText style={{ fontWeight: 700, fontSize: 16 }} color={computedText.title} text={title} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
              {cfg.fields.artist && <ScrollText style={{ opacity: .95 }} color={computedText.artist} text={artist} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
              {cfg.fields.album && <ScrollText style={{ opacity: .85, fontSize: 12 }} color={computedText.album} text={album} minWidthToScroll={cfg.layout.scrollTriggerWidth} />}
              {cfg.fields.progress && (
                <div style={{ marginTop: 8, height: 6, background: "#ffffff30", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${percent}%`, background: cfg.theme.accent, transition: "width 120ms linear" }} />
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: 12, opacity: .8, color: computedText.meta }}>{isLive ? "" : "Paused / Not playing"}</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
