<script lang="ts">
  import ScrollText from "./ScrollText.svelte";
  import {
    applyTextTransform,
    formatDurationText,
    getTextFont,
    V2_ELEMENT_IDS,
    type V2Element,
    type V2ElementId,
    type WidgetConfig,
  } from "./config";
  import { extractDominantColor, hexToRgb } from "./colors";
  import { resolveLayout, elementShadowCSS, type Box, type Measured } from "./v2-layout";
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
  // True when "auto from art" is on but no color could be read from the art , in
  // that state elements set to "accent" use their per-element fallback color.
  let accentFailed = $state(false);

  $effect(() => {
    const auto = cfg.theme.autoFromArt;
    const fallbackAccent = cfg.fallbackAccent || cfg.theme.accent;
    const source = imgUrl || artSrc;
    let cancelled = false;

    (async () => {
      if (!auto) {
        // Not deriving from art , the configured accent is intentional, not a failure.
        computedAccent = cfg.theme.accent;
        accentFailed = false;
        lastExtractedColor = null;
        lastImageUrl = "";
        return;
      }
      if (!source) {
        computedAccent = fallbackAccent;
        accentFailed = true;
        lastExtractedColor = null;
        lastImageUrl = "";
        return;
      }
      if (source === lastImageUrl && lastExtractedColor) return;
      const color = await extractDominantColor(source);
      if (cancelled) return;
      if (color) {
        computedAccent = color;
        accentFailed = false;
        lastExtractedColor = color;
        lastImageUrl = source;
      } else {
        // Extraction failed (art couldn't be fetched / read) , use the configured
        // fallback color instead of leaving a stale or default-green accent.
        computedAccent = fallbackAccent;
        accentFailed = true;
        lastExtractedColor = null;
        lastImageUrl = source;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  // Whether the art image actually loads. We probe the URL with a SEPARATE off-DOM
  // Image (NOT the displayed <img>) so detection is decoupled from rendering: the
  // displayed <img>'s `error` also fires when the {#key} song-switch tears down an
  // in-flight image, which used to hide perfectly good art. The `cancelled` guard
  // drops a stale probe's result once the song (URL) changes.
  type ArtState = "loading" | "ok" | "failed";
  let artState = $state<ArtState>("loading");
  $effect(() => {
    const url = imgUrl;
    if (!url) {
      artState = "failed";
      return;
    }
    artState = "loading";
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) artState = "ok";
    };
    probe.onerror = () => {
      if (!cancelled) artState = "failed";
    };
    probe.src = url;
    // Already cached? onload may not fire , resolve synchronously.
    if (probe.complete && probe.naturalWidth > 0) artState = "ok";
    return () => {
      cancelled = true;
    };
  });
  // Render the art while it's loading or good; only hide it on a confirmed failure.
  const showArt = $derived(artState !== "failed");
  // When the art is gone (no URL OR a URL that won't load) we re-anchor anything snapped
  // to it to a WIDGET edge, so text flushes hard left/right instead of floating where the
  // art used to be. Applies in the editor too so you can preview it.
  const artGone = $derived(v2.elements.art.visible && artState === "failed");

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
      accentFailed = false;
    } catch {
      // Cross-origin art taints the canvas here; that's expected , the $effect above
      // reads the color via a crossorigin request (Last.fm art sends CORS headers),
      // so leave its result alone instead of forcing the fallback.
    }
  }

  // ---- layout resolution (snap-aware) ----
  let measured = $state<Measured>({});

  // Which widget side an element flushes to when the art is gone. Uses the cues the
  // design carries: the SCROLL direction (left/right), else WHICH art edge it snapped to
  // (sat to the art's right => flush left), else the side the art was hugging.
  function goneSide(el: V2Element, artNearLeft: boolean): "left" | "right" {
    const dir = el.scroll?.enabled ? el.scroll.direction : undefined;
    if (dir === "left") return "left";
    if (dir === "right") return "right";
    if (el.snapX?.to === "art") return el.snapX.toEdge === "start" ? "right" : "left";
    return artNearLeft ? "left" : "right";
  }
  // When the art is gone, pull every element that sat on the art's far side over to the
  // matching WIDGET edge, so text/progress flush hard to one side instead of floating in
  // the gap the art left behind. We adjust the RESOLVED boxes, so it works whether an
  // element was snapped to the art OR free-positioned beside it. Elements land at the very
  // edge (free) or the very edge plus their own snap offset (snapped).
  const boxes = $derived.by(() => {
    const raw = resolveLayout(v2, measured);
    let out: Record<V2ElementId, Box> = raw;
    if (artGone) {
      const art = raw.art;
      const widgetW = raw.background.w || 0;
      const artCenter = art.x + art.w / 2;
      const artNearLeft = art.x <= widgetW - (art.x + art.w);
      out = { ...raw } as Record<V2ElementId, Box>;
      for (const id of V2_ELEMENT_IDS) {
        if (id === "art" || id === "background") continue;
        const el = v2.elements[id];
        if (!el.visible) continue;
        const b = raw[id];
        const onFarSide = artNearLeft ? b.x + b.w / 2 >= artCenter : b.x + b.w / 2 <= artCenter;
        if (!onFarSide) continue;
        const off = el.snapX?.to === "art" ? Math.abs(el.snapX.offset ?? 0) : 0;
        out[id] = {
          ...b,
          x: goneSide(el, artNearLeft) === "right" ? Math.max(0, widgetW - b.w - off) : off,
        };
      }
    }

    // Pause symbol fallback: when it rides the album art but the art is hidden or
    // failed to load, sit it just after the title so it isn't stranded in empty space.
    const pauseEl = v2.elements.pause;
    if (pauseEl?.visible) {
      const artUnavailable = !v2.elements.art.visible || artState === "failed";
      const anchoredToArt = pauseEl.snapX?.to === "art" || pauseEl.snapY?.to === "art";
      if (artUnavailable && anchoredToArt && v2.elements.title.visible) {
        if (out === raw) out = { ...raw } as Record<V2ElementId, Box>;
        const t = out.title;
        const p = out.pause;
        out.pause = { ...p, x: Math.round(t.x + t.w + 8), y: Math.round(t.y + t.h / 2 - p.h / 2) };
      }
    }
    return out;
  });

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
  // The pause symbol only shows while paused/stopped, and only in "Show paused" mode.
  const showPauseSymbol = $derived(
    isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "label" && v2.elements.pause?.visible,
  );

  // ---- helpers ----
  /** Resolve the live accent color, honoring a per-element fallback on failure. */
  function accentColor(fallbackColor?: string): string {
    return accentFailed && fallbackColor ? fallbackColor : computedAccent;
  }
  function resolveColor(c: string | undefined, fallbackColor?: string): string {
    return c === "accent" ? accentColor(fallbackColor) : (c ?? "#ffffff");
  }

  // ---- background fill ----
  const bgFill = $derived(v2.elements.background.fill ?? "color");
  const bgFillOpacity = $derived((v2.elements.background.fillOpacity ?? 100) / 100);
  const bgArt = $derived(bgFill === "art" && showArt);

  /** Apply an opacity to a solid color (hex or "accent"). */
  function withOpacity(color: string, opacity: number): string {
    if (opacity >= 1) return color;
    const rgb = hexToRgb(color);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
  }

  const containerBg = $derived(
    (!preview && wouldHide) || bgFill === "none" || bgFill === "art"
      ? "transparent"
      : bgFill === "accent"
        ? withOpacity(accentColor(v2.elements.background.fallbackColor), bgFillOpacity)
        : resolveColor(v2.elements.background.color, v2.elements.background.fallbackColor),
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
    const shBase = bgFill === "accent" ? accentColor(el.fallbackColor) : resolveColor(el.color, el.fallbackColor);
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
            {#if showArt}
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
              </div>
            {/if}
          {:else if id === "pause"}
            {#if showPauseSymbol}
              {@const pColor = resolveColor(v2.elements.pause.color, v2.elements.pause.fallbackColor)}
              {@const pSh = elementShadowCSS(v2.elements.pause.shadow, pColor)}
              {@const pW = boxes.pause.w || 24}
              {@const barW = Math.max(2, Math.round(pW * 0.3))}
              {@const barGap = Math.max(2, Math.round(pW * 0.16))}
              <div data-el="pause" use:measure={"pause"} style={posStyle("pause")}>
                <div
                  style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:{barGap}px"
                >
                  <div style="width:{barW}px;height:100%;background:{pColor};border-radius:2px;{pSh ? `box-shadow:${pSh}` : ''}"></div>
                  <div style="width:{barW}px;height:100%;background:{pColor};border-radius:2px;{pSh ? `box-shadow:${pSh}` : ''}"></div>
                </div>
              </div>
            {/if}
          {:else if id === "progress"}
            {@const progColor = resolveColor(v2.elements.progress.color, v2.elements.progress.fallbackColor)}
            {@const sh = elementShadowCSS(v2.elements.progress.shadow, progColor)}
            <div data-el="progress" use:measure={"progress"} style={posStyle("progress")}>
              <div
                style="width:100%;height:100%;background:#ffffff30;border-radius:{v2.elements.progress.radius ??
                  4}px;overflow:hidden;{sh ? `box-shadow:${sh}` : ''}"
              >
                <div
                  style="height:100%;width:{Math.max(0, Math.min(100, percent))}%;background:{progColor};transition:width 120ms linear"
                ></div>
              </div>
            </div>
          {:else if isText(id)}
            {@const el = v2.elements[id]}
            {@const color = resolveColor(el.color, el.fallbackColor)}
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
