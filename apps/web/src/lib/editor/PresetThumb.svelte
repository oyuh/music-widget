<script lang="ts">
  import {
    applyTextTransform,
    BOLD_WEIGHT,
    formatDurationText,
    kindOf,
    resolveTextProps,
    V2_TEXT_IDS,
    type V2Element,
    type V2ElementId,
    type V2TextId,
    type WidgetConfig,
  } from "$lib/config";
  import { elementShadowCSS, resolveLayout, type Measured } from "$lib/v2-layout";
  import { applyAccentBrightness } from "$lib/colors";

  // Static mini-render of a preset config, mirroring WidgetV2's render path
  // (real snap-resolved layout, fonts, colors, shadows) with the editor
  // canvas's placeholder track — so a thumbnail looks like the canvas will
  // after applying the preset. No marquee, animations, or art fetches.

  // Same placeholder content the editor canvas shows before a real track loads
  // (see +page.svelte), including its purple→pink→amber sample art.
  const SAMPLE: Record<Exclude<V2TextId, "duration">, string> = {
    title: "Song Title",
    artist: "Artist Name",
    album: "Album Name",
  };
  const SAMPLE_ART = "linear-gradient(135deg,#7c3aed 0%,#db2777 55%,#f59e0b 100%)";
  // Dominant color WidgetV2's auto-from-art extraction derives from that art.
  const SAMPLE_ART_ACCENT = "#e03070";
  // Same demo playback position the canvas passes when nothing is live.
  const SAMPLE_PROGRESS_MS = 63000;
  const SAMPLE_DURATION_MS = 180000;

  const isText = (id: V2ElementId): boolean => (V2_TEXT_IDS as readonly string[]).includes(kindOf(id));

  // Shared offscreen context for text measurement (feeds auto-sized snaps).
  let measureCtx: CanvasRenderingContext2D | null = null;
  function textWidth(text: string, font: string): number {
    measureCtx ??= document.createElement("canvas").getContext("2d");
    if (!measureCtx) return text.length * 8;
    measureCtx.font = font;
    return measureCtx.measureText(text).width;
  }

  let { config }: { config: WidgetConfig } = $props();

  let frameW = $state(0);
  let frameH = $state(0);

  // Re-measure once the preset's Google Fonts finish loading.
  let fontsReady = $state(false);
  $effect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) fontsReady = true;
    });
    return () => {
      cancelled = true;
    };
  });

  const els = $derived(config.v2?.elements);

  const accent = $derived(
    config.theme.autoFromArt
      ? applyAccentBrightness(SAMPLE_ART_ACCENT, config.theme)
      : config.theme.accent || config.fallbackAccent || "#1db954",
  );
  const resolveColor = (c: string | undefined, fallback?: string) =>
    c === "accent" ? (accent ?? fallback ?? "#ffffff") : (c ?? "#ffffff");

  function sampleText(id: V2ElementId): string {
    const kind = kindOf(id) as V2TextId;
    const raw =
      kind === "duration"
        ? formatDurationText(SAMPLE_PROGRESS_MS, SAMPLE_DURATION_MS, config.fields.durationFormat ?? "both")
        : SAMPLE[kind];
    return applyTextTransform(raw, resolveTextProps(config, id).transform);
  }

  function fontCss(id: V2ElementId): { size: number; family: string; style: string; weight: number } {
    const r = resolveTextProps(config, id);
    return {
      size: r.size,
      family: r.family,
      style: r.italic ? "italic" : "normal",
      weight: r.bold ? BOLD_WEIGHT[kindOf(id) as V2TextId] : 400,
    };
  }

  const boxes = $derived.by(() => {
    if (!els) return null;
    void fontsReady; // re-resolve once real fonts arrive
    const measured: Measured = {};
    for (const id of Object.keys(els).filter(isText)) {
      const f = fontCss(id);
      measured[id] = {
        w: Math.ceil(textWidth(sampleText(id), `${f.style} ${f.weight} ${f.size}px ${f.family}`)),
        h: Math.round(f.size * 1.2),
      };
    }
    return resolveLayout(config.v2!, measured);
  });

  const designW = $derived(boxes?.background.w ?? config.layout.w);
  const designH = $derived(boxes?.background.h ?? config.layout.h);
  const scale = $derived(frameW && frameH ? Math.min(frameW / designW, frameH / designH) : 0);

  // Visible, z-ordered children like WidgetV2 (pause is skipped: the canvas
  // placeholder renders as "playing", where the pause symbol is hidden).
  const childIds = $derived(
    els
      ? Object.keys(els)
          .filter((id) => id !== "background" && kindOf(id) !== "pause" && els[id].visible)
          .sort((a, b) => els[a].z - els[b].z)
      : [],
  );

  /** Solid fill for a background instance (the blurred art is its own layer). */
  function bgColorOf(bg: V2Element): string {
    const fill = bg.fill ?? "color";
    if (fill === "none" || fill === "art") return "transparent";
    if (fill === "accent") {
      const o = (bg.fillOpacity ?? 100) / 100;
      return o >= 1 ? accent : `color-mix(in srgb, ${accent} ${o * 100}%, transparent)`;
    }
    return resolveColor(bg.color, bg.fallbackColor);
  }

  /** Tint layer color for a background instance, or "" when it has none. */
  function tintOf(bg: V2Element): string {
    const t = bg.tint;
    if (!t || !(t.opacity > 0)) return "";
    const c = resolveColor(t.color, bg.fallbackColor);
    const o = Math.min(100, t.opacity) / 100;
    return o >= 1 ? c : `color-mix(in srgb, ${c} ${o * 100}%, transparent)`;
  }

  const containerBg = $derived(els ? bgColorOf(els.background) : "transparent");

  function textStyleCss(id: V2ElementId, el: V2Element, color: string): string {
    const f = fontCss(id);
    const r = resolveTextProps(config, id);
    const deco = `${r.underline ? "underline " : ""}${r.strike ? " line-through" : ""}`.trim();
    const sh = elementShadowCSS(el.shadow, color);
    return [
      `font-family:${f.family}`,
      `font-size:${f.size}px`,
      `font-style:${f.style}`,
      `font-weight:${f.weight}`,
      `text-decoration:${deco || "none"}`,
      `color:${color}`,
      "white-space:nowrap",
      el.w != null ? "overflow:hidden;text-overflow:ellipsis" : "",
      sh ? `text-shadow:${sh}` : "",
    ]
      .filter(Boolean)
      .join(";");
  }

  function posCss(id: V2ElementId, el: V2Element): string {
    const b = boxes![id];
    const parts = [`left:${b.x}px`, `top:${b.y}px`, `z-index:${el.z}`];
    if (el.w != null) parts.push(`width:${b.w}px`);
    if (el.h != null) parts.push(`height:${b.h}px`);
    return parts.join(";");
  }
