<script lang="ts">
  import Slider from "$lib/ui/Slider.svelte";
  import ColorInput from "$lib/ui/ColorInput.svelte";
  import Toggle from "$lib/ui/Toggle.svelte";
  import Segmented from "$lib/ui/Segmented.svelte";
  import InfoTip from "$lib/ui/InfoTip.svelte";
  import Collapsible from "$lib/ui/Collapsible.svelte";
  import { tip } from "$lib/ui/tooltip.svelte";
  import { CREDITS, type Credit } from "$lib/credits";
  import { GOOGLE_FONTS } from "$lib/google-fonts";
  import { fly } from "svelte/transition";
  import { ELEMENTS, isTextElement, labelFor, TextStyleView, TintView, type EditorState } from "$lib/editor.svelte";
  import { checkArtUrl, kindOf } from "$lib/config";

  interface Props {
    editor: EditorState;
  }
  let { editor }: Props = $props();

  const cfg = $derived(editor.config);
  const sel = $derived(editor.selected);
  const v2 = $derived(cfg.v2!);
  const E = $derived(sel ? v2.elements[sel] : null);

  // Everything switches on the element's KIND, so "title#2" gets the title's
  // controls. The handful of widget-wide settings that live on the background
  // panel key off the PRIMARY background instead, since there's only one widget.
  const kind = $derived(sel ? kindOf(sel) : null);
  const isTextSel = $derived(!!sel && isTextElement(sel));
  const isBg = $derived(kind === "background");
  const isPrimaryBg = $derived(sel === "background");
  const isArt = $derived(kind === "art");
  const isPrimaryArt = $derived(sel === "art");
  const isProgress = $derived(kind === "progress");
  const isPause = $derived(kind === "pause");

  // One bindable view over this element's typography, so the controls below
  // don't have to know whether they're writing the theme or a per-element
  // override (see TextStyleView).
  const typo = $derived(sel && isTextSel ? new TextStyleView(cfg, sel) : null);
  const tint = $derived(E && isBg ? new TintView(E) : null);

  const panelTitle = $derived(sel ? (isPrimaryBg ? "Background & widget" : labelFor(sel)) : "Widget");
  const labelOfKind = $derived(ELEMENTS.find((e) => e.id === kind)?.label ?? "element");

  // "Copy style": only worth showing once there's another instance of this kind
  // to take a look from.
  const siblings = $derived(sel ? editor.idsOf(kind!).filter((id) => id !== sel) : []);
  let copyOpen = $state(false);
  let copiedFrom = $state<string | null>(null);
  // Close the menu when you move to a different element, so it doesn't linger
  // open over one you never opened it for.
  $effect(() => {
    void sel;
    copyOpen = false;
    copiedFrom = null;
  });
  // Any click outside the menu dismisses it.
  $effect(() => {
    if (!copyOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-copy-style]")) copyOpen = false;
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  });

  function takeStyle(from: string) {
    if (!sel || !editor.copyStyleFrom(sel, from)) return;
    copiedFrom = labelFor(from);
    copyOpen = false;
    setTimeout(() => (copiedFrom = null), 1800);
  }

  // Live check on the pasted fallback image. Format first (cheap), then actually
  // try to load it, because the usual mistake is a link to the *page* an image
  // sits on rather than the image file, which only shows up on a real load.
  type Probe = { level: "ok" | "warn" | "bad" | "checking"; msg: string; src: string };
  let probe = $state<Probe>({ level: "bad", msg: "", src: "" });
  $effect(() => {
    const url = (isPrimaryArt ? (E?.fallbackArt ?? "") : "").trim();
    if (!url) {
      probe = { level: "bad", msg: "", src: "" };
      return;
    }
    const check = checkArtUrl(url);
    if (check.level === "bad") {
      probe = { ...check, src: "" };
      return;
    }
    probe = { level: "checking", msg: "Checking that link…", src: "" };
    let cancelled = false;
    // Debounced so typing a URL out doesn't fire a request per keystroke.
    const timer = setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const size = `${img.naturalWidth}×${img.naturalHeight}`;
        probe = {
          level: check.level,
          msg:
            check.msg ||
            `Looks good, ${size}${img.naturalWidth === img.naturalHeight ? "" : ". It's not square, so it'll get cropped to fit the art box"}`,
          src: url,
        };
      };
      img.onerror = () => {
        if (!cancelled)
          probe = {
            level: "bad",
            msg: "Couldn't load that one. Make sure it links straight to the image file (right-click the image → Copy image address), not the page it's sitting on.",
            src: "",
          };
      };
      img.src = url;
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  // Which sections are open. The Inspector is mounted once and just re-derives
  // off the selection, so this survives clicking between elements: open Shadow
  // on the title and it's still open when you land on the artist.
  const open = $state({
    layout: true,
    style: true,
    scroll: false,
    format: false,
    tint: false,
    outline: false,
    shadow: false,
    accent: false,
    font: false,
    anim: false,
    paused: false,
    ghosts: false,
  });

  // Every element instance, in the element-list order. Used by the ghost-outline
  // switches, which are per instance (each copy draws its own outline).
  const allIds = $derived(ELEMENTS.flatMap((e) => editor.idsOf(e.id)));
  const ghostsOff = $derived(allIds.filter((id) => !editor.ghosting(id)).length);

  const EASINGS = ["linear", "sineOut", "cubicOut", "quintOut", "backOut", "elasticOut"];
  const inputCls = "w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5 text-sm";
  const edgeLabel = (e: "start" | "center" | "end") => (e === "start" ? "start" : e === "end" ? "end" : "center");
</script>

{#snippet header(title: string, hint: string, diagram: string, credit?: Credit)}
  <div class="flex items-center gap-1 font-mono-ui text-xs font-medium text-muted-foreground uppercase">
    {title}
    {#if hint}<InfoTip text={hint} diagram={diagram || undefined} label={title} {credit} />{/if}
  </div>
{/snippet}

<!-- Divider inside a section, for when one section holds two distinct groups. -->
{#snippet sub(title: string)}
  <div class="mt-1 flex items-center gap-2">
    <span class="font-mono-ui text-[10px] tracking-wide text-muted-foreground/70 uppercase">{title}</span>
    <hr class="flex-1 border-border/60" />
  </div>
{/snippet}

<!-- Settings for the widget as a whole. Shown on the primary background (which IS
     the widget frame) and with nothing selected, since they're not about any one
     element and there'd otherwise be nothing in the panel. -->
{#snippet wholeWidget()}
  <div class="mt-1 flex items-center gap-2 px-0.5">
    <span class="font-mono-ui text-[10px] tracking-wide text-muted-foreground/70 uppercase">Whole widget</span>
    <hr class="flex-1 border-border" />
  </div>

  <Collapsible title="Accent color" icon="palette" bind:open={open.accent} hint="The color any element set to 'auto' follows, and the accent background fill.">
    <ColorInput bind:value={cfg.theme.accent} label="Accent color" hint="Used by any element whose color is set to 'auto', and by the accent background fill." />
    <Toggle bind:checked={cfg.theme.autoFromArt} label="Auto color from album art" hint="Pull the accent from the album art's dominant color, updating each song. When the art can't be read, each accent element uses its own 'Fallback color'." diagram="auto-color" />
    {#if cfg.theme.autoFromArt}
      <Toggle
        bind:checked={cfg.theme.accentNormalize!}
        label="Consistent brightness"
        hint="Album art swings from near-black to near-white, and the accent pulled from it swings with it, so the progress bar is barely visible on some covers and washed out on others. This keeps the art's hue but re-lights it to one fixed brightness, so the accent reads the same on every track."
        diagram="accent-brightness"
        credit={CREDITS.accentBrightness}
      />
      {#if cfg.theme.accentNormalize}
        <Slider
          bind:value={cfg.theme.accentBrightness!}
          min={0}
          max={100}
          label="Accent brightness"
          suffix="%"
          hint="How bright every album accent is normalized to. Raise it for a light background, lower it for a light widget on a dark stream. Only affects colors taken from the art, never a hand-picked accent."
          diagram="accent-brightness"
        />
      {/if}
    {/if}
  </Collapsible>

  <Collapsible title="Global font" icon="type" bind:open={open.font} badge={cfg.theme.font} hint="The default font for all text. Each text element can override it under its own Font setting.">
    <select bind:value={cfg.theme.font} class={inputCls} aria-label="Global font">
      {#each GOOGLE_FONTS as f (f)}
        <option value={f}>{f}</option>
      {/each}
    </select>
  </Collapsible>

  <Collapsible
    title="Song-switch animation"
    icon="sparkles"
    bind:open={open.anim}
    badge={v2.switchAnim.type === "none" ? undefined : v2.switchAnim.type}
    hint="How the widget transitions when the playing song changes."
    diagram="switch-anim"
  >
    <Segmented
      bind:value={v2.switchAnim.type}
      label="Type"
      options={[
        { value: "none", label: "None" },
        { value: "fade", label: "Fade" },
        { value: "slide", label: "Slide" },
      ]}
    />
    {#if v2.switchAnim.type === "slide"}
      <Segmented
        bind:value={v2.switchAnim.direction}
        label="Direction"
        options={[
          { value: "up", label: "Up" },
          { value: "down", label: "Down" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ]}
      />
    {/if}
    {#if v2.switchAnim.type !== "none"}
      <Slider bind:value={v2.switchAnim.durationMs} min={0} max={1500} step={50} label="Duration" suffix="ms" />
      <label class="block">
        <div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          Easing
          <InfoTip text="The speed curve of the animation. For example, cubicOut eases out and backOut overshoots slightly." label="Easing" />
        </div>
        <select bind:value={v2.switchAnim.easing} class={inputCls}>
          {#each EASINGS as e (e)}
            <option value={e}>{e}</option>
          {/each}
        </select>
      </label>
    {/if}
  </Collapsible>

  <Collapsible title="When paused" icon="pause" bind:open={open.paused} hint="What the widget does when nothing is playing: show the pause symbol, or hide the whole widget.">
    <Segmented
      bind:value={cfg.fields.pausedMode!}
      options={[
        { value: "label", label: "Show paused" },
        { value: "transparent", label: "Hide widget" },
      ]}
    />
    {#if (cfg.fields.pausedMode ?? "label") === "label"}
      <p class="text-[11px] leading-snug text-muted-foreground">
        Select the <b>Pause symbol</b> element to change its color, size and position. The widget keeps
        showing the last song you actually played.
      </p>
    {:else}
      <p class="text-[11px] leading-snug text-muted-foreground">
        The whole widget hides while nothing is playing.
      </p>
    {/if}
  </Collapsible>
{/snippet}

<!-- *:shrink-0 keeps sections at natural height so overflow scrolls instead of squishing them -->
<div class="flex h-full flex-col gap-2 overflow-y-auto p-3 text-sm *:shrink-0">
  <div class="flex items-center gap-1.5">
    <div class="flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight">
      <span class="truncate">{panelTitle}</span>
      {#if kind === "progress" || kind === "duration"}
        <InfoTip
          text="Heads up: the progress bar and elapsed time are estimated. Last.fm doesn't report the exact playback position, so this can be off by a few seconds and won't be frame-accurate."
          label={panelTitle}
        />
      {/if}
    </div>

    <!-- Only worth offering once there's another one of this kind to copy from. -->
    {#if siblings.length}
      <div class="relative ml-auto shrink-0" data-copy-style>
        <button
          type="button"
          onclick={() => (copyOpen = !copyOpen)}
          aria-expanded={copyOpen}
          aria-haspopup="menu"
          use:tip={`Take another ${labelOfKind.toLowerCase()}'s look`}
          class="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] whitespace-nowrap transition-colors {copiedFrom
            ? 'text-green-400'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
        >
          {copiedFrom ? `Copied from ${copiedFrom}` : "Copy style"}
          <svg
            class="h-3 w-3 shrink-0 transition-transform duration-150 {copyOpen ? 'rotate-90' : ''}"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 2.5 L8 6 L4 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        {#if copyOpen}
          <div
            role="menu"
            transition:fly={{ y: -4, duration: 140 }}
            class="absolute top-full right-0 z-40 mt-1 flex w-48 flex-col gap-0.5 rounded-lg border border-border bg-card p-1 shadow-md"
          >
            {#each siblings as id (id)}
              <button
                type="button"
                role="menuitem"
                onclick={() => takeStyle(id)}
                class="rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
              >
                from <b>{labelFor(id)}</b>
              </button>
            {/each}
            <p class="px-2 pt-1 pb-0.5 text-[11px] leading-snug text-muted-foreground">
              Takes its colors, outline, shadow and font. Position, size and layer stay put.
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if !sel || !E}
    <p class="text-xs text-muted-foreground">
      Click an element on the canvas to edit it. These settings cover the whole widget.
    </p>
    {@render wholeWidget()}

    <!-- Editor-only, so it lives down here with nothing selected rather than on
         any one element's panel. -->
    <div class="mt-1 flex items-center gap-2 px-0.5">
      <span class="font-mono-ui text-[10px] tracking-wide text-muted-foreground/70 uppercase">Editor</span>
      <hr class="flex-1 border-border" />
    </div>

    <Collapsible
      title="Ghost outlines"
      icon="outline"
      bind:open={open.ghosts}
      badge={ghostsOff ? `${ghostsOff} off` : undefined}
      hint="While you drag an edge or corner to resize, nearby elements draw a gray outline so you can see what you're lining up with. Turn one off here if it's more noise than help. This only changes the editor, never the widget itself."
    >
      {#each allIds as id (id)}
        <Toggle
          bind:checked={() => editor.ghosting(id), (v) => editor.setGhosting(id, v)}
          label={labelFor(id)}
        />
      {/each}
    </Collapsible>
  {:else}
    {#if !isPrimaryBg}
      <Toggle bind:checked={E.visible} label="Visible" hint="Show or hide this element on the live widget." />
    {/if}

    <!-- ===== Position & size ===== -->
    {#if !isPrimaryBg}
      <Collapsible
        title="Position & size"
        icon="layout"
        bind:open={open.layout}
        hint={isTextSel
          ? "Pixels from the widget's top-left. Hold Shift while dragging to snap an edge to another element. Tip: snap text to the album art so it stays anchored. If the art ever fails to load, the text won't get stranded in the middle."
          : "Pixels from the widget's top-left. Hold Shift while dragging on the canvas to snap an edge to another element."}
        diagram="snap"
      >
        {@render sub("Position")}
        <!-- A snapped axis is its own little group: the anchor it's tied to, the
             way out of it, and the offset that belongs to it. -->
        {#if E.snapX}
          <div class="rounded-md border border-border/60 bg-muted/20 p-2">
            <div class="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span class="min-w-0 truncate text-muted-foreground"
                >X: my {edgeLabel(E.snapX.myEdge)} → {E.snapX.to} {edgeLabel(E.snapX.toEdge)}</span
              >
              <button class="shrink-0 rounded border border-border px-2 py-0.5 hover:bg-muted" onclick={() => editor.clearSnap(sel!, "x")}
                >Unsnap</button
              >
            </div>
            <Slider bind:value={E.snapX.offset} min={-200} max={200} label="X offset" suffix="px" />
          </div>
        {:else}
          <Slider bind:value={E.x} min={-200} max={900} label="X" suffix="px" diagram="position" hint="Horizontal position in px from the widget's left edge." />
        {/if}
        {#if E.snapY}
          <div class="rounded-md border border-border/60 bg-muted/20 p-2">
            <div class="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span class="min-w-0 truncate text-muted-foreground"
                >Y: my {edgeLabel(E.snapY.myEdge)} → {E.snapY.to} {edgeLabel(E.snapY.toEdge)}</span
              >
              <button class="shrink-0 rounded border border-border px-2 py-0.5 hover:bg-muted" onclick={() => editor.clearSnap(sel!, "y")}
                >Unsnap</button
              >
            </div>
            <Slider bind:value={E.snapY.offset} min={-200} max={200} label="Y offset" suffix="px" />
          </div>
        {:else}
          <Slider bind:value={E.y} min={-200} max={700} label="Y" suffix="px" />
        {/if}
        <Slider bind:value={E.z} min={0} max={20} label="Layer" hint="Stacking order: higher numbers sit in front of lower ones." diagram="z" />

        <!-- Size, same section: it's the other half of "where does this sit".
             Full width rather than two columns, so the tracks are long enough to
             actually drag. -->
        {@render sub("Size")}
        {#if isArt}
          <Slider bind:value={E.w as number} min={16} max={400} label="Width" suffix="px" />
          <Slider bind:value={E.h as number} min={16} max={400} label="Height" suffix="px" />
        {:else if isProgress}
          <Slider bind:value={E.w as number} min={16} max={900} label="Width" suffix="px" />
          <Slider bind:value={E.h as number} min={2} max={60} label="Height" suffix="px" />
        {:else if isPause}
          <Slider bind:value={E.w as number} min={8} max={200} label="Width" suffix="px" />
          <Slider bind:value={E.h as number} min={8} max={200} label="Height" suffix="px" />
        {:else if isBg}
          <Slider bind:value={E.w as number} min={8} max={900} label="Width" suffix="px" />
          <Slider bind:value={E.h as number} min={8} max={700} label="Height" suffix="px" />
        {:else if isTextSel}
          <div>
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="flex items-center gap-1 text-muted-foreground">
                Width
                <InfoTip text="Auto fits the text. Turn off for a fixed width that clips long text (or scrolls it, if scrolling is on)." diagram="scroll" label="Width" />
              </span>
              <button
                class="rounded border px-1.5 py-0.5 text-[11px] {E.w === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'}"
                onclick={() => editor.toggleAuto(sel!, "w")}>auto</button
              >
            </div>
            {#if E.w !== null}
              <Slider bind:value={E.w} min={16} max={600} suffix="px" />
            {/if}
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="text-muted-foreground">Height</span>
              <button
                class="rounded border px-1.5 py-0.5 text-[11px] {E.h === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'}"
                onclick={() => editor.toggleAuto(sel!, "h")}>auto</button
              >
            </div>
            {#if E.h !== null}
              <Slider bind:value={E.h} min={8} max={200} suffix="px" />
            {/if}
          </div>
        {/if}
      </Collapsible>
    {:else}
      <!-- The primary background IS the widget frame, so its size is the widget size. -->
      <Collapsible title="Widget size" icon="layout" bind:open={open.layout} hint="The size of the whole widget. Everything else positions inside it.">
        <Slider bind:value={E.w as number} min={120} max={900} label="Width" suffix="px" />
        <Slider bind:value={E.h as number} min={60} max={700} label="Height" suffix="px" />
      </Collapsible>
    {/if}

    <!-- ===== Per-type styling ===== -->
    {#if isTextSel}
      <Collapsible title="Text" icon="type" bind:open={open.style} hint="Color, size, weight and font for this piece of text.">
        <ColorInput bind:value={E.color} label="Color" allowAccent hint="This text's color. 'auto' follows the accent / album-art color." diagram="auto-color" />
        {#if E.color === "accent"}
          <ColorInput
            bind:value={E.fallbackColor!}
            label="Fallback color"
            hint="Used for this text when auto-color is on but the album art can't be fetched or read, so it isn't stuck on the failed accent."
            diagram="fallback"
          />
        {/if}
        <Segmented
          bind:value={E.anchor}
          label="Anchor"
          hint="Which side the text lines up to inside its box."
          diagram="anchor"
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
        <Slider bind:value={typo!.size} min={8} max={72} label="Font size" suffix="px" />

        <div>
          <div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            Style
            <InfoTip text="Bold, italic, underline, strikethrough." label="Style" />
          </div>
          <div class="flex gap-1">
            <button
              type="button"
              class="flex-1 rounded-md border px-2 py-1 font-bold {typo!.bold
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'}"
              onclick={() => (typo!.bold = !typo!.bold)}>B</button
            >
            <button
              type="button"
              class="flex-1 rounded-md border px-2 py-1 italic {typo!.italic
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'}"
              onclick={() => (typo!.italic = !typo!.italic)}>I</button
            >
            <button
              type="button"
              class="flex-1 rounded-md border px-2 py-1 underline {typo!.underline
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'}"
              onclick={() => (typo!.underline = !typo!.underline)}>U</button
            >
            <button
              type="button"
              class="flex-1 rounded-md border px-2 py-1 line-through {typo!.strike
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'}"
              onclick={() => (typo!.strike = !typo!.strike)}>S</button
            >
          </div>
        </div>

        <Segmented
          bind:value={typo!.transform}
          label="Case"
          hint="Force the text to UPPERCASE or lowercase, or leave it as-is."
          options={[
            { value: "none", label: "Aa" },
            { value: "uppercase", label: "AA" },
            { value: "lowercase", label: "aa" },
          ]}
        />

        <label class="block">
          <div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            Font
            <InfoTip text="Use a different font for just this text. 'Default' keeps the widget's global font." label="Font" />
          </div>
          <select bind:value={typo!.font} class={inputCls}>
            <option value="">Default (global)</option>
            {#each GOOGLE_FONTS as f (f)}
              <option value={f}>{f}</option>
            {/each}
          </select>
        </label>
      </Collapsible>

      <Collapsible
        title="Scrolling"
        icon="scroll"
        bind:open={open.scroll}
        badge={E.scroll.enabled ? "on" : undefined}
        hint="When the text is wider than its box, slide it across instead of cutting it off."
        diagram="scroll"
      >
        <Toggle bind:checked={E.scroll.enabled} label="Scroll when it overflows" />
        {#if E.scroll.enabled}
          <Segmented
            bind:value={E.scroll.direction}
            label="Direction"
            hint="Left/right loop continuously; bounce slides to the end and back."
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
              { value: "bounce", label: "Bounce" },
            ]}
          />
          <Slider bind:value={E.scroll.speedPxPerSec} min={0} max={120} label="Speed" suffix="px/s" />
          <Slider bind:value={E.scroll.gapPx} min={0} max={120} label="Gap" suffix="px" hint="Space between the end and start of the looping text." />
        {/if}
      </Collapsible>

      {#if kind === "duration"}
        <Collapsible title="Time format" icon="clock" bind:open={open.format} hint="Show time elapsed, time remaining, or elapsed / total.">
          <Segmented
            bind:value={cfg.fields.durationFormat!}
            options={[
              { value: "elapsed", label: "0:42" },
              { value: "remaining", label: "-2:18" },
              { value: "both", label: "0:42/3:00" },
            ]}
          />
        </Collapsible>
      {/if}
    {:else if isArt}
      <Collapsible title="Album art" icon="image" bind:open={open.style} hint="How the cover itself looks, plus what shows when there isn't one.">
        <Slider bind:value={E.radius} min={0} max={100} label="Corner radius" suffix="px" hint="Round the album art's corners. Max makes it a circle." />

        <!-- One cover, one fallback: every art instance shows the same image, so the
             fallback URL stays on the first one instead of being asked for twice. -->
        {#if isPrimaryArt}
          <hr class="border-border" />
          {@render header(
            "Fallback image",
            "Your own image, shown whenever the real cover isn't available: a song with no artwork, a broken cover link, or nothing playing yet. Paste a direct link to an image file and it gets checked right here. Leave it empty and the art just disappears like before. Heads up: whatever you paste has to stay online, since the widget loads it fresh every time.",
            "fallback",
            CREDITS.fallbackArt,
          )}
          <input
            class={inputCls}
            type="url"
            spellcheck="false"
            placeholder="https://example.com/cover.png"
            aria-label="Fallback image URL"
            bind:value={E.fallbackArt}
          />
          {#if probe.msg}
            <div class="flex items-start gap-2">
              {#if probe.src}
                <img src={probe.src} alt="" class="h-9 w-9 shrink-0 rounded border border-border object-cover" />
              {/if}
              <p
                class="text-[11px] leading-snug {probe.level === 'ok'
                  ? 'text-green-400'
                  : probe.level === 'warn'
                    ? 'text-amber-400'
                    : probe.level === 'checking'
                      ? 'text-muted-foreground'
                      : 'text-red-400'}"
              >
                {probe.msg}
              </p>
            </div>
          {/if}
        {:else}
          <p class="text-[11px] leading-snug text-muted-foreground">
            Shows the same cover as the first album art, so you can frame it, echo it somewhere else, or
            stack a blurred copy behind things. The fallback image is set on the first one and covers them all.
          </p>
        {/if}
      </Collapsible>
    {:else if isProgress}
      <Collapsible title="Progress bar" icon="bar" bind:open={open.style} hint="The played portion's color and shape.">
        <ColorInput bind:value={E.color} label="Fill color" allowAccent hint="The played portion's color. 'auto' follows the accent / album-art color." diagram="auto-color" />
        {#if E.color === "accent"}
          <ColorInput
            bind:value={E.fallbackColor!}
            label="Fallback color"
            hint="Used for the bar when auto-color is on but the album art can't be fetched or read, so it isn't stuck on the failed accent."
            diagram="fallback"
          />
        {/if}
        <Slider bind:value={E.radius} min={0} max={30} label="Corner radius" suffix="px" />
        <Slider bind:value={E.fillOpacity} min={0} max={100} label="Opacity" suffix="%" hint="Fades the whole bar, track and fill together." />
      </Collapsible>
    {:else if isPause}
      <Collapsible title="Pause symbol" icon="pause" bind:open={open.style} hint="Shown only while paused or stopped.">
        <ColorInput bind:value={E.color} label="Color" allowAccent hint="The pause bars' color. 'auto' follows the accent / album-art color." diagram="auto-color" />
        {#if E.color === "accent"}
          <ColorInput
            bind:value={E.fallbackColor!}
            label="Fallback color"
            hint="Used when auto-color is on but the album art can't be fetched or read, so it isn't stuck on the failed accent."
            diagram="fallback"
          />
        {/if}
        <p class="text-[11px] leading-snug text-muted-foreground">
          Shown only while paused / stopped. Drag it on the canvas to position it (turn on
          <b>Paused preview</b> to see it). When the album art is hidden or fails to load, it falls back to sitting after the title.
        </p>
      </Collapsible>
    {/if}

    <!-- ===== Background fill (both the widget frame and extra boxes) ===== -->
    {#if isBg}
      <Collapsible
        title={isPrimaryBg ? "Background" : "Box fill"}
        icon="square"
        bind:open={open.style}
        hint="What fills this box: nothing, a solid color, the accent color, or a blurred album cover."
      >
        <Segmented
          bind:value={E.fill}
          label={isPrimaryBg ? "Background" : "Fill"}
          options={[
            { value: "none", label: "None" },
            { value: "color", label: "Color" },
            { value: "accent", label: "Accent" },
            { value: "art", label: "Album art" },
          ]}
        />
        {#if E.fill === "color"}
          <ColorInput bind:value={E.color} label="Background color" allowAlpha />
        {:else if E.fill === "accent"}
          <Slider bind:value={E.fillOpacity} min={0} max={100} label="Opacity" suffix="%" />
          <ColorInput
            bind:value={E.fallbackColor!}
            label="Fallback color"
            hint="The background's accent-fill color when auto-color is on but the album art can't be fetched or read, so it isn't stuck on the failed accent."
            diagram="fallback"
          />
        {:else if E.fill === "art"}
          <Slider bind:value={E.fillOpacity} min={0} max={100} label="Opacity" suffix="%" diagram="fill-art" hint="A blurred album cover, scaled to the widget width, fills the background. This fades it toward whatever is BEHIND the widget, so use Tint below to darken it instead." />
        {/if}
        <Slider bind:value={E.radius} min={0} max={64} label="Corner radius" suffix="px" />
      </Collapsible>

      {#if E.fill !== "none"}
        <Collapsible
          title="Tint"
          icon="droplet"
          bind:open={open.tint}
          badge={tint!.opacity ? `${tint!.opacity}%` : undefined}
          hint="A flat color laid over the background but under everything else. This is how you darken a blurred album cover until the text on top of it reads: the fill's own opacity only fades it toward whatever is behind the widget, which on a stream is your game."
        >
          <Slider bind:value={tint!.opacity} min={0} max={100} label="Strength" suffix="%" />
          {#if E.tint}
            <ColorInput bind:value={tint!.color} label="Tint color" allowAccent />
          {/if}
        </Collapsible>
      {/if}
    {/if}

    <!-- ===== Outline (every element) ===== -->
    {#if E.stroke}
      <Collapsible
        title="Outline"
        icon="outline"
        bind:open={open.outline}
        badge={E.stroke.enabled ? "on" : undefined}
        hint="A stroke around this element. Handy for keeping text readable on top of busy backgrounds like a game."
        credit={CREDITS.outline}
      >
        <Toggle bind:checked={E.stroke.enabled} label="Enable" />
        {#if E.stroke.enabled}
          <Slider bind:value={E.stroke.width} min={0} max={12} step={0.5} label="Thickness" suffix="px" hint="How far the outline reaches past the edge." />
          {#if !isTextSel}
            <Segmented
              bind:value={E.stroke.align}
              label="Position"
              options={[
                { value: "outside", label: "Outside" },
                { value: "center", label: "Center" },
                { value: "inside", label: "Inside" },
              ]}
              hint="Which side of the edge the outline sits on. Outside keeps the shape intact, inside eats into it."
            />
          {/if}
          <Slider bind:value={E.stroke.opacity} min={0} max={100} label="Opacity" suffix="%" />
          <ColorInput bind:value={E.stroke.color} label="Outline color" allowAccent />
          {#if isTextSel}
            <p class="text-[11px] leading-snug text-muted-foreground">
              Text outlines are drawn around the letters, never over them, so the words stay readable on a busy
              background.
            </p>
          {/if}
        {/if}
      </Collapsible>
    {/if}

    <!-- ===== Drop shadow (every element) ===== -->
    <Collapsible
      title="Drop shadow"
      icon="shadow"
      bind:open={open.shadow}
      badge={E.shadow.enabled ? "on" : undefined}
      hint="A soft shadow cast behind this element."
      diagram="shadow-offset"
    >
      <Toggle bind:checked={E.shadow.enabled} label="Enable" />
      {#if E.shadow.enabled}
        <Slider bind:value={E.shadow.blur} min={0} max={40} label="Blur" suffix="px" hint="How soft and spread-out the shadow is. 0 = a hard edge." />
        <Slider bind:value={E.shadow.intensity} min={0} max={100} label="Intensity" suffix="%" hint="Shadow opacity." />
        <Slider bind:value={E.shadow.offsetX} min={-20} max={20} label="Offset X" suffix="px" diagram="shadow-offset" hint="Nudge the shadow horizontally." />
        <Slider bind:value={E.shadow.offsetY} min={-20} max={20} label="Offset Y" suffix="px" hint="Nudge the shadow vertically." />
        <Toggle bind:checked={E.shadow.useOppositeColor} label="Auto contrast color" hint="Pick a shadow color opposite the element's color, for contrast." />
        {#if !E.shadow.useOppositeColor}
          <ColorInput bind:value={E.shadow.customColor!} label="Shadow color" />
        {/if}
        {#if isTextSel}
          <Toggle
            bind:checked={E.shadow.escape}
            label="Shadow can leave the box"
            hint="Lets the shadow reach past the element's box (even past the widget edge) while the text itself stays clipped in place. Only the shadow spills out, not the text."
            diagram="shadow-escape"
          />
        {/if}
      {/if}
    </Collapsible>

    <!-- ===== Widget-wide (only on the primary background: there's one widget) ===== -->
    {#if isPrimaryBg}
      {@render wholeWidget()}
    {/if}
  {/if}
</div>
