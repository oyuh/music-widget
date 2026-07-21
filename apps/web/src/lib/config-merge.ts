import {
  CSS_MAX,
  decodeConfig,
  defaultConfig,
  migrateToV2,
  V2_ELEMENT_IDS,
  type V2Element,
  type V2ElementId,
  type WidgetConfig,
  type WidgetV2,
} from "./config";

/**
 * Deep-merge a partial config (from a /w#hash or storage) onto the defaults so
 * older/partial configs render identically to before. Ported from the original
 * w.tsx mergeFromHash so existing widget URLs stay byte-compatible.
 */
export function mergeConfig(partial: Partial<WidgetConfig> | null | undefined): WidgetConfig {
  const p = partial ?? {};
  const d = defaultConfig;

  const result: WidgetConfig = {
    ...d,
    ...p,
    theme: {
      ...d.theme,
      ...p.theme,
      text: { ...d.theme.text, ...p.theme?.text },
      textSize: {
        title: p.theme?.textSize?.title ?? d.theme.textSize!.title,
        artist: p.theme?.textSize?.artist ?? d.theme.textSize!.artist,
        album: p.theme?.textSize?.album ?? d.theme.textSize!.album,
        meta: p.theme?.textSize?.meta ?? d.theme.textSize!.meta,
        duration: p.theme?.textSize?.duration ?? d.theme.textSize!.duration,
      },
      textStyle: {
        title: { ...d.theme.textStyle!.title, ...p.theme?.textStyle?.title },
        artist: { ...d.theme.textStyle!.artist, ...p.theme?.textStyle?.artist },
        album: { ...d.theme.textStyle!.album, ...p.theme?.textStyle?.album },
        meta: { ...d.theme.textStyle!.meta, ...p.theme?.textStyle?.meta },
        duration: { ...d.theme.textStyle!.duration, ...p.theme?.textStyle?.duration },
      },
      textTransform: {
        title: p.theme?.textTransform?.title ?? d.theme.textTransform!.title,
        artist: p.theme?.textTransform?.artist ?? d.theme.textTransform!.artist,
        album: p.theme?.textTransform?.album ?? d.theme.textTransform!.album,
        meta: p.theme?.textTransform?.meta ?? d.theme.textTransform!.meta,
        duration: p.theme?.textTransform?.duration ?? d.theme.textTransform!.duration,
      },
      textFont: {
        title: p.theme?.textFont?.title ?? d.theme.textFont?.title,
        artist: p.theme?.textFont?.artist ?? d.theme.textFont?.artist,
        album: p.theme?.textFont?.album ?? d.theme.textFont?.album,
        meta: p.theme?.textFont?.meta ?? d.theme.textFont?.meta,
        duration: p.theme?.textFont?.duration ?? d.theme.textFont?.duration,
      },
      dropShadow: {
        ...d.theme.dropShadow!,
        ...p.theme?.dropShadow,
        targets: { ...d.theme.dropShadow!.targets, ...p.theme?.dropShadow?.targets },
        perText: { ...d.theme.dropShadow!.perText, ...p.theme?.dropShadow?.perText },
      },
    },
    layout: {
      ...d.layout,
      ...p.layout,
      progressOffset: {
        x: p.layout?.progressOffset?.x ?? d.layout.progressOffset?.x ?? 0,
        y: p.layout?.progressOffset?.y ?? d.layout.progressOffset?.y ?? 0,
      },
      textOffset: {
        title: { ...d.layout.textOffset!.title, ...p.layout?.textOffset?.title },
        artist: { ...d.layout.textOffset!.artist, ...p.layout?.textOffset?.artist },
        album: { ...d.layout.textOffset!.album, ...p.layout?.textOffset?.album },
        meta: { ...d.layout.textOffset!.meta, ...p.layout?.textOffset?.meta },
        duration: { ...d.layout.textOffset!.duration, ...p.layout?.textOffset?.duration },
      },
    },
    marquee: {
      speedPxPerSec: p.marquee?.speedPxPerSec ?? d.marquee!.speedPxPerSec,
      gapPx: p.marquee?.gapPx ?? d.marquee!.gapPx,
      perText: p.marquee?.perText ?? d.marquee?.perText,
    },
    fields: { ...d.fields, ...p.fields },
  };

  // Experimental custom CSS: only present once someone opts in, and normalized
  // here because it arrives from a URL hash anyone can hand-edit.
  if (p.experimental) {
    result.experimental = {
      enabled: !!p.experimental.enabled,
      css: String(p.experimental.css ?? "").slice(0, CSS_MAX),
    };
  } else {
    delete result.experimental;
  }

  // v2 designs carry an element-based layout. Build a baseline from the merged
  // legacy fields (so missing pieces are sensible) and overlay the partial v2.
  if (p.version === 2) {
    return { ...result, ...mergeV2(result, p.v2) };
  }
  return result;
}

/** Deep-merge a partial v2 block onto a baseline derived from the legacy fields. */
function mergeV2(legacyMerged: WidgetConfig, pv: WidgetV2 | undefined): Pick<WidgetConfig, "version" | "v2"> {
  const base = migrateToV2(legacyMerged).v2!;
  const elements = {} as Record<V2ElementId, V2Element>;
  for (const id of V2_ELEMENT_IDS) {
    const b = base.elements[id];
    const e: Partial<V2Element> = pv?.elements?.[id] ?? {};
    elements[id] = {
      ...b,
      ...e,
      shadow: e.shadow ? { ...b.shadow, ...e.shadow } : b.shadow,
      scroll: e.scroll ? { ...b.scroll, ...e.scroll } : b.scroll,
      // snapX/snapY can legitimately be null; preserve an explicit value.
      snapX: e.snapX !== undefined ? e.snapX : b.snapX,
      snapY: e.snapY !== undefined ? e.snapY : b.snapY,
    };
  }
  // Configs encoded before the pause element existed carry no `pause` entry.
  // Flag them (recomputed from presence, never trusted from the payload) so the
  // renderer falls back to the original hardcoded pause badge instead of a new
  // pause element the user never set up.
  const legacyPause = pv?.elements?.pause === undefined;
  return {
    version: 2,
    v2: {
      elements,
      switchAnim: { ...base.switchAnim, ...(pv?.switchAnim ?? {}) },
      ...(legacyPause ? { legacyPause: true } : {}),
    },
  };
}

export function mergeConfigFromHash(hash: string): WidgetConfig {
  return mergeConfig(decodeConfig(hash));
}