</script>

<!-- Blurred sample art + tint, mirroring the live widget's background layers. -->
{#snippet bgLayers(bg: V2Element)}
  {@const radius = bg.radius ?? 16}
  {@const tint = tintOf(bg)}
  {#if (bg.fill ?? "color") === "art" && bg.visible}
    <div class="absolute inset-0 overflow-hidden" style="border-radius:{radius}px;z-index:0">
      <div
        class="absolute inset-0"
        style="background:{SAMPLE_ART};transform:scale(1.18);filter:blur(18px);opacity:{(bg.fillOpacity ?? 100) / 100}"
      ></div>
    </div>
  {/if}
  {#if tint}
    <div class="absolute inset-0" style="border-radius:{radius}px;background:{tint};z-index:0"></div>
  {/if}
{/snippet}

<div
  class="canvas-checker relative h-14 w-full overflow-hidden rounded-md border border-border/60"
  bind:clientWidth={frameW}
  bind:clientHeight={frameH}
  aria-hidden="true"
>
  {#if els && boxes && scale}
    <div
      class="pointer-events-none absolute top-1/2 left-1/2 select-none"
      style="width:{designW}px;height:{designH}px;transform:translate(-50%,-50%) scale({scale});border-radius:{els
        .background.radius ?? 16}px;background:{containerBg};font-family:'{config.theme
        .font}', ui-sans-serif, system-ui;{elementShadowCSS(els.background.shadow, containerBg)
        ? `box-shadow:${elementShadowCSS(els.background.shadow, containerBg)}`
        : ''}"
    >
      {@render bgLayers(els.background)}

      {#each childIds as id (id)}
        {@const el = els[id]}
        {@const kind = kindOf(id)}
        {#if kind === "background"}
          <div
            class="absolute overflow-hidden"
            style="{posCss(id, el)};border-radius:{el.radius ?? 16}px;background:{bgColorOf(el)}"
          >
            {@render bgLayers(el)}
          </div>
        {:else if kind === "art"}
          <div
            class="absolute"
            style="{posCss(id, el)};border-radius:{el.radius ?? 6}px;background:{SAMPLE_ART};{elementShadowCSS(
              el.shadow,
              '#ffffff',
            )
              ? `box-shadow:${elementShadowCSS(el.shadow, '#ffffff')}`
              : ''}"
          ></div>
        {:else if kind === "progress"}
          {@const progColor = resolveColor(el.color, el.fallbackColor)}
          {@const sh = elementShadowCSS(el.shadow, progColor)}
          <div class="absolute" style="{posCss(id, el)};opacity:{(el.fillOpacity ?? 100) / 100}">
            <div
              style="width:100%;height:100%;background:#ffffff30;border-radius:{el.radius ?? 4}px;overflow:hidden;{sh
                ? `box-shadow:${sh}`
                : ''}"
            >
              <div
                style="height:100%;width:{(SAMPLE_PROGRESS_MS / SAMPLE_DURATION_MS) * 100}%;background:{progColor}"
              ></div>
            </div>
          </div>
        {:else if isText(id)}
          {@const color = resolveColor(el.color, el.fallbackColor)}
          <div
            class="absolute"
            style="{posCss(id, el)};text-align:{el.anchor === 'center'
              ? 'center'
              : el.anchor === 'right'
                ? 'right'
                : 'left'};{el.w != null ? 'overflow:hidden' : ''}"
          >
            <div style={textStyleCss(id, el, color)}>{sampleText(id)}</div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
