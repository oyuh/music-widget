/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";

import ScrollText from "@/components/ScrollText";
import { extractDominantColor, generateDropShadowCSS, generateElementDropShadowCSS, getReadableTextOn } from "@/utils/colors";
import { applyTextTransform, formatDurationText, getTextFont, type WidgetConfig } from "@/utils/config";

type DropShadows = {
  getTitleTextShadow?: (textColor: string) => string | undefined;
  getArtistTextShadow?: (textColor: string) => string | undefined;
  getAlbumTextShadow?: (textColor: string) => string | undefined;
  getMetaTextShadow?: (textColor: string) => string | undefined;
  getDurationTextShadow?: (textColor: string) => string | undefined;
  getBoxShadow?: (baseColor: string) => string;
  backgroundShadow?: string;
  albumArtShadow?: string;
  progressBarShadow?: string;
};

export function WidgetPreview(props: {
  cfg: WidgetConfig;
  cacheMode: string;
  isLive: boolean;
  isPaused: boolean;
  percent: number;
  progressMs: number;
  durationMs: number | null;
  trackTitle?: string;
  artist?: string;
  album?: string;
  art?: string;
}) {
  const { cfg, cacheMode, isLive, isPaused, percent, progressMs, durationMs, trackTitle, artist, album, art } = props;
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

      // In severe mode, skip the proxy and fetch directly from Last.fm to save Vercel requests
      let finalUrl = "";
      if (cacheMode === "severe") {
        const viaDirect = await tryMakeUrl(artSrc);
        finalUrl = viaDirect || "";
      } else {
        const proxied = `/api/proxy-image?url=${encodeURIComponent(artSrc)}`;
        const viaProxy = await tryMakeUrl(proxied);
        const viaDirect = viaProxy ? null : await tryMakeUrl(artSrc);
        finalUrl = viaProxy || viaDirect || "";
      }

      if (!active) return;
      if (currentObjUrl) URL.revokeObjectURL(currentObjUrl);
      currentObjUrl = finalUrl || null;
      setImgUrl(finalUrl);
    }
    load();
    return () => {
      active = false;
    };
  }, [artSrc, cacheMode]);

  const showImage = cfg.layout.showArt && !!imgUrl;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const grid = useMemo(() => {
    // Match the widget logic exactly: use artPosition for layout, not align
    const artPos = cfg.layout.artPosition;
    const isTop = showImage && artPos === "top";
    if (!showImage) return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "auto" } as const;
    if (isTop) return { display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "auto 1fr", justifyItems: "center" } as const;
    if (artPos === "right") return { display: "grid", gridTemplateColumns: `1fr auto`, gridTemplateRows: "auto", alignItems: "center" } as const;
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
  const dropShadows: DropShadows = useMemo(() => {
    if (!dropShadowConfig?.enabled) return {};

    const getTitleTextShadow = (textColor: string) => {
      if (!dropShadowConfig.targets?.text) return undefined;
      return generateElementDropShadowCSS(dropShadowConfig, dropShadowConfig.perText?.title, textColor);
    };

    const getArtistTextShadow = (textColor: string) => {
      if (!dropShadowConfig.targets?.text) return undefined;
      return generateElementDropShadowCSS(dropShadowConfig, dropShadowConfig.perText?.artist, textColor);
    };

    const getAlbumTextShadow = (textColor: string) => {
      if (!dropShadowConfig.targets?.text) return undefined;
      return generateElementDropShadowCSS(dropShadowConfig, dropShadowConfig.perText?.album, textColor);
    };

    const getMetaTextShadow = (textColor: string) => {
      if (!dropShadowConfig.targets?.text) return undefined;
      return generateElementDropShadowCSS(dropShadowConfig, dropShadowConfig.perText?.meta, textColor);
    };

    const getDurationTextShadow = (textColor: string) => {
      if (!dropShadowConfig.targets?.text) return undefined;
      return generateElementDropShadowCSS(dropShadowConfig, dropShadowConfig.perText?.duration, textColor);
    };

    const getBoxShadow = (baseColor: string) => {
      return generateDropShadowCSS(dropShadowConfig, baseColor);
    };

    return {
      getTitleTextShadow,
      getArtistTextShadow,
      getAlbumTextShadow,
      getMetaTextShadow,
      getDurationTextShadow,
      getBoxShadow,
      backgroundShadow: dropShadowConfig.targets.background ? getBoxShadow(cfg.theme.bg) : "",
      albumArtShadow: dropShadowConfig.targets.albumArt ? getBoxShadow("#000000") : "",
      progressBarShadow: dropShadowConfig.targets.progressBar ? getBoxShadow(computedAccent) : "",
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
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(el, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const counts = new Map<string, number>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2],
            a = data[i + 3];
          if (a < 200) continue;
          const key = `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        let max = 0;
        let best = "255,255,255";
        for (const [k, v] of counts) {
          if (v > max) {
            max = v;
            best = k;
          }
        }
        const [r, g, b] = best.split(",").map(Number);
        const toHex = (n: number) => n.toString(16).padStart(2, "0");
        const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        const textColor = (cfg.theme.bgEnabled ?? true) ? getReadableTextOn(cfg.theme.bg) : "#ffffff";
        setComputedText({ title: textColor, artist: textColor, album: textColor, meta: textColor, duration: textColor });
        setComputedAccent(hex || (cfg.fallbackAccent || cfg.theme.accent));
      } catch {
        // ignore
      }
    };
  }, [cfg.theme.autoFromArt, cfg.theme.bg, cfg.theme.bgEnabled, cfg.fallbackAccent, cfg.theme.accent]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!cfg.theme.autoFromArt) {
        const newText = cfg.theme.text;
        const newAccent = cfg.theme.accent;
        // Only update if actually different to prevent flicker
        setComputedText((prev) => (JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev));
        setComputedAccent((prev) => (prev !== newAccent ? newAccent : prev));
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
        setComputedText((prev) => (JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev));
        setComputedAccent((prev) => (prev !== newAccent ? newAccent : prev));
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
        const textColor = (cfg.theme.bgEnabled ?? true) ? getReadableTextOn(cfg.theme.bg) : "#ffffff";
        const newText = { title: textColor, artist: textColor, album: textColor, meta: textColor, duration: textColor };
        const newAccent = color;

        // Only update if colors actually changed
        setComputedText((prev) => (JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev));
        setComputedAccent((prev) => (prev !== newAccent ? newAccent : prev));

        // Update tracking state
        setLastExtractedColor(color);
        setLastImageUrl(source);
      } else if (source !== lastImageUrl) {
        // Extraction failed for a NEW image: use fallback only if image URL changed
        const newText = { title: "#ffffff", artist: "#ffffff", album: "#ffffff", meta: "#ffffff", duration: "#ffffff" };
        const newAccent = cfg.fallbackAccent || cfg.theme.accent;
        setComputedText((prev) => (JSON.stringify(prev) !== JSON.stringify(newText) ? newText : prev));
        setComputedAccent((prev) => (prev !== newAccent ? newAccent : prev));
        setLastExtractedColor(null);
        setLastImageUrl(source);
      }
      // If extraction failed but image URL is the same, keep current colors (don't flicker to fallback)
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    cfg.theme.autoFromArt,
    cfg.theme.text,
    imgUrl,
    artSrc,
    cfg.theme.accent,
    cfg.fallbackAccent,
    cfg.theme.bg,
    cfg.theme.bgEnabled,
    lastExtractedColor,
    lastImageUrl,
  ]);

  // Enhanced pause detection: consider both Last.fm state and smart pause detection
  const isEffectivelyPaused = !isLive || isPaused;

  return (
    <div className="relative">
      {/* Show hidden indicator when widget would be hidden */}
      {isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "transparent" && (
        <div className="absolute top-1 right-1 z-10 bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">
          WIDGET HIDDEN (Will not show up on the actual widget)
        </div>
      )}
      <div
        className="rounded-2xl p-4 gap-3 items-center"
        style={{
          background: (cfg.theme.bgEnabled ?? true) ? cfg.theme.bg : "transparent",
          width: cfg.layout.w,
          height: cfg.layout.h,
          ...grid,
          fontFamily,
          // No drop shadow when background is disabled
          color: !(cfg.theme.bgEnabled ?? true) ? "#ffffff" : undefined,
          opacity: 1, // Always show in preview, even when would be hidden
          boxShadow: dropShadows.backgroundShadow || undefined,
          borderRadius: cfg.layout.backgroundRadius ?? 16,
        }}
      >
        {/* Match widget rendering logic exactly */}
        {showImage && cfg.layout.artPosition === "right" ? (
          <>
            {/* Right layout: Text first, then art */}
            <div
              className={`${cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left"}`}
              style={{ minWidth: 0 }}
            >
              {cfg.fields.title && (
                <ScrollText
                  className={cfg.theme.textStyle?.title?.bold ? "font-semibold" : undefined}
                  style={{
                    fontFamily: getTextFont("title", cfg),
                    fontSize: cfg.theme.textSize?.title ?? 16,
                    marginBottom: cfg.layout.textGap ?? 2,
                    transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`,
                    fontStyle: cfg.theme.textStyle?.title?.italic ? "italic" : "normal",
                    textDecoration: `${cfg.theme.textStyle?.title?.underline ? "underline " : ""}${cfg.theme.textStyle?.title?.strike ? " line-through" : ""}`,
                    textShadow: dropShadows.getTitleTextShadow
                      ? dropShadows.getTitleTextShadow(
                        cfg.theme.autoFromArt
                          ? cfg.theme.text.title === "accent"
                            ? computedAccent
                            : (computedText.title as string)
                          : cfg.theme.text.title === "accent"
                            ? computedAccent
                            : (cfg.theme.text.title as string)
                      )
                      : undefined,
                  }}
                  color={
                    cfg.theme.autoFromArt
                      ? cfg.theme.text.title === "accent"
                        ? computedAccent
                        : (computedText.title as string)
                      : cfg.theme.text.title === "accent"
                        ? computedAccent
                        : (cfg.theme.text.title as string)
                  }
                  text={applyTextTransform(trackTitle ?? "—", cfg.theme.textTransform?.title ?? "none")}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.artist && (
                <ScrollText
                  style={{
                    fontFamily: getTextFont("artist", cfg),
                    opacity: 0.95,
                    fontSize: cfg.theme.textSize?.artist ?? 14,
                    marginBottom: cfg.layout.textGap ?? 2,
                    transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`,
                    fontStyle: cfg.theme.textStyle?.artist?.italic ? "italic" : "normal",
                    textDecoration: `${cfg.theme.textStyle?.artist?.underline ? "underline " : ""}${cfg.theme.textStyle?.artist?.strike ? " line-through" : ""}`,
                    fontWeight: cfg.theme.textStyle?.artist?.bold ? 600 : 400,
                    textShadow: dropShadows.getArtistTextShadow
                      ? dropShadows.getArtistTextShadow(
                        cfg.theme.autoFromArt
                          ? cfg.theme.text.artist === "accent"
                            ? computedAccent
                            : (computedText.artist as string)
                          : cfg.theme.text.artist === "accent"
                            ? computedAccent
                            : (cfg.theme.text.artist as string)
                      )
                      : undefined,
                  }}
                  color={
                    cfg.theme.autoFromArt
                      ? cfg.theme.text.artist === "accent"
                        ? computedAccent
                        : (computedText.artist as string)
                      : cfg.theme.text.artist === "accent"
                        ? computedAccent
                        : (cfg.theme.text.artist as string)
                  }
                  text={applyTextTransform(artist ?? "—", cfg.theme.textTransform?.artist ?? "none")}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.album && (
                <ScrollText
                  style={{
                    fontFamily: getTextFont("album", cfg),
                    fontSize: cfg.theme.textSize?.album ?? 12,
                    opacity: 0.85,
                    marginBottom: cfg.layout.textGap ?? 2,
                    transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`,
                    fontStyle: cfg.theme.textStyle?.album?.italic ? "italic" : "normal",
                    textDecoration: `${cfg.theme.textStyle?.album?.underline ? "underline " : ""}${cfg.theme.textStyle?.album?.strike ? " line-through" : ""}`,
                    fontWeight: cfg.theme.textStyle?.album?.bold ? 600 : 400,
                    textShadow: dropShadows.getAlbumTextShadow
                      ? dropShadows.getAlbumTextShadow(
                        cfg.theme.autoFromArt
                          ? cfg.theme.text.album === "accent"
                            ? computedAccent
                            : (computedText.album as string)
                          : cfg.theme.text.album === "accent"
                            ? computedAccent
                            : (cfg.theme.text.album as string)
                      )
                      : undefined,
                  }}
                  color={
                    cfg.theme.autoFromArt
                      ? cfg.theme.text.album === "accent"
                        ? computedAccent
                        : (computedText.album as string)
                      : cfg.theme.text.album === "accent"
                        ? computedAccent
                        : (cfg.theme.text.album as string)
                  }
                  text={applyTextTransform(album ?? "", cfg.theme.textTransform?.album ?? "none")}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.progress && (
                <div className="mt-2">
                  <div
                    className="h-1.5 rounded overflow-hidden"
                    style={{
                      background: "#ffffff30",
                      boxShadow:
                        dropShadows.getBoxShadow &&
                        cfg.theme.dropShadow?.enabled &&
                        cfg.theme.dropShadow.targets?.progressBar
                          ? dropShadows.getBoxShadow("#ffffff30")
                          : undefined,
                    }}
                  >
                    <div className="h-full" style={{ width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                  </div>
                  {cfg.fields.duration && cfg.fields.showDurationOnProgress && (
                    <div
                      className={cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left"}
                      style={{
                        fontSize: cfg.theme.textSize?.duration ?? 12,
                        fontWeight: cfg.theme.textStyle?.duration?.bold ? 700 : 400,
                        fontStyle: cfg.theme.textStyle?.duration?.italic ? "italic" : "normal",
                        textDecoration: `${cfg.theme.textStyle?.duration?.underline ? "underline " : ""}${cfg.theme.textStyle?.duration?.strike ? " line-through" : ""}`,
                        opacity: 0.8,
                        marginTop: 4,
                        transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                        color:
                          cfg.theme.autoFromArt
                            ? cfg.theme.text.duration === "accent"
                              ? computedAccent
                              : (computedText.duration as string)
                            : cfg.theme.text.duration === "accent"
                              ? computedAccent
                              : (cfg.theme.text.duration as string),
                      }}
                    >
                      {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                    </div>
                  )}
                </div>
              )}
              {cfg.fields.duration && cfg.fields.showDurationAsText && (
                <div
                  className={cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left"}
                  style={{
                    fontSize: cfg.theme.textSize?.duration ?? 12,
                    fontWeight: cfg.theme.textStyle?.duration?.bold ? 700 : 400,
                    fontStyle: cfg.theme.textStyle?.duration?.italic ? "italic" : "normal",
                    textDecoration: `${cfg.theme.textStyle?.duration?.underline ? "underline " : ""}${cfg.theme.textStyle?.duration?.strike ? " line-through" : ""}`,
                    opacity: 0.8,
                    marginTop: 4,
                    transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                    color:
                      cfg.theme.autoFromArt
                        ? cfg.theme.text.duration === "accent"
                          ? computedAccent
                          : (computedText.duration as string)
                        : cfg.theme.text.duration === "accent"
                          ? computedAccent
                          : (cfg.theme.text.duration as string),
                  }}
                >
                  {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                </div>
              )}
            </div>
            {cfg.layout.showArt && imgUrl && (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  ref={imgRef}
                  src={imgUrl}
                  alt=""
                  style={{
                    width: cfg.layout.artSize,
                    height: cfg.layout.artSize,
                    objectFit: "cover",
                    borderRadius: cfg.layout.artRadius ?? 12,
                    justifySelf: "end",
                    boxShadow:
                      dropShadows.getBoxShadow &&
                      cfg.theme.dropShadow?.enabled &&
                      cfg.theme.dropShadow.targets?.albumArt
                        ? dropShadows.getBoxShadow("#000000")
                        : undefined,
                  }}
                  onLoad={extractFromImgEl}
                />
                {!isLive && cfg.fields.pausedMode === "label" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 24,
                      height: 24,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                    }}
                  >
                    <div style={{ width: "3px", height: "8px", backgroundColor: "white", borderRadius: "1px" }} />
                    <div style={{ width: "3px", height: "8px", backgroundColor: "white", borderRadius: "1px" }} />
                  </div>
                )}
              </div>
            )}
            {!cfg.layout.showArt && !isLive && cfg.fields.pausedMode === "label" && (
              <div
                className={cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left"}
                style={{
                  fontSize: cfg.theme.textSize?.meta ?? 12,
                  opacity: 0.8,
                  color: (computedText as { meta: string }).meta,
                }}
              >
                {cfg.fields.pausedText || "Paused"}
              </div>
            )}
          </>
        ) : (
          <>
            {cfg.layout.showArt && imgUrl && (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  ref={imgRef}
                  src={imgUrl}
                  alt=""
                  style={{
                    width: cfg.layout.artSize,
                    height: cfg.layout.artSize,
                    objectFit: "cover",
                    borderRadius: cfg.layout.artRadius ?? 12,
                    justifySelf: cfg.layout.align === "center" ? "center" : "start",
                    boxShadow:
                      dropShadows.getBoxShadow &&
                      cfg.theme.dropShadow?.enabled &&
                      cfg.theme.dropShadow.targets?.albumArt
                        ? dropShadows.getBoxShadow("#000000")
                        : undefined,
                  }}
                  onLoad={extractFromImgEl}
                />
                {!isLive && cfg.fields.pausedMode === "label" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 24,
                      height: 24,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                    }}
                  >
                    <div style={{ width: "3px", height: "8px", backgroundColor: "white", borderRadius: "1px" }} />
                    <div style={{ width: "3px", height: "8px", backgroundColor: "white", borderRadius: "1px" }} />
                  </div>
                )}
              </div>
            )}
            <div
              className={`${cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left"}`}
              style={{ minWidth: 0 }}
            >
              {cfg.fields.title && (
                <ScrollText
                  className={cfg.theme.textStyle?.title?.bold ? "font-semibold" : undefined}
                  style={{
                    fontFamily: getTextFont("title", cfg),
                    fontSize: cfg.theme.textSize?.title ?? 16,
                    marginBottom: cfg.layout.textGap ?? 2,
                    transform: `translate(${cfg.layout.textOffset?.title.x ?? 0}px, ${(cfg.layout.textOffset?.title.y ?? 0)}px)`,
                    fontStyle: cfg.theme.textStyle?.title?.italic ? "italic" : "normal",
                    textDecoration: `${cfg.theme.textStyle?.title?.underline ? "underline " : ""}${cfg.theme.textStyle?.title?.strike ? " line-through" : ""}`,
                    textShadow: dropShadows.getTitleTextShadow
                      ? dropShadows.getTitleTextShadow(
                        cfg.theme.autoFromArt
                          ? cfg.theme.text.title === "accent"
                            ? computedAccent
                            : (computedText.title as string)
                          : cfg.theme.text.title === "accent"
                            ? computedAccent
                            : (cfg.theme.text.title as string)
                      )
                      : undefined,
                  }}
                  color={
                    cfg.theme.autoFromArt
                      ? cfg.theme.text.title === "accent"
                        ? computedAccent
                        : (computedText.title as string)
                      : cfg.theme.text.title === "accent"
                        ? computedAccent
                        : (cfg.theme.text.title as string)
                  }
                  text={applyTextTransform(trackTitle ?? "—", cfg.theme.textTransform?.title ?? "none")}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.artist && (
                <ScrollText
                  style={{
                    opacity: 0.95,
                    fontFamily: getTextFont("artist", cfg),
                    fontSize: cfg.theme.textSize?.artist ?? 14,
                    marginBottom: cfg.layout.textGap ?? 2,
                    transform: `translate(${cfg.layout.textOffset?.artist.x ?? 0}px, ${(cfg.layout.textOffset?.artist.y ?? 0)}px)`,
                    fontStyle: cfg.theme.textStyle?.artist?.italic ? "italic" : "normal",
                    textDecoration: `${cfg.theme.textStyle?.artist?.underline ? "underline " : ""}${cfg.theme.textStyle?.artist?.strike ? " line-through" : ""}`,
                    fontWeight: cfg.theme.textStyle?.artist?.bold ? 600 : 400,
                    textShadow: dropShadows.getArtistTextShadow
                      ? dropShadows.getArtistTextShadow(
                        cfg.theme.autoFromArt
                          ? cfg.theme.text.artist === "accent"
                            ? computedAccent
                            : (computedText.artist as string)
                          : cfg.theme.text.artist === "accent"
                            ? computedAccent
                            : (cfg.theme.text.artist as string)
                      )
                      : undefined,
                  }}
                  color={
                    cfg.theme.autoFromArt
                      ? cfg.theme.text.artist === "accent"
                        ? computedAccent
                        : (computedText.artist as string)
                      : cfg.theme.text.artist === "accent"
                        ? computedAccent
                        : (cfg.theme.text.artist as string)
                  }
                  text={applyTextTransform(artist ?? "—", cfg.theme.textTransform?.artist ?? "none")}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.album && (
                <ScrollText
                  style={{
                    fontFamily: getTextFont("album", cfg),
                    fontSize: cfg.theme.textSize?.album ?? 12,
                    opacity: 0.85,
                    marginBottom: cfg.layout.textGap ?? 2,
                    transform: `translate(${cfg.layout.textOffset?.album.x ?? 0}px, ${(cfg.layout.textOffset?.album.y ?? 0)}px)`,
                    fontStyle: cfg.theme.textStyle?.album?.italic ? "italic" : "normal",
                    textDecoration: `${cfg.theme.textStyle?.album?.underline ? "underline " : ""}${cfg.theme.textStyle?.album?.strike ? " line-through" : ""}`,
                    fontWeight: cfg.theme.textStyle?.album?.bold ? 600 : 400,
                    textShadow: dropShadows.getAlbumTextShadow
                      ? dropShadows.getAlbumTextShadow(
                        cfg.theme.autoFromArt
                          ? cfg.theme.text.album === "accent"
                            ? computedAccent
                            : (computedText.album as string)
                          : cfg.theme.text.album === "accent"
                            ? computedAccent
                            : (cfg.theme.text.album as string)
                      )
                      : undefined,
                  }}
                  color={
                    cfg.theme.autoFromArt
                      ? cfg.theme.text.album === "accent"
                        ? computedAccent
                        : (computedText.album as string)
                      : cfg.theme.text.album === "accent"
                        ? computedAccent
                        : (cfg.theme.text.album as string)
                  }
                  text={applyTextTransform(album ?? "", cfg.theme.textTransform?.album ?? "none")}
                  minWidthToScroll={cfg.layout.scrollTriggerWidth}
                  speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
                  gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32}
                />
              )}
              {cfg.fields.progress && (
                <div className="mt-2">
                  <div
                    className="h-1.5 rounded overflow-hidden"
                    style={{
                      background: "#ffffff30",
                      boxShadow:
                        dropShadows.getBoxShadow &&
                        cfg.theme.dropShadow?.enabled &&
                        cfg.theme.dropShadow.targets?.progressBar
                          ? dropShadows.getBoxShadow("#ffffff30")
                          : undefined,
                    }}
                  >
                    <div className="h-full" style={{ width: `${percent}%`, background: computedAccent, transition: "width 120ms linear" }} />
                  </div>
                  {cfg.fields.duration && cfg.fields.showDurationOnProgress && (
                    <div
                      className={cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left"}
                      style={{
                        fontSize: cfg.theme.textSize?.duration ?? 12,
                        fontWeight: cfg.theme.textStyle?.duration?.bold ? 700 : 400,
                        fontStyle: cfg.theme.textStyle?.duration?.italic ? "italic" : "normal",
                        textDecoration: `${cfg.theme.textStyle?.duration?.underline ? "underline " : ""}${cfg.theme.textStyle?.duration?.strike ? " line-through" : ""}`,
                        opacity: 0.8,
                        marginTop: 4,
                        transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                        color:
                          cfg.theme.autoFromArt
                            ? cfg.theme.text.duration === "accent"
                              ? computedAccent
                              : (computedText.duration as string)
                            : cfg.theme.text.duration === "accent"
                              ? computedAccent
                              : (cfg.theme.text.duration as string),
                      }}
                    >
                      {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                    </div>
                  )}
                </div>
              )}
              {cfg.fields.duration && cfg.fields.showDurationAsText && (
                <div
                  className={cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left"}
                  style={{
                    fontSize: cfg.theme.textSize?.duration ?? 12,
                    fontWeight: cfg.theme.textStyle?.duration?.bold ? 700 : 400,
                    fontStyle: cfg.theme.textStyle?.duration?.italic ? "italic" : "normal",
                    textDecoration: `${cfg.theme.textStyle?.duration?.underline ? "underline " : ""}${cfg.theme.textStyle?.duration?.strike ? " line-through" : ""}`,
                    opacity: 0.8,
                    marginTop: 4,
                    transform: `translate(${cfg.layout.textOffset?.duration.x ?? 0}px, ${(cfg.layout.textOffset?.duration.y ?? 0)}px)`,
                    color:
                      cfg.theme.autoFromArt
                        ? cfg.theme.text.duration === "accent"
                          ? computedAccent
                          : (computedText.duration as string)
                        : cfg.theme.text.duration === "accent"
                          ? computedAccent
                          : (cfg.theme.text.duration as string),
                  }}
                >
                  {formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both")}
                </div>
              )}
            </div>
            {!cfg.layout.showArt && !isLive && cfg.fields.pausedMode === "label" && (
              <div
                className={cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left"}
                style={{
                  fontSize: cfg.theme.textSize?.meta ?? 12,
                  opacity: 0.8,
                  color: (computedText as { meta: string }).meta,
                }}
              >
                {cfg.fields.pausedText || "Paused"}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
