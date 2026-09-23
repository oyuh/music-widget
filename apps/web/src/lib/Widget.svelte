<script lang="ts">
  // Router: legacy grid configs (no version flag) render via WidgetLegacy so
  // widget URLs already pasted into OBS scenes stay pixel-identical; configs
  // tagged version:2 render via the free-positioned WidgetV2 engine.
  //
  // Every surface (the live widget, the editor canvas, the wiki preview) comes
  // through here, so song switches present identically everywhere: the
  // TrackPresenter holds the previous song until the next cover and its color
  // are ready, then both engines receive the whole switch at once.
  import { onDestroy, untrack } from "svelte";
  import WidgetLegacy from "./WidgetLegacy.svelte";
  import WidgetV2 from "./WidgetV2.svelte";
  import { isV2, type WidgetConfig } from "./config";
  import { TrackPresenter, type PresentedArt, type Playback } from "./track-presenter.svelte";

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
    /** Raw album-art URL; the presenter loads it and reads its color. */
    art?: string;
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

  const presenter = new TrackPresenter();
  onDestroy(() => presenter.destroy());

  const fallbackArt = $derived(isV2(cfg) ? (cfg.v2?.elements.art.fallbackArt || "").trim() : "");
  const live = $derived<Playback>({ isLive, isPaused, percent, progressMs, durationMs });

  // Pre-effect: a cover that's already cached commits before this flush paints,
  // so the switch lands in a single frame with no in-between state.
  $effect.pre(() => {
    const input = { title, artist, album, art: (art || "").trim(), fallbackArt };
    const playback = live;
    untrack(() => presenter.feed(input, playback));
  });

  const shown = $derived(presenter.shown);
  const playback = $derived(presenter.holding && presenter.frozen ? presenter.frozen : live);
  // Before the first track is ready the widget is laid out but invisible, so a
  // fresh OBS source never flashes an empty cover or the fallback accent.
  const pendingArt: PresentedArt = { src: "", cors: false, state: "loading", color: null, colorFailed: false };
  const artwork = $derived(shown?.art ?? pendingArt);
</script>

{#snippet engine(Engine: typeof WidgetV2 | typeof WidgetLegacy)}
  <Engine
    {cfg}
    {preview}
    pending={!shown}
    isLive={playback.isLive}
    isPaused={playback.isPaused}
    percent={playback.percent}
    progressMs={playback.progressMs}
    durationMs={playback.durationMs}
    title={shown?.title ?? title}
    artist={shown?.artist ?? artist}
    album={shown?.album ?? album}
    {artwork}
  />
{/snippet}

{#if isV2(cfg)}
  {@render engine(WidgetV2)}
{:else}
  {@render engine(WidgetLegacy)}
{/if}
