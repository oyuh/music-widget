<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/state";
  import { CSS_MAX } from "$lib/config";
  import PresetThumb from "$lib/editor/PresetThumb.svelte";
  import { PRESETS } from "$lib/presets";
  import { demoConfig, recipes } from "./playground";

  let cfg = $state(demoConfig());
  let paused = $state(false);
  let frame = $state<HTMLIFrameElement>();
  let ready = $state(false);
  let hashMessage = $state("");
  let copyLabel = $state("Copy CSS");
  let activeTheme = $state("Default");
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const themes = [
    { name: "Default", description: "The editor's starting layout.", config: demoConfig() },
    ...PRESETS.map((preset) => ({ ...preset, description: `Built-in ${preset.name.toLowerCase()} theme.` })),
  ];
  const css = $derived(cfg.experimental!.css);
  const activeRecipe = $derived(recipes.find((recipe) => recipe.css === css)?.id ?? "");

  $effect(() => {
    const hash = page.url.hash;
    if (hash.startsWith("#css=")) {
      try {
        cfg.experimental!.css = decodeURIComponent(hash.slice(5)).slice(0, CSS_MAX);
        cfg.experimental!.enabled = true;
        hashMessage = "Example loaded. Edit the CSS below to try it.";
      } catch {
        hashMessage = "That example link is invalid. Choose a recipe below.";
      }
    }
  });

  $effect(() => {
    const config = $state.snapshot(cfg);
    if (ready) frame?.contentWindow?.postMessage({ type: "wiki-preview", cfg: config, paused }, window.location.origin);
  });

  onMount(() => {
    const receive = (event: MessageEvent) => {
      if (event.source === frame?.contentWindow && event.origin === window.location.origin && event.data?.type === "wiki-ready") ready = true;
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  });

  function applyTheme(theme: (typeof themes)[number]) {
    const customCss = cfg.experimental?.css ?? "";
    const cssEnabled = cfg.experimental?.enabled ?? false;
    cfg = structuredClone(theme.config);
    cfg.lfmUser = "";
    cfg.sessionKey = null;
    cfg.apiKey = "";
    cfg.experimental = { enabled: cssEnabled, css: customCss };
    if (cfg.v2) cfg.v2.switchAnim.type = "none";
    activeTheme = theme.name;
  }

  function applyRecipe(index: number) {
    cfg.experimental!.css = recipes[index].css;
    cfg.experimental!.enabled = true;
    hashMessage = "";
  }

  async function copy() {
    clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(css);
      copyLabel = "Copied";
    } catch {
      copyLabel = "Copy failed";
    }
    copyTimer = setTimeout(() => copyLabel = "Copy CSS", 3000);
  }

  function reset() {
    cfg = demoConfig();
    paused = false;
    activeTheme = "Default";
    hashMessage = "";
  }

  onDestroy(() => clearTimeout(copyTimer));
</script>

<section class="wiki-playground" aria-label="Interactive widget examples">
  <div class="wiki-playground-toolbar">
    <span class="wiki-eyebrow">Sample widget</span>
    <div>
      <label class="wiki-checkbox"><input type="checkbox" bind:checked={paused} />Paused</label>
      <button class="wiki-secondary-button" onclick={reset}>Reset</button>
    </div>
  </div>

  <div class="wiki-preview-stage">
    <iframe bind:this={frame} src="/wiki-preview" title="Sample widget preview" onload={() => ready = true}></iframe>
    <p class="wiki-preview-caption"><span>{cfg.layout.w} × {cfg.layout.h} px</span><span>The preview uses the same renderer as the editor.</span></p>
  </div>

  <fieldset class="wiki-option-section">
    <legend>Preview a theme</legend>
    <p>Choose one of the editor's built-in starting points.</p>
    <div class="wiki-theme-grid">
      {#each themes as theme}
        <button class="wiki-theme-card" class:active={activeTheme === theme.name} aria-pressed={activeTheme === theme.name} onclick={() => applyTheme(theme)}>
          <PresetThumb config={theme.config} />
          <span><strong>{theme.name}</strong><small>{theme.description}</small></span>
        </button>
      {/each}
    </div>
  </fieldset>

  <fieldset class="wiki-option-section">
    <legend>Try a CSS recipe</legend>
    <p>Choose a recipe to load its code and apply it to the sample.</p>
    <div class="wiki-recipe-grid">
      {#each recipes as recipe, i}
        <button class="wiki-recipe-card" class:active={activeRecipe === recipe.id} aria-pressed={activeRecipe === recipe.id} onclick={() => applyRecipe(i)}>
          <span class="wiki-recipe-preview" data-recipe={recipe.id} aria-hidden="true"><i class="art"></i><span><b></b><em></em><u></u></span></span>
          <span><strong>{recipe.name}</strong><small>{recipe.description}</small></span>
        </button>
      {/each}
    </div>
  </fieldset>

  <div class="wiki-css-heading">
    <div><strong>CSS sandbox</strong><span>Edits update the sample above.</span></div>
    <label class="wiki-checkbox"><input type="checkbox" bind:checked={cfg.experimental!.enabled} />Apply CSS</label>
  </div>
  <div class="wiki-code-bar"><label for="wiki-css">custom.css</label><div><span>{css.length} / {CSS_MAX}</span><button class="wiki-copy-button" disabled={!css.trim()} onclick={copy}><span aria-live="polite">{copyLabel}</span></button></div></div>
  <textarea id="wiki-css" class="wiki-css-input" bind:value={cfg.experimental!.css} maxlength={CSS_MAX} spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="wiki-css-help"></textarea>
  {#if hashMessage}<p class="wiki-inline-notice" role="status">{hashMessage}</p>{/if}
  <div class="wiki-playground-bottom"><p id="wiki-css-help">Copy the CSS into the editor's Custom CSS panel when you want to use it. <a href="/wiki/custom-css">View the selector reference</a></p><a class="wiki-editor-link" href="/">Open full editor</a></div>
</section>
