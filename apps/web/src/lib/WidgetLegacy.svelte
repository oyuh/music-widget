<script lang="ts">
  import ScrollText from "./ScrollText.svelte";
  import {
    applyTextTransform,
    formatDurationText,
    getTextFont,
    type WidgetConfig,
  } from "./config";
  import {
    applyAccentBrightness,
    generateDropShadowCSS,
    generateElementDropShadowCSS,
    getReadableTextOn,
  } from "./colors";
  import type { PresentedArt } from "./track-presenter.svelte";

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
    /** The cover as the presenter resolved it (image, CORS mode, and color). */
    artwork: PresentedArt;
    /** Editor mode: never hide on transparent/paused. */
    preview?: boolean;
    /** The first track isn't ready yet: lay out, but don't paint. */
    pending?: boolean;
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
    artwork,
    preview = false,
    pending = false,
  }: Props = $props();

  // ---- album art ----
  // Loaded, decoded, and color-read by the TrackPresenter (via Widget.svelte).
  // A cover that failed still hands over its URL so the art slot keeps its size.
  const imgUrl = $derived(artwork.src);
  const imgCors = $derived(artwork.cors ? "anonymous" : undefined);

  // ---- auto-from-art colors ----
  const uniform = (c: string): Record<TextEl, string> => ({ title: c, artist: c, album: c, meta: c, duration: c });
  const computedText = $derived.by((): Record<TextEl, string> => {
    if (!cfg.theme.autoFromArt) return { ...cfg.theme.text } as Record<TextEl, string>;
    if (!artwork.color) return uniform("#fff");
    return uniform((cfg.theme.bgEnabled ?? true) ? getReadableTextOn(cfg.theme.bg) : "#ffffff");
  });
  // Art colors get re-lit to the theme's target brightness (derived, so the
  // slider re-lights live); the configured accent and fallback pass through.
  const computedAccent = $derived(
    !cfg.theme.autoFromArt
      ? cfg.theme.accent
      : artwork.color
        ? applyAccentBrightness(artwork.color, cfg.theme)
        : cfg.fallbackAccent || cfg.theme.accent || "#1db954",
  );

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
    <div data-el="art" style="position:relative;display:inline-block;justify-self:{justify}">
      <img
        crossorigin={imgCors}
        src={imgUrl}
        alt=""
        decoding="sync"
        style="width:{cfg.layout.artSize}px;height:{cfg.layout.artSize}px;object-fit:cover;border-radius:{cfg.layout
          .artRadius ?? 12}px;{cfg.theme.dropShadow?.enabled && cfg.theme.dropShadow.targets?.albumArt
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
      <div
        data-el="progress"
        style="margin-top:8px;{cfg.layout.progressWidth && cfg.layout.progressWidth > 0
          ? `width:${cfg.layout.progressWidth}px;`
          : ''}transform:translate({cfg.layout.progressOffset?.x ?? 0}px,{cfg.layout.progressOffset?.y ?? 0}px)"
      >
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

<div class="relative" style:visibility={pending ? "hidden" : undefined}>
  <div style={containerStyle} data-el="background">
    {#if artPos === "right"}
      {@render textCol()}
      {@render artEl("end")}
    {:else}
      {@render artEl(artPos === "top" ? "center" : cfg.layout.align === "center" ? "center" : "start")}
      {@render textCol()}
    {/if}
    {@render pausedNoArt()}
  </div>
</div>
