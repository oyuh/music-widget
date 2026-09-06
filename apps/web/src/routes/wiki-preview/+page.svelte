<script lang="ts">
  import { onMount } from "svelte";
  import Widget from "$lib/Widget.svelte";
  import { mergeConfig } from "$lib/config-merge";
  import { demoConfig, elementNames, sampleArt } from "$lib/wiki/playground";
  let cfg = $state(demoConfig());
  let selected = $state("title");
  let paused = $state(false);
  let width = $state(600);
  const scale = $derived(Math.min(1, Math.max(0.1, (width - 40) / 420)));
  let drag: { pointer: number; id: string; x: number; y: number; startX: number; startY: number } | null = null;

  function send(data: object) { window.parent.postMessage(data, window.location.origin); }
  onMount(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.type !== "wiki-preview") return;
      cfg = mergeConfig(event.data.cfg);
      selected = event.data.selected in elementNames ? event.data.selected : "title";
      paused = !!event.data.paused;
    };
    window.addEventListener("message", receive);
    send({ type: "wiki-ready" });
    return () => window.removeEventListener("message", receive);
  });
  function start(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;
    const id = (event.target as HTMLElement).closest<HTMLElement>("[data-el]")?.dataset.el;
    if (!id || !(id in elementNames)) return;
    event.preventDefault();
    selected = id;
    const el = cfg.v2!.elements[id];
    drag = { pointer: event.pointerId, id, x: el.x, y: el.y, startX: event.clientX, startY: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    send({ type: "wiki-select", id });
  }
  function move(event: PointerEvent) {
    if (!drag || drag.pointer !== event.pointerId) return;
    send({ type: "wiki-move", id: drag.id, x: drag.x + (event.clientX - drag.startX) / scale, y: drag.y + (event.clientY - drag.startY) / scale });
  }
</script>

<svelte:head><title>Widget playground preview</title><meta name="robots" content="noindex" /></svelte:head>
<svelte:window bind:innerWidth={width} />
<div class="preview">
  <div class="widget" style:width={`${420 * scale}px`} style:height={`${160 * scale}px`}>
    <div role="group" aria-label="Drag widget elements. Position controls are below the preview." class="drag-area" data-selected={selected} style:transform={`scale(${scale})`} onpointerdown={start} onpointermove={move} onpointerup={() => drag = null} onpointercancel={() => drag = null} onlostpointercapture={() => drag = null}>
      <Widget {cfg} preview isLive={!paused} isPaused={paused} title="Late night radio" artist="The night shift" album="Side A · Sample track" art={sampleArt} percent={42} progressMs={83000} durationMs={198000} />
    </div>
  </div>
</div>
<style>
  :global(html), :global(body) { background: transparent; }
  .preview { height: 100dvh; display: grid; place-items: center; overflow: hidden; }
  .widget { position: relative; }
  .drag-area { transform-origin: top left; width: 420px; height: 160px; touch-action: none; user-select: none; }
  .drag-area :global([data-el]:not([data-el="background"])) { cursor: grab; }
  .drag-area:active :global([data-el]) { cursor: grabbing; }
  .drag-area[data-selected="art"] :global([data-el="art"]),
  .drag-area[data-selected="title"] :global([data-el="title"]),
  .drag-area[data-selected="artist"] :global([data-el="artist"]),
  .drag-area[data-selected="album"] :global([data-el="album"]),
  .drag-area[data-selected="progress"] :global([data-el="progress"]),
  .drag-area[data-selected="duration"] :global([data-el="duration"]),
  .drag-area[data-selected="pause"] :global([data-el="pause"]) { outline: 1px dashed #e4e4e7; outline-offset: 4px; }
  @media (prefers-reduced-motion: reduce) { :global(*), :global(*::before), :global(*::after) { animation: none !important; transition: none !important; } }
</style>
