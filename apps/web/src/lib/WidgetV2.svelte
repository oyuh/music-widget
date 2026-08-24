<script lang="ts">
  import ScrollText from "./ScrollText.svelte";
  import {
    applyTextTransform,
    CSS_SCOPE,
    customCssActive,
    formatDurationText,
    kindOf,
    resolveTextProps,
    scopeCss,
    textPropsCss,
    V2_TEXT_IDS,
    type V2Element,
    type V2ElementId,
    type V2TextId,
    type WidgetConfig,
  } from "./config";
  import { applyAccentBrightness, extractDominantColor, hexToRgb } from "./colors";
  import {
    resolveLayout,
    reflowArtGone,
    elementShadowCSS,
    elementStrokeCSS,
    type Box,
    type Measured,
  } from "./v2-layout";
  import { fade, fly } from "svelte/transition";
  import * as easings from "svelte/easing";
  import { untrack } from "svelte";

  // Every check here is on an element's KIND, so "title#2" behaves like a title.
  const isText = (id: V2ElementId): boolean => (V2_TEXT_IDS as readonly string[]).includes(kindOf(id));

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
  const fallbackArt = $derived((v2.elements.art.fallbackArt || "").trim());

  // ---- which image loads ----
  // We probe a URL with a SEPARATE off-DOM Image (NOT the displayed <img>) so
  // detection is decoupled from rendering: the displayed <img>'s `error` also fires
  // when the {#key} song-switch tears down an in-flight image, which used to hide
  // perfectly good art. The `cancelled` guard drops a stale probe's result once the
  // song (URL) changes.
  type ArtState = "loading" | "ok" | "failed";

  function probeInto(url: string, set: (s: ArtState) => void) {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) set("ok");
    };
    probe.onerror = () => {
      if (!cancelled) set("failed");
    };
    probe.src = url;
    // Already cached? onload may not fire, so resolve synchronously.
    if (probe.complete && probe.naturalWidth > 0) set("ok");
    return () => {
      cancelled = true;
    };
  }

  // The song's own cover. Unchanged from before the fallback existed.
  let coverState = $state<ArtState>("loading");
  $effect(() => {
    const url = artSrc;
    if (!url) {
      coverState = "failed";
      return;
    }
    coverState = "loading";
    return probeInto(url, (s) => (coverState = s));
  });

  // The user's fallback image, probed ONLY once the cover is confirmed dead. With
  // no fallback configured `usingFallback` is never true, so `imgUrl` / `artState`
  // below collapse to plain `artSrc` / `coverState`: the original behavior exactly,
  // where the art element just disappears.
  let fbState = $state<ArtState>("loading");
  $effect(() => {
    const url = fallbackArt;
    fbState = "loading";
    if (!url || coverState !== "failed") return;
    return probeInto(url, (s) => (fbState = s));
  });

  const usingFallback = $derived(coverState === "failed" && !!fallbackArt);
  // What actually renders. Everything downstream (accent extraction, the blurred
  // background fill) reads this, so the fallback feeds those too.
  const imgUrl = $derived(usingFallback ? fallbackArt : artSrc);
  const artState = $derived(usingFallback ? fbState : coverState);

  // ---- accent color ----
  // When "auto from art" is on, the accent is the album's dominant color;
  // otherwise it's the configured accent. Only elements whose color is "accent"
  // follow it; every other element keeps its own explicit color.
  // Seed from the user's fallback/accent (not a hardcoded green) so there's no
  // green flash before the first extraction resolves, and a failed fetch lands on
  // the configured fallback instead.
  let rawAccent = $state(untrack(() => cfg.fallbackAccent || cfg.theme.accent || "#1db954"));
  // True only while `rawAccent` is a color read off the album art. Art colors get
  // re-lit to the theme's target brightness; hand-picked accents and fallbacks are
  // deliberate choices and pass through untouched.
  let accentFromArt = $state(false);
  // The accent everything renders with. Derived (not assigned alongside the
  // extraction) so dragging the brightness slider re-lights the current art color
  // immediately, with no re-extraction.
  const computedAccent = $derived(accentFromArt ? applyAccentBrightness(rawAccent, cfg.theme) : rawAccent);
  let lastExtractedColor: string | null = null;
  let lastImageUrl = "";
  // True when "auto from art" is on but no color could be read from the art; in
  // that state elements set to "accent" use their per-element fallback color.
  let accentFailed = $state(false);

  $effect(() => {
    const auto = cfg.theme.autoFromArt;
    const fallbackAccent = cfg.fallbackAccent || cfg.theme.accent;
    const source = imgUrl || artSrc;
    let cancelled = false;

    (async () => {
      if (!auto) {
        // Not deriving from art; the configured accent is intentional, not a failure.
        rawAccent = cfg.theme.accent;
        accentFromArt = false;
        accentFailed = false;
        lastExtractedColor = null;
        lastImageUrl = "";
        return;
      }
      if (!source) {
        rawAccent = fallbackAccent;
        accentFromArt = false;
        accentFailed = true;
        lastExtractedColor = null;
        lastImageUrl = "";
        return;
      }
      if (source === lastImageUrl && lastExtractedColor) return;
      const color = await extractDominantColor(source);
      if (cancelled) return;
      if (color) {
        rawAccent = color;
        accentFromArt = true;
        accentFailed = false;
        lastExtractedColor = color;
        lastImageUrl = source;
      } else {
        // Extraction failed (art couldn't be fetched / read), so use the configured
        // fallback color instead of leaving a stale or default-green accent.
        rawAccent = fallbackAccent;
        accentFromArt = false;
        accentFailed = true;
        lastExtractedColor = null;
        lastImageUrl = source;
      }
    })();

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
      rawAccent = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      accentFromArt = true;
      accentFailed = false;
    } catch {
      // Cross-origin art taints the canvas here; that's expected. The $effect above
      // reads the color via a crossorigin request (Last.fm art sends CORS headers),
      // so leave its result alone instead of forcing the fallback.
    }
  }

  // ---- layout resolution (snap-aware) ----
  let measured = $state<Measured>({});

  // When the art is gone, re-anchor everything snapped to it on the x-axis (see
  // reflowArtGone): near edges flush to the widget edge, fixed widths stretch over
  // the freed space, and snapX followers ride the edge they're anchored to. Pure
  // and derived, so the layout snaps back as soon as the art loads again.
  const boxes = $derived.by(() => {
    const raw = resolveLayout(v2, measured);
    let out: Record<V2ElementId, Box> = artGone ? reflowArtGone(v2, raw) : raw;

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
    isEffectivelyPaused &&
      (cfg.fields.pausedMode ?? "label") === "label" &&
      v2.elements.pause?.visible &&
      !v2.legacyPause,
  );
  // Configs saved before the pause element existed keep the original badge
  // (dark circle on the album art) so their widget doesn't change under them.
  const showLegacyPause = $derived(
    !!v2.legacyPause && isEffectivelyPaused && (cfg.fields.pausedMode ?? "label") === "label",
  );

  // ---- helpers ----
  /** Resolve the live accent color, honoring a per-element fallback on failure. */
  function accentColor(fallbackColor?: string): string {
    return accentFailed && fallbackColor ? fallbackColor : computedAccent;
  }
  function resolveColor(c: string | undefined, fallbackColor?: string): string {
    return c === "accent" ? accentColor(fallbackColor) : (c ?? "#ffffff");
  }

  /** An element's outline CSS, with its own color resolved (so "accent" works). */
  function strokeOf(id: V2ElementId) {
    const el = v2.elements[id];
    return elementStrokeCSS(el.stroke, resolveColor(el.stroke?.color, el.fallbackColor));
  }

  // ---- background fill ----
  /** Apply an opacity to a solid color (hex or "accent"). */
  function withOpacity(color: string, opacity: number): string {
    if (opacity >= 1) return color;
    const rgb = hexToRgb(color);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
  }

  /**
   * The solid color a background instance paints. "art" contributes nothing here
   * because the blurred cover is its own layer (see the bgLayers snippet).
   */
  function bgColorOf(el: V2Element): string {
    const fill = el.fill ?? "color";
    if (fill === "none" || fill === "art") return "transparent";
    if (fill === "accent")
      return withOpacity(accentColor(el.fallbackColor), (el.fillOpacity ?? 100) / 100);
    return resolveColor(el.color, el.fallbackColor);
  }

  /** The tint layer's color, or "" when this background has no tint. */
  function tintOf(el: V2Element): string {
    const t = el.tint;
    if (!t || !(t.opacity > 0)) return "";
    return withOpacity(resolveColor(t.color, el.fallbackColor), Math.min(100, t.opacity) / 100);
  }

  const bgEl = $derived(v2.elements.background);
  const bgFill = $derived(bgEl.fill ?? "color");
  const containerBg = $derived(!preview && wouldHide ? "transparent" : bgColorOf(bgEl));

  // `includeShadow` is false in "escape" mode, where the shadow is rendered as a
  // drop-shadow filter on the (unclipped) wrapper instead of a clipped text-shadow.
  function textCss(id: V2ElementId, color: string, includeShadow = true): string {
    const parts = textPropsCss(resolveTextProps(cfg, id), kindOf(id) as V2TextId, color);
    const sh = elementShadowCSS(v2.elements[id].shadow, color);
    if (includeShadow && sh) parts.push(`text-shadow:${sh}`);
    const stroke = strokeOf(id);
    if (stroke) parts.push(stroke.text);
    return parts.join(";");
  }

  /** Room an element's box must reserve for its outline (0 when there isn't one). */
  function strokePad(id: V2ElementId): number {
    const s = strokeOf(id);
    if (!s) return 0;
    return Math.ceil(isText(id) ? s.textOutward : s.outward);
  }

  /**
   * `padContent` puts the outline's breathing room on the box itself, which is what
   * a 100%-sized child (art, progress, pause) needs to keep its designed size. Text
   * carries the padding on its own text layer instead, because that layer is the one
   * that clips (fixed width, or the marquee's scroll window) and would otherwise
   * slice the outline off mid-glyph, leaving only the half that falls inside the
   * glyph box: a centered outline then looks exactly like an inside one.
   */
  function posStyle(id: V2ElementId, padContent = true): string {
    const b = boxes[id];
    const el = v2.elements[id];
    // Outlines (glyph and box alike) paint outside the content and never affect
    // layout, so the box has to grow around them on purpose. Growing it also keeps
    // the measured size honest, which is what snapping and the editor's selection
    // rectangle read.
    const pad = strokePad(id);
    const parts = [
      "position:absolute",
      `left:${b.x - pad}px`,
      `top:${b.y - pad}px`,
      `z-index:${el.z}`,
      "pointer-events:auto",
    ];
    if (pad && padContent) parts.push(`padding:${pad}px`);
    // Fixed sizes render from the resolved box, not the config: the art-gone
    // reflow can stretch a fixed width over the gap the art left behind.
    // Auto-sized axes stay unset so content keeps sizing itself.
    if (el.w != null) parts.push(`width:${b.w + pad * 2}px`);
    if (el.h != null) parts.push(`height:${b.h + pad * 2}px`);
    return parts.join(";");
  }

  function textContent(id: V2ElementId): string {
    const kind = kindOf(id);
    const raw = kind === "title" ? title : kind === "artist" ? artist : kind === "album" ? album : dur;
    return applyTextTransform(raw, resolveTextProps(cfg, id).transform);
  }

  const dur = $derived(formatDurationText(progressMs, durationMs, cfg.fields.durationFormat ?? "both"));

  // Visible, z-ordered children. Only the PRIMARY background is excluded: it is
  // the frame itself, so it defines the widget's size. Extra background
  // instances are ordinary boxes that stack like anything else.
  const childIds = $derived(
    Object.keys(v2.elements)
      .filter((id) => id !== "background" && v2.elements[id].visible)
      .sort((a, b) => v2.elements[a].z - v2.elements[b].z),
  );

  // ---- background frame ----
  const containerStyle = $derived.by(() => {
    const el = v2.elements.background;
    const b = boxes.background;
    const shBase = bgFill === "accent" ? accentColor(el.fallbackColor) : resolveColor(el.color, el.fallbackColor);
    // An outward outline grows the widget's silhouette, so the drop shadow spreads
    // by the same amount instead of peeking out from under the outline.
    const stroke = strokeOf("background");
    const sh = elementShadowCSS(el.shadow, shBase, stroke?.outward ?? 0);
    return [
      "position:relative",
      `width:${b.w}px`,
      `height:${b.h}px`,
      `border-radius:${el.radius ?? 16}px`,
      `background:${containerBg}`,
      `font-family:'${cfg.theme.font}', ui-sans-serif, system-ui, -apple-system`,
      `opacity:${!preview && wouldHide ? 0 : 1}`,
      sh ? `box-shadow:${sh}` : "",
      stroke ? stroke.box : "",
    ]
      .filter(Boolean)
      .join(";");
  });

  // ---- experimental custom CSS ----
  // Scoped to the widget root, so it can style anything inside the widget and
  // nothing outside it. Every style the editor produces is inline, which wins
  // over a stylesheet: tweaking a setting overrides the custom CSS for that
  // property unless the rule says !important.
  const customCss = $derived(customCssActive(cfg) ? scopeCss(cfg.experimental!.css) : "");
  $effect(() => {
    if (!customCss) return;
    const style = document.createElement("style");
    style.setAttribute("data-mw-custom", "");
    style.textContent = customCss;
    document.head.appendChild(style);
    return () => style.remove();
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

<!--
  The blurred cover and the tint that can darken it. Shared by the frame and by
  any extra background instance, so both look the same wherever they sit.
-->
{#snippet bgLayers(el: V2Element)}
  {@const radius = el.radius ?? 16}
  {@const tint = tintOf(el)}
  {#if (el.fill ?? "color") === "art" && showArt}
    <!-- Blurred album art, scaled to the box width and clipped to its corners. -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden" style="border-radius:{radius}px;z-index:0">
      <img
        src={imgUrl}
        alt=""
        style="position:absolute;left:50%;top:50%;width:100%;height:auto;min-height:100%;transform:translate(-50%,-50%) scale(1.18);filter:blur(18px);object-fit:cover;opacity:{(el.fillOpacity ??
          100) / 100}"
      />
    </div>
  {/if}
  {#if tint}
    <!-- Sits above the fill and below the content, so text stays readable. -->
    <div
      class="pointer-events-none absolute inset-0"
      style="border-radius:{radius}px;background:{tint};z-index:0"
    ></div>
  {/if}
{/snippet}

<div class="relative {CSS_SCOPE}">
  {#if preview && wouldHide}
    <div class="absolute top-1 right-1 z-10 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white">
      Hidden on the live widget
    </div>
  {/if}

  <div style={containerStyle} data-el="background">
    {@render bgLayers(bgEl)}
    {#key trackKey}
      <div class="v2-layer" in:switchIn style="position:absolute;inset:0;pointer-events:none">
        {#each childIds as id (id)}
          {@const kind = kindOf(id)}
          {#if kind === "background"}
            <!-- An extra background: an ordinary z-ordered box, unlike the primary
                 one, which IS the widget frame and so sizes everything else. -->
            {@const bg = v2.elements[id]}
            {@const bgStroke = strokeOf(id)}
            {@const bgSh = elementShadowCSS(bg.shadow, bgColorOf(bg) || "#000000", bgStroke?.outward ?? 0)}
            <div
              data-el={id}
              use:measure={id}
              style="{posStyle(id)};border-radius:{bg.radius ?? 16}px;background:{bgColorOf(
                bg,
              )};overflow:hidden;{bgSh ? `box-shadow:${bgSh};` : ''}{bgStroke ? bgStroke.box : ''}"
            >
              {@render bgLayers(bg)}
            </div>
          {:else if kind === "art"}
            {#if showArt}
              {@const artStroke = strokeOf(id)}
              {@const artSh = elementShadowCSS(v2.elements[id].shadow, "#000000", artStroke?.outward ?? 0)}
              <div data-el={id} use:measure={id} style={posStyle(id)}>
                <img
                  src={imgUrl}
                  alt=""
                  onload={onArtLoad}
                  style="width:100%;height:100%;object-fit:cover;border-radius:{v2.elements[id].radius ??
                    12}px;{artSh ? `box-shadow:${artSh};` : ''}{artStroke ? artStroke.box : ''}"
                />
                {#if showLegacyPause && id === "art"}
                  <div
                    style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;background:rgba(0,0,0,0.7);border-radius:50%;display:flex;align-items:center;justify-content:center;gap:2px"
                  >
                    <div style="width:3px;height:8px;background:white;border-radius:1px"></div>
                    <div style="width:3px;height:8px;background:white;border-radius:1px"></div>
                  </div>
                {/if}
              </div>
            {/if}
          {:else if kind === "pause"}
            {#if showPauseSymbol}
              {@const pColor = resolveColor(v2.elements[id].color, v2.elements[id].fallbackColor)}
              {@const pStroke = strokeOf(id)}
              {@const pSh = elementShadowCSS(v2.elements[id].shadow, pColor, pStroke?.outward ?? 0)}
              {@const pW = boxes[id].w || 24}
              {@const barW = Math.max(2, Math.round(pW * 0.3))}
              {@const barGap = Math.max(2, Math.round(pW * 0.16))}
              <div data-el={id} use:measure={id} style={posStyle(id)}>
                <div
                  style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:{barGap}px"
                >
                  <div style="width:{barW}px;height:100%;background:{pColor};border-radius:2px;{pSh ? `box-shadow:${pSh};` : ''}{pStroke ? pStroke.box : ''}"></div>
                  <div style="width:{barW}px;height:100%;background:{pColor};border-radius:2px;{pSh ? `box-shadow:${pSh};` : ''}{pStroke ? pStroke.box : ''}"></div>
                </div>
              </div>
            {/if}
          {:else if kind === "progress"}
            {@const progColor = resolveColor(v2.elements[id].color, v2.elements[id].fallbackColor)}
            {@const progStroke = strokeOf(id)}
            {@const sh = elementShadowCSS(v2.elements[id].shadow, progColor, progStroke?.outward ?? 0)}
            <div
              data-el={id}
              use:measure={id}
              style="{posStyle(id)};opacity:{(v2.elements[id].fillOpacity ?? 100) / 100}"
            >
              <div
                style="width:100%;height:100%;background:#ffffff30;border-radius:{v2.elements[id].radius ??
                  4}px;overflow:hidden;{sh ? `box-shadow:${sh};` : ''}{progStroke ? progStroke.box : ''}"
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
            <!-- text-shadow traces the bare glyph, so once there's an outline the
                 shadow would read thinner than the letters it sits behind. Switch it
                 to a drop-shadow FILTER, which works off the rendered pixels and so
                 includes the outline. Outside escape mode it goes on the text layer
                 itself, leaving the box free to clip it as before. -->
            {@const filterShadow = !!shadowCss && (escape || !!strokeOf(id))}
            {@const pad = strokePad(id)}
            {@const textStyle =
              textCss(id, color, !filterShadow) +
              (pad ? `;padding:${pad}px` : "") +
              (filterShadow && !escape ? `;filter:drop-shadow(${shadowCss})` : "")}
            <div
              data-el={id}
              use:measure={id}
              style="{posStyle(id, false)};text-align:{anchor};{escape && shadowCss
                ? `overflow:visible;filter:drop-shadow(${shadowCss})`
                : fixed
                  ? 'overflow:hidden'
                  : ''}"
            >
              {#if el.scroll?.enabled}
                <ScrollText
                  text={textContent(id)}
                  {color}
                  style={textStyle}
                  direction={el.scroll.direction}
                  speedPxPerSec={el.scroll.speedPxPerSec}
                  gapPx={el.scroll.gapPx}
                  forceClip={escape}
                />
              {:else}
                <div
                  style="{textStyle};white-space:nowrap;{escape || fixed
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
