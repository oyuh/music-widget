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
          textSize: {
            title: p.theme?.textSize?.title ?? defaultConfig.theme.textSize!.title,
            artist: p.theme?.textSize?.artist ?? defaultConfig.theme.textSize!.artist,
            album: p.theme?.textSize?.album ?? defaultConfig.theme.textSize!.album,
            meta: p.theme?.textSize?.meta ?? defaultConfig.theme.textSize!.meta,
          },
          textStyle: {
            title: { italic: p.theme?.textStyle?.title?.italic ?? defaultConfig.theme.textStyle!.title.italic, underline: p.theme?.textStyle?.title?.underline ?? defaultConfig.theme.textStyle!.title.underline, bold: p.theme?.textStyle?.title?.bold ?? defaultConfig.theme.textStyle!.title.bold, strike: p.theme?.textStyle?.title?.strike ?? defaultConfig.theme.textStyle!.title.strike },
            artist: { italic: p.theme?.textStyle?.artist?.italic ?? defaultConfig.theme.textStyle!.artist.italic, underline: p.theme?.textStyle?.artist?.underline ?? defaultConfig.theme.textStyle!.artist.underline, bold: p.theme?.textStyle?.artist?.bold ?? defaultConfig.theme.textStyle!.artist.bold, strike: p.theme?.textStyle?.artist?.strike ?? defaultConfig.theme.textStyle!.artist.strike },
            album: { italic: p.theme?.textStyle?.album?.italic ?? defaultConfig.theme.textStyle!.album.italic, underline: p.theme?.textStyle?.album?.underline ?? defaultConfig.theme.textStyle!.album.underline, bold: p.theme?.textStyle?.album?.bold ?? defaultConfig.theme.textStyle!.album.bold, strike: p.theme?.textStyle?.album?.strike ?? defaultConfig.theme.textStyle!.album.strike },
            meta: { italic: p.theme?.textStyle?.meta?.italic ?? defaultConfig.theme.textStyle!.meta.italic, underline: p.theme?.textStyle?.meta?.underline ?? defaultConfig.theme.textStyle!.meta.underline, bold: p.theme?.textStyle?.meta?.bold ?? defaultConfig.theme.textStyle!.meta.bold, strike: p.theme?.textStyle?.meta?.strike ?? defaultConfig.theme.textStyle!.meta.strike },
          },
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
  pollMs: 5000,
    sessionKey: null, // keep widget public-only; preview handles private via editor
  });

  // Derive common values before any early returns
  const isLastfmPlaceholder = (u?: string) => !!u && /2a96cbd8b46e442fc41c2b86b821562f/i.test(u);
  const art = (() => {
    const imgs = track?.image ?? [];
    for (let i = imgs.length - 1; i >= 0; i--) {
      const u = imgs[i]?.["#text"] ?? "";
      if (u && !isLastfmPlaceholder(u)) return u;
    }
    return "";
  })();
  const [artSrc, setArtSrc] = useState<string>(art);
  useEffect(() => {
    if (art && art.trim().length > 0) setArtSrc(art);
  }, [art]);
  const title = track?.name ?? "—";
  const artist = track?.artist?.["#text"] ?? "—";
  const album = track?.album?.["#text"] ?? "";
  // Build a robust, display-ready image URL via Blob (proxy first, then direct)
  const [imgUrl, setImgUrl] = useState<string>("");
  useEffect(() => {
    let active = true; let currentObjUrl: string | null = null;
    async function load() {
      if (!artSrc) { setImgUrl(""); return; }
      const mk = async (u: string) => { try { const r = await fetch(u); if (!r.ok) return null; const b = await r.blob(); return URL.createObjectURL(b); } catch { return null; } };
      const viaProxy = await mk(`/api/proxy-image?url=${encodeURIComponent(artSrc)}`);
      const viaDirect = viaProxy ? null : await mk(artSrc);
      const finalUrl = viaProxy || viaDirect || "";
      if (!active) return; if (currentObjUrl) URL.revokeObjectURL(currentObjUrl); currentObjUrl = finalUrl || null; setImgUrl(finalUrl);
    }
    load();
    return ()=>{ active=false; if (currentObjUrl) URL.revokeObjectURL(currentObjUrl); };
  }, [artSrc]);

  // Compute runtime text colors if autoFromArt is enabled (use safe fallback config on first render)
  const effectiveCfg = cfg ?? defaultConfig;
  const [computedText, setComputedText] = useState(effectiveCfg.theme.text);
  const [computedAccent, setComputedAccent] = useState(effectiveCfg.theme.accent);
  useEffect(() => {
  let raf = 0;
  let lastArt = artSrc;
    const tick = async () => {
  if (!effectiveCfg.theme.autoFromArt || !lastArt) {
        setComputedText(effectiveCfg.theme.text);
        setComputedAccent(effectiveCfg.theme.accent);
      } else {
        const color = await extractDominantColor(lastArt);
        if (!color) {
          setComputedText(effectiveCfg.theme.text);
          setComputedAccent(effectiveCfg.theme.accent);
        } else {
          const textColor = getContrastText(color);
          setComputedText({
            title: effectiveCfg.theme.autoTargets?.title ? textColor : effectiveCfg.theme.text.title,
            artist: effectiveCfg.theme.autoTargets?.artist ? textColor : effectiveCfg.theme.text.artist,
            album: effectiveCfg.theme.autoTargets?.album ? textColor : effectiveCfg.theme.text.album,
            meta: effectiveCfg.theme.autoTargets?.meta ? textColor : effectiveCfg.theme.text.meta,
          });
          setComputedAccent(color);
        }
      }
      raf = window.setTimeout(tick, 1500) as unknown as number; // refresh periodically to follow track changes
    };
    // immediate first run and on art change
  lastArt = artSrc;
    tick();
    return () => { if (raf) clearTimeout(raf); };
  }, [effectiveCfg.theme.autoFromArt, effectiveCfg.theme.text, effectiveCfg.theme.autoTargets, artSrc, effectiveCfg.theme.accent]);

  if (!cfg) return null;

  const showImage = cfg.layout.showArt && !!imgUrl;
  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  <link href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.theme.font).replace(/%20/g, "+")}:wght@400;600;700&display=swap`} rel="stylesheet" />
  {/* Force transparent page background for embedding in streaming overlays */}
  <style>{`html, body, #__next { background: transparent !important; }`}</style>
      </Head>
    <div
        style={{
          width: cfg.layout.w, height: cfg.layout.h,
          display: "grid",
          gridTemplateColumns: !showImage ? "1fr" : cfg.layout.align === 'center' ? "1fr" : cfg.layout.align === 'right' ? "1fr auto" : "auto 1fr",
          gridTemplateRows: showImage && cfg.layout.align === 'center' ? "auto 1fr" : "auto",
          gap: 12,
      background: (!isLive && (cfg.fields.pausedMode ?? "label") === "transparent") ? "transparent" : ((cfg.theme.bgEnabled ?? true) ? cfg.theme.bg : "transparent"),
          // No drop shadow when background is disabled
      padding: 12, borderRadius: 16,
          fontFamily: `'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system`,
          alignItems: 'center', justifyItems: cfg.layout.align === 'center' ? 'center' : undefined,
      opacity: (!isLive && (cfg.fields.pausedMode ?? "label") === "transparent") ? 0 : 1,
        }}
      >
    {cfg.layout.align === 'right' ? (
          <>
  <div style={{ textAlign: 'right', minWidth: 0 }}>
              {cfg.fields.title && <ScrollText style={{ fontWeight: (cfg.theme.textStyle?.title?.bold ? 700 : 400), fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)` }} color={(effectiveCfg.theme.text.title === 'accent') ? computedAccent : computedText.title} text={title} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
              {cfg.fields.artist && <ScrollText style={{ opacity: .95, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)` }} color={(effectiveCfg.theme.text.artist === 'accent') ? computedAccent : computedText.artist} text={artist} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
              {cfg.fields.album && <ScrollText style={{ opacity: .85, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.album ?? 12, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)` }} color={(effectiveCfg.theme.text.album === 'accent') ? computedAccent : computedText.album} text={album} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
        {cfg.fields.progress && (
                <div style={{ marginTop: 8, height: 6, background: "#ffffff30", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: cfg.theme.textSize?.meta ?? 12, opacity: .8, color: computedText.meta }}>{isLive ? "" : "Paused / Not playing"}</div>
            </div>
            {cfg.layout.showArt && imgUrl && <img src={imgUrl} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: 12, justifySelf: 'end' }} />}
          </>
        ) : (
          <>
            {cfg.layout.showArt && imgUrl && <img src={imgUrl} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: 12, justifySelf: 'start' }} />}
            <div style={{ textAlign: (cfg.layout.align === 'center' ? 'center' : 'left'), minWidth: 0 }}>
              {cfg.fields.title && <ScrollText style={{ fontWeight: (cfg.theme.textStyle?.title?.bold ? 700 : 400), fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)` }} color={(effectiveCfg.theme.text.title === 'accent') ? computedAccent : computedText.title} text={title} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
              {cfg.fields.artist && <ScrollText style={{ opacity: .95, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)` }} color={(effectiveCfg.theme.text.artist === 'accent') ? computedAccent : computedText.artist} text={artist} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
              {cfg.fields.album && <ScrollText style={{ opacity: .85, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.album ?? 12, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)` }} color={(effectiveCfg.theme.text.album === 'accent') ? computedAccent : computedText.album} text={album} minWidthToScroll={cfg.layout.scrollTriggerWidth} speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24} gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32} />}
        {cfg.fields.progress && (
                <div style={{ marginTop: 8, height: 6, background: "#ffffff30", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: cfg.theme.textSize?.meta ?? 12, opacity: .8, color: computedText.meta }}>{isLive ? "" : "Paused / Not playing"}</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
