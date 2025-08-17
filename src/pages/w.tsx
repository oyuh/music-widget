// src/pages/w.tsx
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { decodeConfig, WidgetConfig, defaultConfig, formatDurationText } from "../utils/config";
import Head from "next/head";
import { useNowPlaying } from "../hooks/useNowPlaying";
import ScrollText from "../components/ScrollText";
import { extractDominantColor, getReadableTextOn, generateDropShadowCSS, generateElementDropShadowCSS } from "../utils/colors";

export default function WidgetPage() {
  const [cfg, setCfg] = useState<WidgetConfig | null>(null);

  useEffect(() => {
    const mergeFromHash = () => {
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
              duration: p.theme?.textSize?.duration ?? defaultConfig.theme.textSize!.duration,
            },
            textStyle: {
              title: { italic: p.theme?.textStyle?.title?.italic ?? defaultConfig.theme.textStyle!.title.italic, underline: p.theme?.textStyle?.title?.underline ?? defaultConfig.theme.textStyle!.title.underline, bold: p.theme?.textStyle?.title?.bold ?? defaultConfig.theme.textStyle!.title.bold, strike: p.theme?.textStyle?.title?.strike ?? defaultConfig.theme.textStyle!.title.strike },
              artist: { italic: p.theme?.textStyle?.artist?.italic ?? defaultConfig.theme.textStyle!.artist.italic, underline: p.theme?.textStyle?.artist?.underline ?? defaultConfig.theme.textStyle!.artist.underline, bold: p.theme?.textStyle?.artist?.bold ?? defaultConfig.theme.textStyle!.artist.bold, strike: p.theme?.textStyle?.artist?.strike ?? defaultConfig.theme.textStyle!.artist.strike },
              album: { italic: p.theme?.textStyle?.album?.italic ?? defaultConfig.theme.textStyle!.album.italic, underline: p.theme?.textStyle?.album?.underline ?? defaultConfig.theme.textStyle!.album.underline, bold: p.theme?.textStyle?.album?.bold ?? defaultConfig.theme.textStyle!.album.bold, strike: p.theme?.textStyle?.album?.strike ?? defaultConfig.theme.textStyle!.album.strike },
              meta: { italic: p.theme?.textStyle?.meta?.italic ?? defaultConfig.theme.textStyle!.meta.italic, underline: p.theme?.textStyle?.meta?.underline ?? defaultConfig.theme.textStyle!.meta.underline, bold: p.theme?.textStyle?.meta?.bold ?? defaultConfig.theme.textStyle!.meta.bold, strike: p.theme?.textStyle?.meta?.strike ?? defaultConfig.theme.textStyle!.meta.strike },
              duration: { italic: p.theme?.textStyle?.duration?.italic ?? defaultConfig.theme.textStyle!.duration.italic, underline: p.theme?.textStyle?.duration?.underline ?? defaultConfig.theme.textStyle!.duration.underline, bold: p.theme?.textStyle?.duration?.bold ?? defaultConfig.theme.textStyle!.duration.bold, strike: p.theme?.textStyle?.duration?.strike ?? defaultConfig.theme.textStyle!.duration.strike },
            },
            dropShadow: {
              ...defaultConfig.theme.dropShadow!,
              ...p.theme?.dropShadow,
            },
          },
          layout: { ...defaultConfig.layout, ...p.layout },
          fields: { ...defaultConfig.fields, ...p.fields },
        };
        setCfg(merged);
      } else {
        setCfg(defaultConfig);
      }
    };

    mergeFromHash();
    window.addEventListener("hashchange", mergeFromHash);
    return () => window.removeEventListener("hashchange", mergeFromHash);
  }, []);

  // Call hooks unconditionally to keep hook order stable across renders
  const { track, isLive, isPaused, percent, progressMs, durationMs, isPositionEstimated } = useNowPlaying({
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
  // Always update artSrc; clear it when there's no usable art to avoid stale images
  if (art && art.trim().length > 0) setArtSrc(art);
  else setArtSrc("");
  }, [art]);
  const title = track?.name ?? "—";
  const artist = track?.artist?.["#text"] ?? "—";
  const album = track?.album?.["#text"] ?? "";
  // Build a robust, display-ready image URL via Blob (proxy first, then direct)
  const [imgUrl, setImgUrl] = useState<string>("");
  // Heartbeat to retry image/color work every ~5s without a full page reload
  // Only run the heartbeat when auto-from-art is enabled to reduce unnecessary work
  const [refreshNonce, setRefreshNonce] = useState(0);
  useEffect(() => {
    if (!cfg?.theme.autoFromArt) return; // Don't run refresh timer when auto-from-art is off
    const id = window.setInterval(() => setRefreshNonce((n) => n + 1), 3000) as unknown as number;
    return () => clearInterval(id);
  }, [cfg?.theme.autoFromArt]);
  useEffect(() => {
    let active = true; let currentObjUrl: string | null = null;
    async function load() {
      if (!artSrc) {
        // Only clear imgUrl if it's not already empty to avoid unnecessary updates
        setImgUrl(prev => prev ? "" : prev);
        return;
      }
      const mk = async (u: string) => { try { const r = await fetch(u); if (!r.ok) return null; const b = await r.blob(); return URL.createObjectURL(b); } catch { return null; } };
      const viaProxy = await mk(`/api/proxy-image?url=${encodeURIComponent(artSrc)}`);
      const viaDirect = viaProxy ? null : await mk(artSrc);
      const finalUrl = viaProxy || viaDirect || "";
      if (!active) return;
      if (currentObjUrl) URL.revokeObjectURL(currentObjUrl);
      currentObjUrl = finalUrl || null;
      // Only update imgUrl if it actually changed
      setImgUrl(prev => prev !== finalUrl ? finalUrl : prev);
    }
    load();
    return ()=>{ active=false; if (currentObjUrl) URL.revokeObjectURL(currentObjUrl); };
  }, [artSrc, refreshNonce]);

  // Compute runtime text colors if autoFromArt is enabled (use safe fallback config on first render)
  const effectiveCfg = cfg ?? defaultConfig;
  const [computedText, setComputedText] = useState(effectiveCfg.theme.text);
  const [computedAccent, setComputedAccent] = useState(effectiveCfg.theme.accent);

  // Drop shadow computation helpers
  const dropShadows = effectiveCfg.theme.dropShadow?.enabled ? {
    getBackgroundShadow: () => effectiveCfg.theme.dropShadow?.enabled && effectiveCfg.theme.dropShadow.targets?.background
      ? generateDropShadowCSS(effectiveCfg.theme.dropShadow, effectiveCfg.theme.bg)
      : undefined,
    getTitleTextShadow: (color: string) => effectiveCfg.theme.dropShadow?.enabled && effectiveCfg.theme.dropShadow.targets?.text
      ? generateElementDropShadowCSS(effectiveCfg.theme.dropShadow, effectiveCfg.theme.dropShadow.perText?.title, color)
      : undefined,
    getArtistTextShadow: (color: string) => effectiveCfg.theme.dropShadow?.enabled && effectiveCfg.theme.dropShadow.targets?.text
      ? generateElementDropShadowCSS(effectiveCfg.theme.dropShadow, effectiveCfg.theme.dropShadow.perText?.artist, color)
      : undefined,
    getAlbumTextShadow: (color: string) => effectiveCfg.theme.dropShadow?.enabled && effectiveCfg.theme.dropShadow.targets?.text
      ? generateElementDropShadowCSS(effectiveCfg.theme.dropShadow, effectiveCfg.theme.dropShadow.perText?.album, color)
      : undefined,
    getMetaTextShadow: (color: string) => effectiveCfg.theme.dropShadow?.enabled && effectiveCfg.theme.dropShadow.targets?.text
      ? generateElementDropShadowCSS(effectiveCfg.theme.dropShadow, effectiveCfg.theme.dropShadow.perText?.meta, color)
      : undefined,
    getDurationTextShadow: (color: string) => effectiveCfg.theme.dropShadow?.enabled && effectiveCfg.theme.dropShadow.targets?.text
      ? generateElementDropShadowCSS(effectiveCfg.theme.dropShadow, effectiveCfg.theme.dropShadow.perText?.duration, color)
      : undefined,
    getAlbumArtShadow: () => effectiveCfg.theme.dropShadow?.enabled && effectiveCfg.theme.dropShadow.targets?.albumArt
      ? generateDropShadowCSS(effectiveCfg.theme.dropShadow, '#000000')
      : undefined,
    getProgressBarShadow: () => effectiveCfg.theme.dropShadow?.enabled && effectiveCfg.theme.dropShadow.targets?.progressBar
      ? generateDropShadowCSS(effectiveCfg.theme.dropShadow, computedAccent)
      : undefined,
  } : null;

  // Track last successful extraction to prevent unnecessary updates
  const [lastExtractedColor, setLastExtractedColor] = useState<string | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!effectiveCfg.theme.autoFromArt) {
        // Auto-from-art disabled: honor configured theme colors
        const newText = effectiveCfg.theme.text;
        const newAccent = effectiveCfg.theme.accent;
        // Only update if actually different to avoid flicker
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);
        // Reset tracking when auto-from-art is disabled
        setLastExtractedColor(null);
        setLastImageUrl("");
        return;
      }

      // Prefer the blob/object URL we generated for the image; fall back to original src
      const source = imgUrl || artSrc;

      if (!source) {
        // No image available: use readable white text and fallback/default accent
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff", duration: "#ffffff" };
        const newAccent = effectiveCfg.fallbackAccent || effectiveCfg.theme.accent;
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
        const textColor = !(effectiveCfg.theme.bgEnabled ?? true)
          ? "#ffffff"
          : getReadableTextOn(effectiveCfg.theme.bg);
        const newText = { title: textColor, artist: textColor, album: textColor, meta: textColor, duration: textColor };
        const newAccent = color;

        // Only update if colors actually changed to prevent flicker
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);

        // Update tracking state
        setLastExtractedColor(color);
        setLastImageUrl(source);
      } else if (source !== lastImageUrl) {
        // Extraction failed for a NEW image: use fallback only if image URL changed
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff", duration: "#ffffff" };
        const newAccent = effectiveCfg.fallbackAccent || effectiveCfg.theme.accent;
        setComputedText(prev => JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev);
        setComputedAccent(prev => prev !== newAccent ? newAccent : prev);
        setLastExtractedColor(null);
        setLastImageUrl(source);
      }
      // If extraction failed but image URL is the same, keep current colors (don't flicker to fallback)
    };

    run();
    return () => { cancelled = true; };
  }, [effectiveCfg.theme.autoFromArt, effectiveCfg.theme.text, imgUrl, artSrc, effectiveCfg.theme.accent, effectiveCfg.theme.bg, effectiveCfg.theme.bgEnabled, effectiveCfg.fallbackAccent, refreshNonce, lastExtractedColor, lastImageUrl]);

  if (!cfg) return null;

  const showImage = cfg.layout.showArt && !!imgUrl;
  const artPos = cfg.layout.artPosition; // 'left' | 'right' | 'top'
  const isTop = showImage && artPos === 'top';

  // Enhanced pause detection: consider both Last.fm state and smart pause detection
  const isEffectivelyPaused = !isLive || isPaused;

  // Last-resort guard: when the card is actually transparent (paused transparent OR bg disabled), force all text to white
  const forceWhite = (isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "transparent") || !(cfg.theme.bgEnabled ?? true);
  const pickColor = (desired: string, isAccent: boolean = false) => {
    // If this is an accent color, always show it (accent colors should be visible even on transparent backgrounds)
    if (isAccent) return desired;
    // For text colors: if bg is disabled, always return white regardless of what was computed
    if (!(cfg.theme.bgEnabled ?? true)) return '#ffffff';
    return forceWhite ? '#ffffff' : desired;
  };
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
          gridTemplateColumns: !showImage ? "1fr" : isTop ? "1fr" : (artPos === 'right' ? "1fr auto" : "auto 1fr"),
          gridTemplateRows: isTop ? "auto 1fr" : "auto",
          gap: 12,
          background: (isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "transparent") ? "transparent" : ((cfg.theme.bgEnabled ?? true) ? cfg.theme.bg : "transparent"),
          // Ensure readable default text color when background is actually transparent
          color: ((isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "transparent") || !(cfg.theme.bgEnabled ?? true)) ? "#ffffff" : undefined,
          // No drop shadow when background is disabled
      padding: 12, borderRadius: cfg.layout.backgroundRadius ?? 16,
          fontFamily: `'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system`,
          alignItems: 'center', justifyItems: cfg.layout.align === 'center' ? 'center' : undefined,
      opacity: (isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "transparent") ? 0 : 1,
          boxShadow: dropShadows?.getBackgroundShadow(),
        }}
      >
        {showImage && artPos === 'right' ? (
          <>
            <div className={`${cfg.layout.align === 'center' ? 'text-center' : cfg.layout.align === 'right' ? 'text-right' : 'text-left'}`} style={{ minWidth: 0 }}>
        {cfg.fields.title && (
                <ScrollText
          style={{ fontWeight: (cfg.theme.textStyle?.title?.bold ? 700 : 400), fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, textShadow: dropShadows?.getTitleTextShadow(pickColor((effectiveCfg.theme.text.title === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.title as string) : (effectiveCfg.theme.text.title as string)), effectiveCfg.theme.text.title === 'accent')) }}
          color={pickColor((effectiveCfg.theme.text.title === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.title as string) : (effectiveCfg.theme.text.title as string)), effectiveCfg.theme.text.title === 'accent')}
                  text={title}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.artist && (
                <ScrollText
                  style={{ opacity: .95, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, textShadow: dropShadows?.getArtistTextShadow(pickColor((effectiveCfg.theme.text.artist === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.artist as string) : (effectiveCfg.theme.text.artist as string)), effectiveCfg.theme.text.artist === 'accent')) }}
                  color={pickColor((effectiveCfg.theme.text.artist === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.artist as string) : (effectiveCfg.theme.text.artist as string)), effectiveCfg.theme.text.artist === 'accent')}
                  text={artist}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.album && (
                <ScrollText
                  style={{ opacity: .85, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.album ?? 12, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, textShadow: dropShadows?.getAlbumTextShadow(pickColor((effectiveCfg.theme.text.album === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.album as string) : (effectiveCfg.theme.text.album as string)), effectiveCfg.theme.text.album === 'accent')) }}
                  color={pickColor((effectiveCfg.theme.text.album === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.album as string) : (effectiveCfg.theme.text.album as string)), effectiveCfg.theme.text.album === 'accent')}
                  text={album}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
        {cfg.fields.progress && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 6, background: "#ffffff30", borderRadius: 4, overflow: "hidden", boxShadow: dropShadows?.getProgressBarShadow() }}>
            <div style={{ height: "100%", width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                  </div>
                  {cfg.fields.duration && cfg.fields.showDurationOnProgress && (
                    <div style={{
                      fontSize: cfg.theme.textSize?.duration ?? 11,
                      opacity: 0.8,
                      marginTop: 4,
                      fontWeight: (cfg.theme.textStyle?.duration?.bold ? 600 : 400),
                      fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                      textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                      transform: `translate(${cfg.layout.textOffset?.duration?.x ?? 0}px, ${cfg.layout.textOffset?.duration?.y ?? 0}px)`,
                      color: pickColor(cfg.theme.text.duration === 'accent' ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'),
                      textShadow: dropShadows?.getDurationTextShadow(pickColor(cfg.theme.text.duration === 'accent' ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'))
                    }}>
                      {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                    </div>
                  )}
                </div>
              )}
              {cfg.fields.duration && cfg.fields.showDurationAsText && (
                <div style={{
                  fontSize: cfg.theme.textSize?.duration ?? 11,
                  fontWeight: (cfg.theme.textStyle?.duration?.bold ? 600 : 400),
                  fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                  textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                  opacity: 0.8,
                  marginTop: 4,
                  transform: `translate(${cfg.layout.textOffset?.duration?.x ?? 0}px, ${cfg.layout.textOffset?.duration?.y ?? 0}px)`,
                  color: pickColor(cfg.theme.text.duration === 'accent' ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'),
                  textShadow: dropShadows?.getDurationTextShadow(pickColor(cfg.theme.text.duration === 'accent' ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'))
                }}>
                  {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                </div>
              )}
            </div>
            {cfg.layout.showArt && imgUrl && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imgUrl} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: cfg.layout.artRadius ?? 12, justifySelf: 'end', boxShadow: dropShadows?.getAlbumArtShadow() }} />
                {isEffectivelyPaused && cfg.fields.pausedMode === "label" && (
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
            {!cfg.layout.showArt && isEffectivelyPaused && cfg.fields.pausedMode === "label" && (
              <div style={{
                fontSize: cfg.theme.textSize?.meta ?? 12,
                opacity: .8,
                color: pickColor(cfg.theme.text.meta === 'accent' ? computedAccent : (computedText.meta as string), cfg.theme.text.meta === 'accent'),
                transform: `translate(${cfg.layout.textOffset?.meta.x ?? 0}px, ${(cfg.layout.textOffset?.meta.y ?? 0)}px)`,
                textShadow: dropShadows?.getMetaTextShadow(pickColor(cfg.theme.text.meta === 'accent' ? computedAccent : (computedText.meta as string), cfg.theme.text.meta === 'accent'))
              }}>
                {cfg.fields.pausedText || "Paused"}
              </div>
            )}
          </>
        ) : isTop ? (
          <>
            {cfg.layout.showArt && imgUrl && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imgUrl} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: cfg.layout.artRadius ?? 12, justifySelf: (cfg.layout.align === 'center' ? 'center' : 'start'), boxShadow: dropShadows?.getAlbumArtShadow() }} />
                {isEffectivelyPaused && cfg.fields.pausedMode === "label" && (
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
        {cfg.fields.title && (
                <ScrollText
                  style={{ fontWeight: (cfg.theme.textStyle?.title?.bold ? 700 : 400), fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, textShadow: dropShadows?.getTitleTextShadow(pickColor((effectiveCfg.theme.text.title === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.title as string) : (effectiveCfg.theme.text.title as string)), effectiveCfg.theme.text.title === 'accent')) }}
          color={pickColor((effectiveCfg.theme.text.title === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.title as string) : (effectiveCfg.theme.text.title as string)), effectiveCfg.theme.text.title === 'accent')}
                  text={title}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.artist && (
                <ScrollText
                  style={{ opacity: .95, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, textShadow: dropShadows?.getArtistTextShadow(pickColor((effectiveCfg.theme.text.artist === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.artist as string) : (effectiveCfg.theme.text.artist as string)), effectiveCfg.theme.text.artist === 'accent')) }}
                  color={pickColor((effectiveCfg.theme.text.artist === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.artist as string) : (effectiveCfg.theme.text.artist as string)), effectiveCfg.theme.text.artist === 'accent')}
                  text={artist}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.album && (
                <ScrollText
                  style={{ opacity: .85, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.album ?? 12, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, textShadow: dropShadows?.getAlbumTextShadow(pickColor((effectiveCfg.theme.text.album === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.album as string) : (effectiveCfg.theme.text.album as string)), effectiveCfg.theme.text.album === 'accent')) }}
                  color={pickColor((effectiveCfg.theme.text.album === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.album as string) : (effectiveCfg.theme.text.album as string)), effectiveCfg.theme.text.album === 'accent')}
                  text={album}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.progress && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 6, background: "#ffffff30", borderRadius: 4, overflow: "hidden", boxShadow: dropShadows?.getProgressBarShadow() }}>
                    <div style={{ height: "100%", width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                  </div>
                  {cfg.fields.duration && cfg.fields.showDurationOnProgress && (
                    <div style={{
                      fontSize: cfg.theme.textSize?.duration ?? 12,
                      fontWeight: (cfg.theme.textStyle?.duration?.bold ? 700 : 400),
                      fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                      textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                      opacity: 0.8,
                      marginTop: 4,
                      transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                      color: pickColor((cfg.theme.text.duration === 'accent') ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'),
                      textShadow: dropShadows?.getDurationTextShadow(pickColor((cfg.theme.text.duration === 'accent') ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'))
                    }}>
                      {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                    </div>
                  )}
                </div>
              )}
              {cfg.fields.duration && cfg.fields.showDurationAsText && (
                <div style={{
                  fontSize: cfg.theme.textSize?.duration ?? 12,
                  fontWeight: (cfg.theme.textStyle?.duration?.bold ? 700 : 400),
                  fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                  textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                  opacity: 0.8,
                  marginTop: 4,
                  transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                  color: pickColor((cfg.theme.text.duration === 'accent') ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'),
                  textShadow: dropShadows?.getDurationTextShadow(pickColor((cfg.theme.text.duration === 'accent') ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'))
                }}>
                  {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                </div>
              )}
            </div>
            {!cfg.layout.showArt && isEffectivelyPaused && cfg.fields.pausedMode === "label" && (
              <div style={{
                fontSize: cfg.theme.textSize?.meta ?? 12,
                opacity: .8,
                color: pickColor(cfg.theme.text.meta === 'accent' ? computedAccent : (computedText.meta as string), cfg.theme.text.meta === 'accent'),
                transform: `translate(${cfg.layout.textOffset?.meta.x ?? 0}px, ${(cfg.layout.textOffset?.meta.y ?? 0)}px)`,

                textShadow: dropShadows?.getMetaTextShadow(pickColor(cfg.theme.text.meta === 'accent' ? computedAccent : (computedText.meta as string), cfg.theme.text.meta === 'accent'))
              }}>
                {cfg.fields.pausedText || "Paused"}
              </div>
            )}
          </>
        ) : (
          <>
            {cfg.layout.showArt && imgUrl && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imgUrl} alt="" style={{ width: cfg.layout.artSize, height: cfg.layout.artSize, objectFit: "cover", borderRadius: cfg.layout.artRadius ?? 12, justifySelf: 'start', boxShadow: dropShadows?.getAlbumArtShadow() }} />
                {isEffectivelyPaused && cfg.fields.pausedMode === "label" && (
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
              {cfg.fields.title && (
                <ScrollText
                  style={{ fontWeight: (cfg.theme.textStyle?.title?.bold ? 700 : 400), fontStyle: (cfg.theme.textStyle?.title?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.title?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.title?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.title ?? 16, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`, textShadow: dropShadows?.getTitleTextShadow(pickColor((effectiveCfg.theme.text.title === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.title as string) : (effectiveCfg.theme.text.title as string)), effectiveCfg.theme.text.title === 'accent')) }}
                  color={pickColor((effectiveCfg.theme.text.title === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.title as string) : (effectiveCfg.theme.text.title as string)), effectiveCfg.theme.text.title === 'accent')}
                  text={title}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.artist && (
                <ScrollText
                  style={{ opacity: .95, fontWeight: (cfg.theme.textStyle?.artist?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.artist?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.artist?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.artist?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.artist ?? 14, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`, textShadow: dropShadows?.getArtistTextShadow(pickColor((effectiveCfg.theme.text.artist === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.artist as string) : (effectiveCfg.theme.text.artist as string)), effectiveCfg.theme.text.artist === 'accent')) }}
                  color={pickColor((effectiveCfg.theme.text.artist === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.artist as string) : (effectiveCfg.theme.text.artist as string)), effectiveCfg.theme.text.artist === 'accent')}
                  text={artist}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.album && (
                <ScrollText
                  style={{ opacity: .85, fontWeight: (cfg.theme.textStyle?.album?.bold ? 600 : 400), fontStyle: (cfg.theme.textStyle?.album?.italic ? 'italic' : 'normal'), textDecoration: `${cfg.theme.textStyle?.album?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.album?.strike ? ' line-through' : ''}`, fontSize: cfg.theme.textSize?.album ?? 12, marginBottom: cfg.layout.textGap ?? 2, transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`, textShadow: dropShadows?.getAlbumTextShadow(pickColor((effectiveCfg.theme.text.album === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.album as string) : (effectiveCfg.theme.text.album as string)), effectiveCfg.theme.text.album === 'accent')) }}
                  color={pickColor((effectiveCfg.theme.text.album === 'accent') ? computedAccent : (effectiveCfg.theme.autoFromArt ? (computedText.album as string) : (effectiveCfg.theme.text.album as string)), effectiveCfg.theme.text.album === 'accent')}
                  text={album}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
        {cfg.fields.progress && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 6, background: "#ffffff30", borderRadius: 4, overflow: "hidden", boxShadow: dropShadows?.getProgressBarShadow() }}>
            <div style={{ height: "100%", width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                  </div>
                  {cfg.fields.duration && cfg.fields.showDurationOnProgress && (
                    <div style={{
                      fontSize: cfg.theme.textSize?.duration ?? 12,
                      fontWeight: (cfg.theme.textStyle?.duration?.bold ? 700 : 400),
                      fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                      textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                      opacity: 0.8,
                      marginTop: 4,
                      transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                      color: pickColor((cfg.theme.text.duration === 'accent') ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'),
                      textShadow: dropShadows?.getDurationTextShadow(pickColor((cfg.theme.text.duration === 'accent') ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'))
                    }}>
                      {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                    </div>
                  )}
                </div>
              )}
              {cfg.fields.duration && cfg.fields.showDurationAsText && (
                <div style={{
                  fontSize: cfg.theme.textSize?.duration ?? 12,
                  fontWeight: (cfg.theme.textStyle?.duration?.bold ? 700 : 400),
                  fontStyle: (cfg.theme.textStyle?.duration?.italic ? 'italic' : 'normal'),
                  textDecoration: `${cfg.theme.textStyle?.duration?.underline ? 'underline ' : ''}${cfg.theme.textStyle?.duration?.strike ? ' line-through' : ''}`,
                  opacity: 0.8,
                  marginTop: 4,
                  transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                  color: pickColor((cfg.theme.text.duration === 'accent') ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'),
                  textShadow: dropShadows?.getDurationTextShadow(pickColor((cfg.theme.text.duration === 'accent') ? computedAccent : (cfg.theme.autoFromArt ? (computedText.duration as string) : (cfg.theme.text.duration as string)), cfg.theme.text.duration === 'accent'))
                }}>
                  {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                </div>
              )}
            </div>
            {!cfg.layout.showArt && isEffectivelyPaused && cfg.fields.pausedMode === "label" && (
              <div style={{
                fontSize: cfg.theme.textSize?.meta ?? 12,
                opacity: .8,
                color: pickColor(cfg.theme.text.meta === 'accent' ? computedAccent : (computedText.meta as string), cfg.theme.text.meta === 'accent'),
                transform: `translate(${cfg.layout.textOffset?.meta.x ?? 0}px, ${(cfg.layout.textOffset?.meta.y ?? 0)}px)`,

                textShadow: dropShadows?.getMetaTextShadow(pickColor(cfg.theme.text.meta === 'accent' ? computedAccent : (computedText.meta as string), cfg.theme.text.meta === 'accent'))
              }}>
                {cfg.fields.pausedText || "Paused"}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
