<script lang="ts">
  import { onDestroy } from "svelte";
  import Widget from "$lib/Widget.svelte";
  import { defaultConfig, type WidgetConfig } from "$lib/config";
  import { mergeConfigFromHash } from "$lib/config-merge";
  import { ensureGoogleFonts } from "$lib/fonts";
  import { NowPlaying } from "$lib/nowplaying.svelte";
  import { resolveApiKey } from "$lib/lastfm-client";
  import { recordWidgetOpen } from "$lib/usage";

  let cfg = $state<WidgetConfig>(defaultConfig);
  const np = new NowPlaying();

  // Decode the config from the URL hash, and react to live hash edits.
  $effect(() => {
    const read = () => {
      cfg = mergeConfigFromHash(window.location.hash);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  });

  // Drive live polling from the configured user (direct Last.fm for public,
  // using a BYOK key when present).
  $effect(() => {
    np.setSource(cfg.lfmUser ?? "", cfg.sessionKey ?? null, resolveApiKey(cfg.apiKey));
  });

  // Load required Google Fonts.
  $effect(() => {
    ensureGoogleFonts(cfg);
  });

  // Record this visitor once per page load; just who's using the site.
  let logged = false;
  $effect(() => {
    const user = cfg.lfmUser ?? "";
    if (logged || !user) return;
    logged = true;
    recordWidgetOpen(user);
  });

  // Transparent page so the widget embeds cleanly as an OBS browser source.
  $effect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.background;
    const prevBody = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = prevHtml;
      body.style.background = prevBody;
    };
  });

  onDestroy(() => np.destroy());

  const isPlaceholder = (u?: string) => !!u && /2a96cbd8b46e442fc41c2b86b821562f/i.test(u);
  const art = $derived.by(() => {
    const imgs = np.track?.image ?? [];
    for (let i = imgs.length - 1; i >= 0; i--) {
      const u = imgs[i]?.["#text"] ?? "";
      if (u && !isPlaceholder(u)) return u;
    }
    return "";
  });
  const title = $derived(np.track?.name ?? "—");
  const artist = $derived(np.track?.artist?.["#text"] ?? "—");
  const album = $derived(np.track?.album?.["#text"] ?? "");
</script>

<svelte:head>
  <title>{cfg.lfmUser ? `${title} · ${artist}` : "Widget"}</title>
</svelte:head>

<Widget
  {cfg}
  isLive={np.isLive}
  isPaused={np.isPaused}
  percent={np.percent}
  progressMs={np.progressMs}
  durationMs={np.durationMs}
  {title}
  {artist}
  {album}
  {art}
/>
