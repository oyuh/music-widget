<script lang="ts">
  import { onMount } from "svelte";
  import Widget from "$lib/Widget.svelte";
  import { mergeConfig } from "$lib/config-merge";
  import { demoConfig, sampleArt } from "$lib/wiki/playground";

  let cfg = $state(demoConfig());
  let paused = $state(false);
  let width = $state(600);
  let height = $state(260);
  const scale = $derived(Math.min(1, Math.max(0.1, (width - 40) / cfg.layout.w), Math.max(0.1, (height - 40) / cfg.layout.h)));

  onMount(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.type !== "wiki-preview") return;
      cfg = mergeConfig(event.data.cfg);
      paused = !!event.data.paused;
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "wiki-ready" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  });
</script>

<svelte:head><title>Widget example preview</title><meta name="robots" content="noindex" /></svelte:head>
<svelte:window bind:innerWidth={width} bind:innerHeight={height} />
<div class="preview">
  <div class="widget" style:width={`${cfg.layout.w * scale}px`} style:height={`${cfg.layout.h * scale}px`}>
    <div class="widget-scale" style:width={`${cfg.layout.w}px`} style:height={`${cfg.layout.h}px`} style:transform={`scale(${scale})`}>
      <Widget {cfg} preview isLive={!paused} isPaused={paused} title="Late night radio" artist="The night shift" album="Side A · Sample track" art={sampleArt} percent={42} progressMs={83000} durationMs={198000} />
    </div>
  </div>
</div>

<style>
  :global(html), :global(body) { background: transparent; }
  .preview { display: grid; height: 100dvh; place-items: center; overflow: hidden; }
  .widget { position: relative; }
  .widget-scale { transform-origin: top left; }
  @media (prefers-reduced-motion: reduce) { :global(*), :global(*::before), :global(*::after) { animation: none !important; transition: none !important; } }
</style>
