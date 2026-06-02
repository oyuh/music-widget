import { decodeConfig, defaultConfig, type WidgetConfig } from "./config";

/**
 * Deep-merge a partial config (from a /w#hash or storage) onto the defaults so
 * older/partial configs render identically to before. Ported from the original
 * w.tsx mergeFromHash so existing widget URLs stay byte-compatible.
 */
export function mergeConfig(partial: Partial<WidgetConfig> | null | undefined): WidgetConfig {
  const p = partial ?? {};
  const d = defaultConfig;

  return {
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
}

export function mergeConfigFromHash(hash: string): WidgetConfig {
  return mergeConfig(decodeConfig(hash));
}
