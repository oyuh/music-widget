<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { CSS_MAX, encodeConfig } from "$lib/config";
  import { demoConfig, elementNames, moveElement, recipes } from "./playground";

  let cfg = $state(demoConfig());
  let selected = $state("title");
  let paused = $state(false);
  let frame = $state<HTMLIFrameElement>();
  let ready = $state(false);
  let message = $state("");
  const element = $derived(cfg.v2!.elements[selected]);
  const css = $derived(cfg.experimental!.css);
  const editorUrl = $derived(`/#${encodeConfig(cfg)}`);

  $effect(() => {
    const hash = page.url.hash;
    if (hash.startsWith("#css=")) {
      try {
        cfg.experimental!.css = decodeURIComponent(hash.slice(5)).slice(0, CSS_MAX);
        cfg.experimental!.enabled = true;
        message = "Example loaded. Edit the CSS to try it.";
      } catch { message = "This example link is invalid. Choose a recipe below."; }
    }
  });

  $effect(() => {
    const config = $state.snapshot(cfg);
    if (ready) frame?.contentWindow?.postMessage({ type: "wiki-preview", cfg: config, selected, paused }, window.location.origin);
  });

  onMount(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.type === "wiki-ready") ready = true;
      if (event.data?.type === "wiki-select" && event.data.id in elementNames) selected = event.data.id;
      if (event.data?.type === "wiki-move") moveElement(cfg, event.data.id, event.data.x, event.data.y);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  });

  function nudge(x: number, y: number) { moveElement(cfg, selected, element.x + x, element.y + y); }
  function keyMove(event: KeyboardEvent) {
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, number[]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) { event.preventDefault(); nudge(moves[event.key][0], moves[event.key][1]); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(css); message = "CSS copied. Paste it into the editor's Custom CSS panel."; }
    catch { message = "Select the CSS below and copy it manually."; }
  }
  function reset() { cfg = demoConfig(); selected = "title"; paused = false; message = "Playground reset."; }
</script>

<section class="wiki-playground" aria-label="Interactive widget playground">
  <div class="wiki-playground-toolbar"><span class="wiki-eyebrow">Live preview <span>/</span> Sample track</span><button onclick={reset}>Reset all</button></div>
  <div class="wiki-preview-stage">
    <iframe bind:this={frame} src="/wiki-preview" title="Draggable sample widget preview" onload={() => ready = true}></iframe>
    <span class="wiki-preview-caption">420 × 160 px <span>Drag an element to move it</span></span>
  </div>
  <div class="wiki-position-controls">
    <label>Element<select bind:value={selected}>{#each Object.entries(elementNames) as [id, name]}<option value={id}>{name}</option>{/each}</select></label>
    <label>X <span>px</span><input type="number" value={element.x} min="0" max={cfg.layout.w - (element.w ?? 0)} oninput={(e) => moveElement(cfg, selected, e.currentTarget.valueAsNumber, element.y)} /></label>
    <label>Y <span>px</span><input type="number" value={element.y} min="0" max={cfg.layout.h - (element.h ?? 0)} oninput={(e) => moveElement(cfg, selected, element.x, e.currentTarget.valueAsNumber)} /></label>
    <div class="wiki-nudge" role="group" aria-label="Move selected element">
      <button aria-label="Move left" onkeydown={keyMove} onclick={() => nudge(-10, 0)}>←</button><button aria-label="Move up" onkeydown={keyMove} onclick={() => nudge(0, -10)}>↑</button><button aria-label="Move down" onkeydown={keyMove} onclick={() => nudge(0, 10)}>↓</button><button aria-label="Move right" onkeydown={keyMove} onclick={() => nudge(10, 0)}>→</button>
    </div>
    <button class="wiki-pause" aria-pressed={paused} onclick={() => paused = !paused}>{paused ? "Resume sample" : "Pause sample"}</button>
  </div>
  <p class="wiki-control-hint">Arrow buttons move 10 px. Focus one and use your keyboard arrows for 1 px, or Shift + arrow for 10 px.</p>
  <div class="wiki-css-controls"><label for="wiki-recipe">Start with a recipe<select id="wiki-recipe" value="" onchange={(e) => { cfg.experimental!.css = recipes[Number(e.currentTarget.value)].css; cfg.experimental!.enabled = true; message = "Recipe loaded."; e.currentTarget.value = ""; }}><option value="" disabled>Choose a CSS example</option>{#each recipes as recipe, i}<option value={i}>{recipe.name}</option>{/each}</select></label><label class="wiki-checkbox"><input type="checkbox" bind:checked={cfg.experimental!.enabled} />Apply CSS</label></div>
  <div class="wiki-code-bar"><label for="wiki-css">custom.css</label><div><span>{css.length} / {CSS_MAX}</span><button onclick={copy}>Copy CSS</button></div></div>
  <textarea id="wiki-css" class="wiki-css-input" bind:value={cfg.experimental!.css} maxlength={CSS_MAX} spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="wiki-css-help"></textarea>
  <div class="wiki-playground-bottom"><p id="wiki-css-help">Changes apply as you type. Use <code>!important</code> to override editor styles. <a href="/wiki/custom-css">Selector reference →</a></p><a class="wiki-editor-link" href={editorUrl}>Use this design ↗</a></div>
  <p class="wiki-playground-message" role="status">{message || "Sample data only. Your saved widget stays untouched until you open this design in the editor."}</p>
</section>
