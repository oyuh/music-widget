<script lang="ts">
  import ScrollText from "./ScrollText.svelte";
  import MotionStack from "./MotionStack.svelte";
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
    type V2SwitchAnim,
    type V2TextId,
    type WidgetConfig,
  } from "./config";
  import { applyAccentBrightness, hexToRgb } from "./colors";
  import type { PresentedArt } from "./track-presenter.svelte";
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
  import {
    customAnimationCss,
    hasLetterAnimation,
    splitGraphemes,
    type MotionState,
  } from "./animations";

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

  const v2 = $derived(cfg.v2!);
  // ---- which image renders ----
  // The TrackPresenter (via Widget.svelte) has already loaded, decoded, and
  // color-read the cover, and fallen back to the configured fallback image when
  // the cover won't load, so this only has to paint what it was handed.
  const imgUrl = $derived(artwork.src);
  const imgCors = $derived(artwork.cors ? "anonymous" : undefined);

  // ---- accent color ----
  // When "auto from art" is on, the accent is the album's dominant color;
  // otherwise it's the configured accent. Only elements whose color is "accent"
  // follow it; every other element keeps its own explicit color. Art colors get
  // re-lit to the theme's target brightness (derived, so the slider re-lights
  // live); hand-picked accents and fallbacks are deliberate and pass through.
  const computedAccent = $derived(
    !cfg.theme.autoFromArt
      ? cfg.theme.accent
      : artwork.color
        ? applyAccentBrightness(artwork.color, cfg.theme)
        : cfg.fallbackAccent || cfg.theme.accent || "#1db954",
  );
  // True when "auto from art" is on but no color could be read from the art; in
  // that state elements set to "accent" use their per-element fallback color.
  const accentFailed = $derived(!!cfg.theme.autoFromArt && artwork.colorFailed);

  // Render the art while it's loading or good; only hide it on a confirmed failure.
  const showArt = $derived(artwork.state !== "failed");
  // When the art is gone (no URL OR a URL that won't load) we re-anchor anything snapped
  // to it to a WIDGET edge, so text flushes hard left/right instead of floating where the
  // art used to be. Applies in the editor too so you can preview it.
  const artGone = $derived(v2.elements.art.visible && artwork.state === "failed");

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
      const artUnavailable = !v2.elements.art.visible || artwork.state === "failed";
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
  const pauseAvailable = $derived(
    (cfg.fields.pausedMode ?? "label") === "label" && v2.elements.pause?.visible && !v2.legacyPause,
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
  const bgHasPlaybackMotion = $derived(
    !!bgEl.animations?.some((animation) => animation.trigger === "playback"),
  );
  const animateWidgetVisibility = $derived(pausedTransparent && bgHasPlaybackMotion);
  const containerBg = $derived(
    !preview && wouldHide && !animateWidgetVisibility ? "transparent" : bgColorOf(bgEl),
  );

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
      `opacity:${!preview && wouldHide && !animateWidgetVisibility ? 0 : 1}`,
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
  const customCss = $derived(
    [
      customCssActive(cfg) ? scopeCss(cfg.experimental!.css) : "",
      customAnimationCss(v2.customAnimations),
    ]
      .filter(Boolean)
      .join("\n"),
  );
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
  const motionState = $derived<MotionState>({
    trackKey,
    playing: preview && pausedTransparent ? true : !isEffectivelyPaused,
    preview,
  });
  // The legacy song transition remounts the complete layer. Keep motion actions
  // mounted once an element uses the new system so playback transitions stay
  // interruptible and retain their previous state.
  const hasElementAnimations = $derived(
    Object.values(v2.elements).some((element) => !!element.animations?.length),
  );
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

  // New per-element motion must stay mounted across song changes. Animate the
  // stable parent layer with the old setting so both systems can run together.
  function stableSwitch(node: HTMLElement, initial: { trackKey: string; animation: V2SwitchAnim }) {
    let previousTrack = initial.trackKey;
    let active: Animation | null = null;

    const update = (next: { trackKey: string; animation: V2SwitchAnim }) => {
      if (next.trackKey === previousTrack) return;
      previousTrack = next.trackKey;
      active?.cancel();
      active = null;
      const animation = next.animation;
      if (animation.type === "none" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const easing =
        (easings as Record<string, (t: number) => number>)[animation.easing] ?? easings.cubicOut;
      const frames = Array.from({ length: 31 }, (_, index) => {
        const progress = index / 30;
        const eased = easing(progress);
        if (animation.type === "fade") return { opacity: eased };
        const distance = 16 * (1 - eased);
        const transform =
          animation.direction === "up"
            ? `translate3d(0,${distance}px,0)`
            : animation.direction === "down"
              ? `translate3d(0,${-distance}px,0)`
              : animation.direction === "left"
                ? `translate3d(${distance}px,0,0)`
                : `translate3d(${-distance}px,0,0)`;
        return { transform };
      });
      active = node.animate(frames, { duration: animation.durationMs });
    };

    return {
      update,
      destroy() {
        active?.cancel();
      },
    };
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
        crossorigin={imgCors}
        src={imgUrl}
        alt=""
        decoding="sync"
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

{#snippet artPaint(id: V2ElementId)}
  {@const artStroke = strokeOf(id)}
  {@const artSh = elementShadowCSS(v2.elements[id].shadow, "#000000", artStroke?.outward ?? 0)}
  <img
    crossorigin={imgCors}
    src={imgUrl}
    alt=""
    decoding="sync"
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
{/snippet}

{#snippet pausePaint(id: V2ElementId)}
  {@const pColor = resolveColor(v2.elements[id].color, v2.elements[id].fallbackColor)}
  {@const pStroke = strokeOf(id)}
  {@const pSh = elementShadowCSS(v2.elements[id].shadow, pColor, pStroke?.outward ?? 0)}
  {@const pW = boxes[id].w || 24}
  {@const barW = Math.max(2, Math.round(pW * 0.3))}
  {@const barGap = Math.max(2, Math.round(pW * 0.16))}
  <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:{barGap}px">
    <div style="width:{barW}px;height:100%;background:{pColor};border-radius:2px;{pSh ? `box-shadow:${pSh};` : ''}{pStroke ? pStroke.box : ''}"></div>
    <div style="width:{barW}px;height:100%;background:{pColor};border-radius:2px;{pSh ? `box-shadow:${pSh};` : ''}{pStroke ? pStroke.box : ''}"></div>
  </div>
{/snippet}

{#snippet progressPaint(id: V2ElementId)}
  {@const progColor = resolveColor(v2.elements[id].color, v2.elements[id].fallbackColor)}
  {@const progStroke = strokeOf(id)}
  {@const sh = elementShadowCSS(v2.elements[id].shadow, progColor, progStroke?.outward ?? 0)}
  <div
    style="width:100%;height:100%;background:#ffffff30;border-radius:{v2.elements[id].radius ??
      4}px;overflow:hidden;{sh ? `box-shadow:${sh};` : ''}{progStroke ? progStroke.box : ''}"
  >
    <div
      style="height:100%;width:{Math.max(0, Math.min(100, percent))}%;background:{progColor};transition:width 120ms linear"
    ></div>
  </div>
{/snippet}

{#snippet textPaint(id: V2ElementId)}
  {@const el = v2.elements[id]}
  {@const color = resolveColor(el.color, el.fallbackColor)}
  {@const fixed = el.w != null}
  {@const escape = !!el.shadow?.enabled && !!el.shadow?.escape}
  {@const shadowCss = elementShadowCSS(el.shadow, color)}
  {@const filterShadow = !!shadowCss && (escape || !!strokeOf(id))}
  {@const pad = strokePad(id)}
  {@const textStyle =
    textCss(id, color, !filterShadow) +
    (pad ? `;padding:${pad}px` : "") +
    (filterShadow && !escape ? `;filter:drop-shadow(${shadowCss})` : "")}
  {@const parts = hasLetterAnimation(el.animations) ? splitGraphemes(textContent(id)) : undefined}
  {#if el.scroll?.enabled}
    <ScrollText
      text={textContent(id)}
      {parts}
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
      {#if parts}
        {#each parts as part, index (`${index}:${part}`)}
          <span data-motion-letter={index} style="display:inline-block;white-space:pre">{part}</span>
        {/each}
      {:else}
        {textContent(id)}
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet childrenLayer()}
  {#each childIds as id (id)}
    {@const kind = kindOf(id)}
    {@const element = v2.elements[id]}
    {@const animations = element.animations}
    {#if kind === "background"}
      <!-- Extra backgrounds are ordinary z-ordered boxes. -->
      {@const bgStroke = strokeOf(id)}
      {@const bgSh = elementShadowCSS(element.shadow, bgColorOf(element) || "#000000", bgStroke?.outward ?? 0)}
      {#if animations?.length}
        <div data-el={id} use:measure={id} style={posStyle(id)}>
          <MotionStack {id} {animations} customAnimations={v2.customAnimations} state={motionState}>
            <div
              style="width:100%;height:100%;position:relative;border-radius:{element.radius ??
                16}px;background:{bgColorOf(element)};overflow:hidden;{bgSh ? `box-shadow:${bgSh};` : ''}{bgStroke ? bgStroke.box : ''}"
            >
              {@render bgLayers(element)}
            </div>
          </MotionStack>
        </div>
      {:else}
        <div
          data-el={id}
          use:measure={id}
          style="{posStyle(id)};border-radius:{element.radius ?? 16}px;background:{bgColorOf(
            element,
          )};overflow:hidden;{bgSh ? `box-shadow:${bgSh};` : ''}{bgStroke ? bgStroke.box : ''}"
        >
          {@render bgLayers(element)}
        </div>
      {/if}
    {:else if kind === "art"}
      {#if showArt}
        <div data-el={id} use:measure={id} style={posStyle(id)}>
          {#if animations?.length}
            <MotionStack {id} {animations} customAnimations={v2.customAnimations} state={motionState}>
              {@render artPaint(id)}
            </MotionStack>
          {:else}
            {@render artPaint(id)}
          {/if}
        </div>
      {/if}
    {:else if kind === "pause"}
      {#if animations?.length && pauseAvailable}
        <div data-el={id} use:measure={id} style={posStyle(id)}>
          <MotionStack
            {id}
            {animations}
            customAnimations={v2.customAnimations}
            state={motionState}
            shown={showPauseSymbol}
            visibilityTrigger="paused"
          >
            {@render pausePaint(id)}
          </MotionStack>
        </div>
      {:else if showPauseSymbol}
        <div data-el={id} use:measure={id} style={posStyle(id)}>
          {@render pausePaint(id)}
        </div>
      {/if}
    {:else if kind === "progress"}
      <div
        data-el={id}
        use:measure={id}
        style="{posStyle(id)};opacity:{(element.fillOpacity ?? 100) / 100}"
      >
        {#if animations?.length}
          <MotionStack {id} {animations} customAnimations={v2.customAnimations} state={motionState}>
            {@render progressPaint(id)}
          </MotionStack>
        {:else}
          {@render progressPaint(id)}
        {/if}
      </div>
    {:else if isText(id)}
      {@const anchor = element.anchor === "center" ? "center" : element.anchor === "right" ? "right" : "left"}
      {@const fixed = element.w != null}
      {@const escape = !!element.shadow?.enabled && !!element.shadow?.escape}
      {@const shadowCss = elementShadowCSS(element.shadow, resolveColor(element.color, element.fallbackColor))}
      <div
        data-el={id}
        use:measure={id}
        style="{posStyle(id, false)};text-align:{anchor};{escape && shadowCss
          ? `overflow:visible;filter:drop-shadow(${shadowCss})`
          : fixed
            ? 'overflow:hidden'
            : ''}"
      >
        {#if animations?.length}
          <MotionStack
            {id}
            {animations}
            customAnimations={v2.customAnimations}
            state={motionState}
            fill={fixed}
          >
            {@render textPaint(id)}
          </MotionStack>
        {:else}
          {@render textPaint(id)}
        {/if}
      </div>
    {/if}
  {/each}
{/snippet}

{#snippet widgetFrame()}
  <div style={containerStyle} data-el="background">
    {@render bgLayers(bgEl)}
    {#if hasElementAnimations}
      <div
        class="v2-layer"
        style="position:absolute;inset:0;pointer-events:none"
        use:stableSwitch={{ trackKey, animation: v2.switchAnim }}
      >
        {@render childrenLayer()}
      </div>
    {:else}
      {#key trackKey}
        <div class="v2-layer" in:switchIn style="position:absolute;inset:0;pointer-events:none">
          {@render childrenLayer()}
        </div>
      {/key}
    {/if}
  </div>
{/snippet}

<div class="relative {CSS_SCOPE}" style:visibility={pending ? "hidden" : undefined}>
  {#if bgEl.animations?.length}
    <MotionStack
      id="background"
      animations={bgEl.animations}
      customAnimations={v2.customAnimations}
      state={motionState}
      shown={preview || !wouldHide}
      visibilityTrigger="playback"
      fill={false}
    >
      {@render widgetFrame()}
    </MotionStack>
  {:else}
    {@render widgetFrame()}
  {/if}
</div>
