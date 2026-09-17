<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/state";
  import { CSS_MAX } from "$lib/config";
  import PresetThumb from "$lib/editor/PresetThumb.svelte";
  import { PRESETS } from "$lib/presets";
  import Icon from "$lib/ui/Icon.svelte";
  import { demoConfig, recipes } from "./playground";

  // The preview sticks to the top of the viewport while you scroll the themes,
  // recipes and CSS below it, so every change is visible as you make it.

  let cfg = $state(demoConfig());
  let paused = $state(false);
  let frame = $state<HTMLIFrameElement>();
  let ready = $state(false);
  let hashMessage = $state("");
  let copyLabel = $state("Copy");
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let activeTheme = $state("Default");

  const themes = [
    { name: "Default", description: "The editor's starting layout.", config: demoConfig() },
    ...PRESETS.map((preset) => ({ ...preset, description: `Built-in ${preset.name.toLowerCase()} theme.` })),
  ];
  const css = $derived(cfg.experimental!.css);
  const cssOn = $derived(cfg.experimental!.enabled);
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
    copyTimer = setTimeout(() => copyLabel = "Copy", 3000);
  }

  function clearCss() {
    cfg.experimental!.css = "";
    hashMessage = "";
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
  <div class="wiki-stage">
    <div class="wiki-stage-bar">
      <p class="wiki-eyebrow"><Icon name="play" class="wiki-icon" />Live preview</p>
      <div class="wiki-stage-actions">
        <button class="wiki-switch" aria-pressed={!paused} aria-label={paused ? "Paused, resume the preview" : "Playing, pause the preview"} onclick={() => paused = !paused}>
          <span class="wiki-switch-track"></span>{paused ? "Paused" : "Playing"}
        </button>
        <button class="wiki-button" onclick={reset}><Icon name="power" class="wiki-icon" />Reset</button>
      </div>
    </div>

    <div class="wiki-preview-stage canvas-checker">
      <iframe bind:this={frame} src="/wiki-preview" title="Sample widget preview" onload={() => ready = true}></iframe>
    </div>

    <p class="wiki-preview-caption">
      <span class="wiki-mono">{cfg.layout.w} × {cfg.layout.h}</span>
      <span>{activeTheme}</span>
      <span class="wiki-dot" class:on={cssOn}>{cssOn ? "Custom CSS on" : "Custom CSS off"}</span>
    </p>
  </div>

  <section class="wiki-panel">
    <header class="wiki-panel-head">
      <Icon name="palette" class="wiki-icon" />
      <div>
        <strong>Start from a theme</strong>
        <span>Every built-in look the editor ships with. Picking one keeps whatever CSS you've written.</span>
      </div>
    </header>
    <div class="wiki-theme-grid">
      {#each themes as theme}
        <button class="wiki-card wiki-theme-card" class:active={activeTheme === theme.name} aria-pressed={activeTheme === theme.name} onclick={() => applyTheme(theme)}>
          <PresetThumb config={theme.config} />
          <span class="wiki-card-text"><strong>{theme.name}</strong><small>{theme.description}</small></span>
        </button>
      {/each}
    </div>
  </section>

  <section class="wiki-panel">
    <header class="wiki-panel-head">
      <Icon name="code" class="wiki-icon" />
      <div>
        <strong>Load a CSS recipe</strong>
        <span>Four small stylesheets to start from. Choosing one replaces what's in the sandbox.</span>
      </div>
    </header>
    <div class="wiki-recipe-grid">
      {#each recipes as recipe, i}
        <button class="wiki-card wiki-recipe-card" class:active={activeRecipe === recipe.id} aria-pressed={activeRecipe === recipe.id} onclick={() => applyRecipe(i)}>
          <span class="wiki-recipe-preview" data-recipe={recipe.id} aria-hidden="true"><i class="art"></i><span><b></b><em></em><u></u></span></span>
          <span class="wiki-card-text"><strong>{recipe.name}</strong><small>{recipe.description}</small></span>
        </button>
      {/each}
    </div>
  </section>

  <section class="wiki-panel">
    <header class="wiki-panel-head">
      <Icon name="edit" class="wiki-icon" />
      <div>
        <strong>CSS sandbox</strong>
        <span>Type here and the preview updates as you go. Nothing is saved.</span>
      </div>
      <button class="wiki-switch" aria-pressed={cssOn} onclick={() => cfg.experimental!.enabled = !cssOn}>
        <span class="wiki-switch-track"></span>Apply
      </button>
    </header>

    <div class="wiki-code">
      <div class="wiki-code-bar">
        <label for="wiki-css">custom.css</label>
        <div>
          <span class="wiki-mono">{css.length} / {CSS_MAX}</span>
          <button disabled={!css.trim()} onclick={clearCss}>Clear</button>
          <button class="wiki-copy-button" disabled={!css.trim()} onclick={copy}><span aria-live="polite">{copyLabel}</span></button>
        </div>
      </div>
      <textarea
        id="wiki-css"
        class="wiki-css-input"
        bind:value={cfg.experimental!.css}
        maxlength={CSS_MAX}
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        placeholder={'[data-el="title"] > div {\n  color: #93c5fd;\n}'}
        aria-describedby="wiki-css-help"
      ></textarea>
    </div>

    {#if hashMessage}<p class="wiki-inline-notice" role="status">{hashMessage}</p>{/if}

    <footer class="wiki-panel-foot">
      <p id="wiki-css-help">
        Paste this into the editor's Custom CSS panel when you're happy with it.
        <a href="/wiki/custom-css">Selector reference</a>
      </p>
      <a class="wiki-button wiki-button-primary" href="/"><Icon name="layout" class="wiki-icon" />Open full editor</a>
    </footer>
  </section>
</section>
