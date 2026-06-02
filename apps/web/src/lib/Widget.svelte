<script lang="ts">
  import ScrollText from "./ScrollText.svelte";
  import {
    applyTextTransform,
    formatDurationText,
    getTextFont,
    type WidgetConfig,
  } from "./config";
  import {
    extractDominantColor,
    generateDropShadowCSS,
    generateElementDropShadowCSS,
    getReadableTextOn,
  } from "./colors";

  type TextEl = "title" | "artist" | "album" | "meta" | "duration";

  interface Props {
    cfg: WidgetConfig;
    isLive?: boolean;
    isPaused?: boolean;
    percent?: number;
    progressMs?: number;
    durationMs?: number | null;
    title?: string;
    artist?: string;
    album?: string;
    /** Raw album-art URL; the widget proxies + color-extracts it. */
    art?: string;
    /** Editor mode: never hide on transparent/paused, show a hidden hint instead. */
    preview?: boolean;
  }

  let {
    cfg,
    isLive = false,
    isPaused = false,
    percent = 0,
    progressMs = 0,
    durationMs = null,
    title = "—",
    artist = "—",
    album = "",
    art = "",
    preview = false,
  }: Props = $props();

  const artSrc = $derived((art || "").trim());

  // ---- album art -> proxied blob URL ----
  let imgUrl = $state("");
  $effect(() => {
    const src = artSrc;
    let active = true;
    let obj: string | null = null;
    (async () => {
      if (!src) {
        imgUrl = "";
        return;
      }
      // data:/blob: URLs (editor sample art) are already local — use directly.
      if (/^(data|blob):/i.test(src)) {
        imgUrl = src;
        return;
      }
      try {
        const r = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
        if (!r.ok) {
          if (active) imgUrl = "";
          return;
        }
        const b = await r.blob();
        const u = URL.createObjectURL(b);
        if (!active) {
          URL.revokeObjectURL(u);
          return;
        }
        obj = u;
        imgUrl = u;
      } catch {
        if (active) imgUrl = "";
      }
    })();
    return () => {
      active = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  });

  // ---- auto-from-art colors ----
  let computedText = $state<Record<TextEl, string>>({
    title: "#ffffff",
    artist: "#ffffff",
    album: "#ffffff",
    meta: "#ffffff",
    duration: "#ffffff",
  });
  let computedAccent = $state("#1db954");
  let lastExtractedColor: string | null = null;
  let lastImageUrl = "";

  $effect(() => {
    const auto = cfg.theme.autoFromArt;
    const bg = cfg.theme.bg;
    const bgEnabled = cfg.theme.bgEnabled ?? true;
    const fallbackAccent = cfg.fallbackAccent || cfg.theme.accent;
    const source = imgUrl || artSrc;
    let cancelled = false;

    (async () => {
      if (!auto) {
        computedText = { ...cfg.theme.text };
        computedAccent = cfg.theme.accent;
        lastExtractedColor = null;
        lastImageUrl = "";
        return;
      }
      if (!source) {
        computedText = { title: "#fff", artist: "#fff", album: "#fff", meta: "#fff", duration: "#fff" };
        computedAccent = fallbackAccent;
        lastExtractedColor = null;
        lastImageUrl = "";
        return;
      }
      if (source === lastImageUrl && lastExtractedColor) return;

      const color = await extractDominantColor(source);
      if (cancelled) return;

      if (color) {
        const textColor = bgEnabled ? getReadableTextOn(bg) : "#ffffff";
        computedText = { title: textColor, artist: textColor, album: textColor, meta: textColor, duration: textColor };
        computedAccent = color;
        lastExtractedColor = color;
        lastImageUrl = source;
      } else if (source !== lastImageUrl) {
        computedText = { title: "#fff", artist: "#fff", album: "#fff", meta: "#fff", duration: "#fff" };
        computedAccent = fallbackAccent;
        lastExtractedColor = null;
        lastImageUrl = source;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  // Re-extract straight off the rendered <img> for reliability.
  function onArtLoad(e: Event) {
    if (!cfg.theme.autoFromArt) return;
    const el = e.currentTarget as HTMLImageElement;
    try {
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(el, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      const counts = new Map<string, number>();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        const key = `${Math.round(data[i] / 16) * 16},${Math.round(data[i + 1] / 16) * 16},${Math.round(data[i + 2] / 16) * 16}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      let max = 0;
      let best = "255,255,255";
      for (const [k, v] of counts) if (v > max) ((max = v), (best = k));
      const [r, g, b] = best.split(",").map(Number);
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      const textColor = (cfg.theme.bgEnabled ?? true) ? getReadableTextOn(cfg.theme.bg) : "#ffffff";
      computedText = { title: textColor, artist: textColor, album: textColor, meta: textColor, duration: textColor };
      computedAccent = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch {
      /* ignore */
    }
  }

  // ---- layout ----
  const bgEnabled = $derived(cfg.theme.bgEnabled ?? true);
  const pausedTransparent = $derived((cfg.fields.pausedMode ?? "label") === "transparent");
  const isEffectivelyPaused = $derived(!isLive || isPaused);
  const wouldHide = $derived(isEffectivelyPaused && pausedTransparent);
  const showImage = $derived(cfg.layout.showArt && !!imgUrl);
  const artPos = $derived(cfg.layout.artPosition);
  const isTop = $derived(showImage && artPos === "top");
  const forceWhite = $derived(wouldHide || !bgEnabled);
  const alignClass = $derived(
    cfg.layout.align === "center" ? "text-center" : cfg.layout.align === "right" ? "text-right" : "text-left",
  );

  function pickColor(el: TextEl): string {
    const configured = cfg.theme.text[el];
    const isAccent = configured === "accent";
    const desired = isAccent
      ? computedAccent
      : cfg.theme.autoFromArt
        ? (computedText[el] as string)
        : (configured as string);
    if (isAccent) return desired;
    if (!bgEnabled) return "#ffffff";
    return forceWhite ? "#ffffff" : desired;
  }

  function boxShadow(base: string): string | undefined {
    const ds = cfg.theme.dropShadow;
    if (!ds?.enabled) return undefined;
    return generateDropShadowCSS(ds, base) || undefined;
  }
  function elShadow(el: TextEl, color: string): string | undefined {
    const ds = cfg.theme.dropShadow;
    if (!ds?.enabled || !ds.targets?.text) return undefined;
    return generateElementDropShadowCSS(ds, ds.perText?.[el], color) || undefined;
  }

  const boldWeight: Record<TextEl, number> = { title: 700, artist: 600, album: 600, meta: 600, duration: 700 };
  const baseOpacity: Partial<Record<TextEl, number>> = { artist: 0.95, album: 0.85, duration: 0.8 };
  const defaultSize: Record<TextEl, number> = { title: 16, artist: 14, album: 12, meta: 12, duration: 11 };

  function textStyle(el: TextEl): string {
    const t = cfg.theme;
    const st = t.textStyle?.[el];
    const off = cfg.layout.textOffset?.[el] ?? { x: 0, y: 0 };
    const color = pickColor(el);
    const deco = `${st?.underline ? "underline " : ""}${st?.strike ? " line-through" : ""}`.trim();
    const parts = [
      `font-family:${getTextFont(el, cfg)}`,
      `font-size:${t.textSize?.[el] ?? defaultSize[el]}px`,
      `margin-bottom:${cfg.layout.textGap ?? 2}px`,
      `transform:translate(${off.x ?? 0}px, ${off.y ?? 0}px)`,
      `font-style:${st?.italic ? "italic" : "normal"}`,
      `font-weight:${st?.bold ? boldWeight[el] : 400}`,
      `text-decoration:${deco || "none"}`,
    ];
    if (baseOpacity[el] != null) parts.push(`opacity:${baseOpacity[el]}`);
    const sh = elShadow(el, color);
    if (sh) parts.push(`text-shadow:${sh}`);
    return parts.join(";");
  }

  function durationStyle(): string {
    const t = cfg.theme;
    const st = t.textStyle?.duration;
    const off = cfg.layout.textOffset?.duration ?? { x: 0, y: 0 };
    const color = pickColor("duration");
    const deco = `${st?.underline ? "underline " : ""}${st?.strike ? " line-through" : ""}`.trim();
    const parts = [
      `font-size:${t.textSize?.duration ?? 11}px`,
      `font-weight:${st?.bold ? 700 : 400}`,
      `font-style:${st?.italic ? "italic" : "normal"}`,
      `text-decoration:${deco || "none"}`,
      "opacity:0.8",
      "margin-top:4px",
      `transform:translate(${off.x ?? 0}px, ${off.y ?? 0}px)`,
      `color:${color}`,
    ];
    const sh = elShadow("duration", color);
    if (sh) parts.push(`text-shadow:${sh}`);
    return parts.join(";");
  }

  const containerStyle = $derived(
    [
      `width:${cfg.layout.w}px`,
      `height:${cfg.layout.h}px`,
      "display:grid",
      `grid-template-columns:${!showImage ? "1fr" : isTop ? "1fr" : artPos === "right" ? "1fr auto" : "auto 1fr"}`,
      `grid-template-rows:${isTop ? "auto 1fr" : "auto"}`,
      "gap:12px",
      `background:${wouldHide ? "transparent" : bgEnabled ? cfg.theme.bg : "transparent"}`,
      forceWhite ? "color:#ffffff" : "",
      "padding:12px",
      `border-radius:${cfg.layout.backgroundRadius ?? 16}px`,
      `font-family:'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system`,
      "align-items:center",
      cfg.layout.align === "center" ? "justify-items:center" : "",
      `opacity:${!preview && wouldHide ? 0 : 1}`,
      boxShadow(cfg.theme.bg) && cfg.theme.dropShadow?.targets?.background ? `box-shadow:${boxShadow(cfg.theme.bg)}` : "",
    ]
      .filter(Boolean)
      .join(";"),
  );

  const dur = $derived(formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both"));
</script>

{#snippet artEl(justify: string)}
  {#if cfg.layout.showArt && imgUrl}
    <div data-el="art" style="position:relative;display:inline-block">
      <img
        src={imgUrl}
        alt=""
        onload={onArtLoad}
        style="width:{cfg.layout.artSize}px;height:{cfg.layout.artSize}px;object-fit:cover;border-radius:{cfg.layout
          .artRadius ?? 12}px;justify-self:{justify};{cfg.theme.dropShadow?.enabled &&
        cfg.theme.dropShadow.targets?.albumArt
          ? `box-shadow:${boxShadow('#000000')}`
          : ''}"
      />
      {#if isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "label"}
        <div
          style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;background:rgba(0,0,0,0.7);border-radius:50%;display:flex;align-items:center;justify-content:center;gap:2px"
        >
          <div style="width:3px;height:8px;background:white;border-radius:1px"></div>
          <div style="width:3px;height:8px;background:white;border-radius:1px"></div>
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet textCol()}
  <div class={alignClass} style="min-width:0">
    {#if cfg.fields.title}
      <ScrollText
        dataEl="title"
        text={applyTextTransform(title, cfg.theme.textTransform?.title ?? "none")}
        color={pickColor("title")}
        style={textStyle("title")}
        minWidthToScroll={cfg.layout.scrollTriggerWidth}
        speedPxPerSec={cfg.marquee?.perText?.title?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
        gapPx={cfg.marquee?.perText?.title?.gapPx ?? cfg.marquee?.gapPx ?? 32}
      />
    {/if}
    {#if cfg.fields.artist}
      <ScrollText
        dataEl="artist"
        text={applyTextTransform(artist, cfg.theme.textTransform?.artist ?? "none")}
        color={pickColor("artist")}
        style={textStyle("artist")}
        minWidthToScroll={cfg.layout.scrollTriggerWidth}
        speedPxPerSec={cfg.marquee?.perText?.artist?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
        gapPx={cfg.marquee?.perText?.artist?.gapPx ?? cfg.marquee?.gapPx ?? 32}
      />
    {/if}
    {#if cfg.fields.album}
      <ScrollText
        dataEl="album"
        text={applyTextTransform(album, cfg.theme.textTransform?.album ?? "none")}
        color={pickColor("album")}
        style={textStyle("album")}
        minWidthToScroll={cfg.layout.scrollTriggerWidth}
        speedPxPerSec={cfg.marquee?.perText?.album?.speedPxPerSec ?? cfg.marquee?.speedPxPerSec ?? 24}
        gapPx={cfg.marquee?.perText?.album?.gapPx ?? cfg.marquee?.gapPx ?? 32}
      />
    {/if}
    {#if cfg.fields.progress}
      <div data-el="progress" style="margin-top:8px">
        <div
          style="height:6px;background:#ffffff30;border-radius:4px;overflow:hidden;{cfg.theme.dropShadow?.enabled &&
          cfg.theme.dropShadow.targets?.progressBar
            ? `box-shadow:${boxShadow('#ffffff30')}`
            : ''}"
        >
          <div style="height:100%;width:{percent}%;background:{computedAccent};transition:width 120ms linear"></div>
        </div>
        {#if cfg.fields.duration && cfg.fields.showDurationOnProgress}
          <div data-el="duration" class={alignClass} style={durationStyle()}>{dur}</div>
        {/if}
      </div>
    {/if}
    {#if cfg.fields.duration && cfg.fields.showDurationAsText}
      <div data-el="duration" class={alignClass} style={durationStyle()}>{dur}</div>
    {/if}
  </div>
{/snippet}

{#snippet pausedNoArt()}
  {#if !cfg.layout.showArt && isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "label"}
    <div
      class={alignClass}
      style="font-size:{cfg.theme.textSize?.meta ?? 12}px;opacity:0.8;color:{pickColor('meta')};transform:translate({cfg
        .layout.textOffset?.meta.x ?? 0}px,{cfg.layout.textOffset?.meta.y ?? 0}px)"
    >
      {cfg.fields.pausedText || "Paused"}
    </div>
  {/if}
{/snippet}

<div class="relative">
  {#if preview && wouldHide}
    <div class="absolute top-1 right-1 z-10 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white">
      Hidden on the live widget
    </div>
  {/if}
  <div style={containerStyle} data-el="background">
    {#if artPos === "right"}
      {@render textCol()}
      {@render artEl("end")}
    {:else}
      {@render artEl(cfg.layout.align === "center" ? "center" : "start")}
      {@render textCol()}
    {/if}
    {@render pausedNoArt()}
  </div>
</div>
