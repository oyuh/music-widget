<script lang="ts">
  import ScrollText from "./ScrollText.svelte";
  import {
    applyTextTransform,
    formatDurationText,
    getTextFont,
    V2_ELEMENT_IDS,
    type V2ElementId,
    type WidgetConfig,
  } from "./config";
  import { extractDominantColor, hexToRgb } from "./colors";
  import { resolveLayout, elementShadowCSS, type Measured } from "./v2-layout";
  import { fade, fly } from "svelte/transition";
  import * as easings from "svelte/easing";
  import { untrack } from "svelte";

  type TextId = "title" | "artist" | "album" | "duration";
  const TEXT_IDS: TextId[] = ["title", "artist", "album", "duration"];
  const isText = (id: V2ElementId): id is TextId => (TEXT_IDS as string[]).includes(id);

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
    art?: string;
    /** Editor mode: never hide on transparent/paused; show a hint badge instead. */
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

  const v2 = $derived(cfg.v2!);
  const artSrc = $derived((art || "").trim());
  const imgUrl = $derived(artSrc);

  // ---- accent color ----
  // When "auto from art" is on, the accent is the album's dominant color;
  // otherwise it's the configured accent. Only elements whose color is "accent"
  // follow it , every other element keeps its own explicit color.
  // Seed from the user's fallback/accent (not a hardcoded green) so there's no
  // green flash before the first extraction resolves, and a failed fetch lands on
  // the configured fallback instead.
  let computedAccent = $state(untrack(() => cfg.fallbackAccent || cfg.theme.accent || "#1db954"));
  let lastExtractedColor: string | null = null;
  let lastImageUrl = "";

  $effect(() => {
    const auto = cfg.theme.autoFromArt;
    const fallbackAccent = cfg.fallbackAccent || cfg.theme.accent;
    const source = imgUrl || artSrc;
    let cancelled = false;

    (async () => {
      if (!auto) {
        computedAccent = cfg.theme.accent;
        lastExtractedColor = null;
        lastImageUrl = "";
        return;
      }
      if (!source) {
        computedAccent = fallbackAccent;
        lastExtractedColor = null;
        lastImageUrl = "";
        return;
      }
      if (source === lastImageUrl && lastExtractedColor) return;
      const color = await extractDominantColor(source);
      if (cancelled) return;
      if (color) {
        computedAccent = color;
        lastExtractedColor = color;
        lastImageUrl = source;
      } else {
        // Extraction failed (art couldn't be fetched / read) , use the configured
        // fallback color instead of leaving a stale or default-green accent.
        computedAccent = fallbackAccent;
        lastExtractedColor = null;
        lastImageUrl = source;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

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
      for (const [k, val] of counts) if (val > max) ((max = val), (best = k));
      const [r, g, b] = best.split(",").map(Number);
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      computedAccent = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch {
      // Couldn't read the pixels (e.g. tainted canvas) , fall back to the user color.
      computedAccent = cfg.fallbackAccent || cfg.theme.accent;
    }
  }

  // ---- layout resolution (snap-aware) ----
  let measured = $state<Measured>({});
  const boxes = $derived(resolveLayout(v2, measured));

  // Action: report an element's natural box size so auto-sized + snapped
  // elements resolve correctly. Only writes when the size actually changes
  // (no feedback loop with position).
  function measure(node: HTMLElement, id: V2ElementId) {
    const update = () => {
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const prev = measured[id];
      if (!prev || prev.w !== w || prev.h !== h) measured = { ...measured, [id]: { w, h } };
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return { destroy: () => ro.disconnect() };
  }

  // ---- paused / hide ----
  const pausedTransparent = $derived((cfg.fields.pausedMode ?? "label") === "transparent");
  const isEffectivelyPaused = $derived(!isLive || isPaused);
  const wouldHide = $derived(isEffectivelyPaused && pausedTransparent);

  // ---- helpers ----
  function resolveColor(c: string | undefined): string {
    return c === "accent" ? computedAccent : (c ?? "#ffffff");
  }

  // ---- background fill ----
  const bgFill = $derived(v2.elements.background.fill ?? "color");
  const bgFillOpacity = $derived((v2.elements.background.fillOpacity ?? 100) / 100);
  const bgArt = $derived(bgFill === "art" && !!imgUrl);

  /** Apply an opacity to a solid color (hex or "accent"). */
  function withOpacity(color: string, opacity: number): string {
    if (opacity >= 1) return color;
    const rgb = hexToRgb(color);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
  }

  const containerBg = $derived(
    wouldHide || bgFill === "none" || bgFill === "art"
      ? "transparent"
      : bgFill === "accent"
        ? withOpacity(computedAccent, bgFillOpacity)
        : resolveColor(v2.elements.background.color),
  );

  const boldWeight: Record<TextId, number> = { title: 700, artist: 600, album: 600, duration: 700 };
  const defaultSize: Record<TextId, number> = { title: 16, artist: 14, album: 12, duration: 11 };

  // `includeShadow` is false in "escape" mode, where the shadow is rendered as a
  // drop-shadow filter on the (unclipped) wrapper instead of a clipped text-shadow.
  function textCss(id: TextId, color: string, includeShadow = true): string {
    const t = cfg.theme;
    const st = t.textStyle?.[id];
    const deco = `${st?.underline ? "underline " : ""}${st?.strike ? " line-through" : ""}`.trim();
    const parts = [
      `font-family:${getTextFont(id, cfg)}`,
      `font-size:${t.textSize?.[id] ?? defaultSize[id]}px`,
      `font-style:${st?.italic ? "italic" : "normal"}`,
      `font-weight:${st?.bold ? boldWeight[id] : 400}`,
      `text-decoration:${deco || "none"}`,
      `color:${color}`,
    ];
    const sh = elementShadowCSS(v2.elements[id].shadow, color);
    if (includeShadow && sh) parts.push(`text-shadow:${sh}`);
    return parts.join(";");
  }

  function posStyle(id: V2ElementId): string {
    const b = boxes[id];
    const el = v2.elements[id];
    const parts = [
      "position:absolute",
      `left:${b.x}px`,
      `top:${b.y}px`,
      `z-index:${el.z}`,
      "pointer-events:auto",
    ];
    if (el.w != null) parts.push(`width:${el.w}px`);
    if (el.h != null) parts.push(`height:${el.h}px`);
    return parts.join(";");
  }

  function textContent(id: TextId): string {
    const raw = id === "title" ? title : id === "artist" ? artist : id === "album" ? album : dur;
    return applyTextTransform(raw, cfg.theme.textTransform?.[id] ?? "none");
  }

  const dur = $derived(formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both"));

  // Visible, z-ordered children (background is the frame itself).
  const childIds = $derived(
    V2_ELEMENT_IDS.filter((id) => id !== "background" && v2.elements[id].visible).sort(
      (a, b) => v2.elements[a].z - v2.elements[b].z,
    ),
  );

  // ---- background frame ----
  const containerStyle = $derived.by(() => {
    const el = v2.elements.background;
    const b = boxes.background;
    const shBase = bgFill === "accent" ? computedAccent : resolveColor(el.color);
    const sh = elementShadowCSS(el.shadow, shBase);
    return [
      "position:relative",
      `width:${b.w}px`,
      `height:${b.h}px`,
      `border-radius:${el.radius ?? 16}px`,
      `background:${containerBg}`,
      `font-family:'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system`,
      `opacity:${!preview && wouldHide ? 0 : 1}`,
      sh ? `box-shadow:${sh}` : "",
    ]
      .filter(Boolean)
      .join(";");
  });

  // ---- song-switch animation ----
  const trackKey = $derived(`${title}|${artist}`);
  function switchIn(node: Element) {
    const a = v2.switchAnim;
    const easing = (easings as Record<string, (t: number) => number>)[a.easing] ?? easings.cubicOut;
    if (a.type === "none") return { duration: 0 };
    if (a.type === "fade") return fade(node, { duration: a.durationMs, easing });
    const dist = 16;
    const off =
      a.direction === "up"
        ? { y: dist }
        : a.direction === "down"
          ? { y: -dist }
          : a.direction === "left"
            ? { x: dist }
            : { x: -dist };
    return fly(node, { duration: a.durationMs, easing, ...off });
  }
</script>

<div class="relative">
  {#if preview && wouldHide}
    <div class="absolute top-1 right-1 z-10 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white">
      Hidden on the live widget
    </div>
  {/if}

  <div style={containerStyle} data-el="background">
    {#if bgArt}
      <!-- Blurred album art, scaled to the widget width and clipped to the frame. -->
      <div
        class="pointer-events-none absolute inset-0 overflow-hidden"
        style="border-radius:{v2.elements.background.radius ?? 16}px;z-index:0"
      >
        <img
          src={imgUrl}
          alt=""
          style="position:absolute;left:50%;top:50%;width:100%;height:auto;min-height:100%;transform:translate(-50%,-50%) scale(1.18);filter:blur(18px);object-fit:cover;opacity:{bgFillOpacity}"
        />
      </div>
    {/if}
    {#key trackKey}
      <div class="v2-layer" in:switchIn style="position:absolute;inset:0;pointer-events:none">
        {#each childIds as id (id)}
          {#if id === "art"}
            {#if imgUrl}
              <div data-el="art" use:measure={"art"} style={posStyle("art")}>
                <img
                  src={imgUrl}
                  alt=""
                  onload={onArtLoad}
                  style="width:100%;height:100%;object-fit:cover;border-radius:{v2.elements.art.radius ??
                    12}px;{elementShadowCSS(v2.elements.art.shadow, '#000000')
                    ? `box-shadow:${elementShadowCSS(v2.elements.art.shadow, '#000000')}`
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
          {:else if id === "progress"}
            {@const sh = elementShadowCSS(v2.elements.progress.shadow, resolveColor(v2.elements.progress.color))}
            <div data-el="progress" use:measure={"progress"} style={posStyle("progress")}>
              <div
                style="width:100%;height:100%;background:#ffffff30;border-radius:{v2.elements.progress.radius ??
                  4}px;overflow:hidden;{sh ? `box-shadow:${sh}` : ''}"
              >
                <div
                  style="height:100%;width:{Math.max(0, Math.min(100, percent))}%;background:{resolveColor(
                    v2.elements.progress.color,
                  )};transition:width 120ms linear"
                ></div>
              </div>
            </div>
          {:else if isText(id)}
            {@const el = v2.elements[id]}
            {@const color = resolveColor(el.color)}
            {@const anchor = el.anchor === "center" ? "center" : el.anchor === "right" ? "right" : "left"}
            {@const fixed = el.w != null}
            <!-- "escape" lets the *shadow* spill past the box while the *text* stays
                 clipped: render it as a drop-shadow filter on the unclipped wrapper
                 (drop-shadow isn't clipped by the element's own overflow) and drop
                 the text-shadow. Auto-width text never overflows, so it's left
                 unclipped and just uses a normal text-shadow. -->
            {@const escape = !!el.shadow?.enabled && !!el.shadow?.escape}
            {@const shadowCss = elementShadowCSS(el.shadow, color)}
            <div
              data-el={id}
              use:measure={id}
              style="{posStyle(id)};text-align:{anchor};{escape && shadowCss
                ? `overflow:visible;filter:drop-shadow(${shadowCss})`
                : fixed
                  ? 'overflow:hidden'
                  : ''}"
            >
              {#if el.scroll?.enabled}
                <ScrollText
                  text={textContent(id)}
                  {color}
                  style={textCss(id, color, !escape)}
                  direction={el.scroll.direction}
                  speedPxPerSec={el.scroll.speedPxPerSec}
                  gapPx={el.scroll.gapPx}
                  forceClip={escape}
                />
              {:else}
                <div
                  style="{textCss(id, color, !escape)};white-space:nowrap;{escape || fixed
                    ? 'overflow:hidden;text-overflow:ellipsis'
                    : 'overflow:visible'}"
                >
                  {textContent(id)}
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {/key}
  </div>
</div>
