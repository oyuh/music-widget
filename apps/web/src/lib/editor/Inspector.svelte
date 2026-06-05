<script lang="ts">
  import Slider from "$lib/ui/Slider.svelte";
  import ColorInput from "$lib/ui/ColorInput.svelte";
  import Toggle from "$lib/ui/Toggle.svelte";
  import Segmented from "$lib/ui/Segmented.svelte";
  import InfoTip from "$lib/ui/InfoTip.svelte";
  import { GOOGLE_FONTS } from "$lib/google-fonts";
  import { TEXT_ELEMENTS, type EditorState, type ElementId } from "$lib/editor.svelte";

  interface Props {
    editor: EditorState;
  }
  let { editor }: Props = $props();

  const cfg = $derived(editor.config);
  const sel = $derived(editor.selected);
  const v2 = $derived(cfg.v2!);
  const E = $derived(sel ? v2.elements[sel] : null);

  const isTextSel = $derived(!!sel && (TEXT_ELEMENTS as readonly string[]).includes(sel));
  const tel = $derived(sel as "title" | "artist" | "album" | "duration");
  const isBg = $derived(sel === "background");
  const isArt = $derived(sel === "art");
  const isProgress = $derived(sel === "progress");

  const labelOf: Record<ElementId, string> = {
    background: "Background & widget",
    art: "Album art",
    title: "Title",
    artist: "Artist",
    album: "Album",
    progress: "Progress bar",
    duration: "Duration",
  };

  const EASINGS = ["linear", "sineOut", "cubicOut", "quintOut", "backOut", "elasticOut"];
  const inputCls = "w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5 text-sm";
  const edgeLabel = (e: "start" | "center" | "end") => (e === "start" ? "start" : e === "end" ? "end" : "center");
</script>

{#snippet header(title: string, hint: string, diagram: string)}
  <div class="flex items-center gap-1 font-pixel text-xs font-medium text-muted-foreground uppercase">
    {title}
    {#if hint}<InfoTip text={hint} diagram={diagram || undefined} label={title} />{/if}
  </div>
{/snippet}

<div class="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
  <div class="flex items-center gap-1.5 text-base font-semibold tracking-tight">
    {sel ? labelOf[sel] : "Widget"}
    {#if sel === "progress" || sel === "duration"}
      <InfoTip
        text="Heads up: the progress bar and elapsed time are estimated. Last.fm doesn't report the exact playback position, so this can be off by a few seconds and won't be frame-accurate."
        label={labelOf[sel]}
      />
    {/if}
  </div>

  {#if !sel || !E}
    <p class="text-xs text-muted-foreground">Click an element on the canvas to edit it.</p>
  {:else}
    {#if !isBg}
      <Toggle bind:checked={E.visible} label="Visible" hint="Show or hide this element on the live widget." />
    {/if}

    <!-- ===== Position ===== -->
    {#if !isBg}
      <div>
        {@render header(
          "Position",
          isTextSel
            ? "Pixels from the widget's top-left. Hold Shift while dragging to snap an edge to another element. Tip: snap text to the album art so it stays anchored , if the art ever fails to load, the text won't get stranded in the middle."
            : "Pixels from the widget's top-left. Hold Shift while dragging on the canvas to snap an edge to another element.",
          "snap",
        )}
        <div class="mt-1"></div>
        {#if E.snapX}
          <div class="mb-1 flex items-center justify-between gap-2 text-xs">
            <span class="text-muted-foreground"
              >X: my {edgeLabel(E.snapX.myEdge)} → {E.snapX.to} {edgeLabel(E.snapX.toEdge)}</span
            >
            <button class="rounded border border-border px-2 py-0.5 hover:bg-muted" onclick={() => editor.clearSnap(sel!, "x")}
              >Unsnap</button
            >
          </div>
          <Slider bind:value={E.snapX.offset} min={-200} max={200} label="X offset" suffix="px" />
        {:else}
          <Slider bind:value={E.x} min={-200} max={900} label="X" suffix="px" diagram="position" hint="Horizontal position in px from the widget's left edge." />
        {/if}
        {#if E.snapY}
          <div class="mt-2 mb-1 flex items-center justify-between gap-2 text-xs">
            <span class="text-muted-foreground"
              >Y: my {edgeLabel(E.snapY.myEdge)} → {E.snapY.to} {edgeLabel(E.snapY.toEdge)}</span
            >
            <button class="rounded border border-border px-2 py-0.5 hover:bg-muted" onclick={() => editor.clearSnap(sel!, "y")}
              >Unsnap</button
            >
          </div>
          <Slider bind:value={E.snapY.offset} min={-200} max={200} label="Y offset" suffix="px" />
        {:else}
          <Slider bind:value={E.y} min={-200} max={700} label="Y" suffix="px" />
        {/if}
        <Slider bind:value={E.z} min={0} max={20} label="Layer" hint="Stacking order , higher numbers sit in front of lower ones." diagram="z" />
      </div>
    {/if}

    <!-- ===== Size ===== -->
    {#if isBg}
      <div class="grid grid-cols-2 gap-2">
        <Slider bind:value={E.w as number} min={120} max={900} label="Width" suffix="px" />
        <Slider bind:value={E.h as number} min={60} max={700} label="Height" suffix="px" />
      </div>
    {:else if isArt}
      <div class="grid grid-cols-2 gap-2">
        <Slider bind:value={E.w as number} min={16} max={400} label="Width" suffix="px" />
        <Slider bind:value={E.h as number} min={16} max={400} label="Height" suffix="px" />
      </div>
    {:else if isProgress}
      <div class="grid grid-cols-2 gap-2">
        <Slider bind:value={E.w as number} min={16} max={900} label="Width" suffix="px" />
        <Slider bind:value={E.h as number} min={2} max={60} label="Height" suffix="px" />
      </div>
    {:else if isTextSel}
      <div class="grid grid-cols-2 gap-3">
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
      </div>
    {/if}

    <!-- ===== Per-type styling ===== -->
    {#if isTextSel}
      <hr class="border-border" />
      <ColorInput bind:value={E.color} label="Color" allowAccent hint="This text's color. 'auto' follows the accent / album-art color." diagram="auto-color" />
      {#if E.color === "accent"}
        <ColorInput
          bind:value={E.fallbackColor!}
          label="Fallback color"
          hint="Used for this text when auto-color is on but the album art can't be fetched or read , so it isn't stuck on the failed accent."
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
      <Slider bind:value={cfg.theme.textSize![tel]} min={8} max={72} label="Font size" suffix="px" />

      <div>
        <div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          Style
          <InfoTip text="Bold, italic, underline, strikethrough." label="Style" />
        </div>
        <div class="flex gap-1">
          <button
            type="button"
            class="flex-1 rounded-md border px-2 py-1 font-bold {cfg.theme.textStyle![tel].bold
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-muted'}"
            onclick={() => (cfg.theme.textStyle![tel].bold = !cfg.theme.textStyle![tel].bold)}>B</button
          >
          <button
            type="button"
            class="flex-1 rounded-md border px-2 py-1 italic {cfg.theme.textStyle![tel].italic
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-muted'}"
            onclick={() => (cfg.theme.textStyle![tel].italic = !cfg.theme.textStyle![tel].italic)}>I</button
          >
          <button
            type="button"
            class="flex-1 rounded-md border px-2 py-1 underline {cfg.theme.textStyle![tel].underline
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-muted'}"
            onclick={() => (cfg.theme.textStyle![tel].underline = !cfg.theme.textStyle![tel].underline)}>U</button
          >
          <button
            type="button"
            class="flex-1 rounded-md border px-2 py-1 line-through {cfg.theme.textStyle![tel].strike
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-muted'}"
            onclick={() => (cfg.theme.textStyle![tel].strike = !cfg.theme.textStyle![tel].strike)}>S</button
          >
        </div>
      </div>

      <Segmented
        bind:value={cfg.theme.textTransform![tel]}
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
        <select bind:value={cfg.theme.textFont![tel]} class={inputCls}>
          <option value={undefined}>Default (global)</option>
          {#each GOOGLE_FONTS as f (f)}
            <option value={f}>{f}</option>
          {/each}
        </select>
      </label>

      <hr class="border-border" />
      {@render header("Scrolling", "When the text is wider than its box, slide it across instead of cutting it off.", "scroll")}
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

      {#if tel === "duration"}
        <hr class="border-border" />
        <Segmented
          bind:value={cfg.fields.durationFormat!}
          label="Format"
          hint="Show time elapsed, time remaining, or elapsed / total."
          options={[
            { value: "elapsed", label: "0:42" },
            { value: "remaining", label: "-2:18" },
            { value: "both", label: "0:42/3:00" },
          ]}
        />
      {/if}
    {:else if isArt}
      <hr class="border-border" />
      <Slider bind:value={E.radius} min={0} max={100} label="Corner radius" suffix="px" hint="Round the album art's corners. Max makes it a circle." />
    {:else if isProgress}
      <hr class="border-border" />
      <ColorInput bind:value={E.color} label="Fill color" allowAccent hint="The played portion's color. 'auto' follows the accent / album-art color." diagram="auto-color" />
      {#if E.color === "accent"}
        <ColorInput
          bind:value={E.fallbackColor!}
          label="Fallback color"
          hint="Used for the bar when auto-color is on but the album art can't be fetched or read , so it isn't stuck on the failed accent."
          diagram="fallback"
        />
      {/if}
      <Slider bind:value={E.radius} min={0} max={30} label="Corner radius" suffix="px" />
    {/if}

    <!-- ===== Drop shadow (every element) ===== -->
    <hr class="border-border" />
    {@render header("Drop shadow", "A soft shadow cast behind this element.", "shadow-offset")}
    <Toggle bind:checked={E.shadow.enabled} label="Enable" />
    {#if E.shadow.enabled}
      <Slider bind:value={E.shadow.blur} min={0} max={40} label="Blur" suffix="px" hint="How soft and spread-out the shadow is. 0 = a hard edge." />
      <Slider bind:value={E.shadow.intensity} min={0} max={100} label="Intensity" suffix="%" hint="Shadow opacity." />
      <div class="grid grid-cols-2 gap-2">
        <Slider bind:value={E.shadow.offsetX} min={-20} max={20} label="Offset X" suffix="px" diagram="shadow-offset" hint="Nudge the shadow horizontally." />
        <Slider bind:value={E.shadow.offsetY} min={-20} max={20} label="Offset Y" suffix="px" hint="Nudge the shadow vertically." />
      </div>
      <Toggle bind:checked={E.shadow.useOppositeColor} label="Auto contrast color" hint="Pick a shadow color opposite the element's color, for contrast." />
      {#if !E.shadow.useOppositeColor}
        <ColorInput bind:value={E.shadow.customColor!} label="Shadow color" />
      {/if}
      {#if isTextSel}
        <Toggle
          bind:checked={E.shadow.escape}
          label="Shadow can leave the box"
          hint="Lets the shadow reach past the element's box (even past the widget edge), while the text itself stays clipped in place , so only the shadow spills out, not the text."
          diagram="shadow-escape"
        />
      {/if}
    {/if}

    <!-- ===== Background / widget-wide ===== -->
    {#if isBg}
      <hr class="border-border" />
      <Segmented
        bind:value={E.fill}
        label="Background"
        hint="What fills the widget behind everything: nothing, a solid color, the accent color, or a blurred album cover."
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
          hint="The background's accent-fill color when auto-color is on but the album art can't be fetched or read , so it isn't stuck on the failed accent."
          diagram="fallback"
        />
      {:else if E.fill === "art"}
        <Slider bind:value={E.fillOpacity} min={0} max={100} label="Opacity" suffix="%" diagram="fill-art" hint="A blurred album cover, scaled to the widget width, fills the background." />
      {/if}
      <Slider bind:value={E.radius} min={0} max={64} label="Corner radius" suffix="px" />

      <hr class="border-border" />
      <ColorInput bind:value={cfg.theme.accent} label="Accent color" hint="Used by any element whose color is set to 'auto', and by the accent background fill." />
      <Toggle bind:checked={cfg.theme.autoFromArt} label="Auto color from album art" hint="Pull the accent from the album art's dominant color, updating each song. When the art can't be read, each accent element uses its own 'Fallback color'." diagram="auto-color" />

      <hr class="border-border" />
      <label class="block">
        <div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          Global font
          <InfoTip text="The default font for all text. Each text element can override it under its own Font setting." label="Global font" />
        </div>
        <select bind:value={cfg.theme.font} class={inputCls}>
          {#each GOOGLE_FONTS as f (f)}
            <option value={f}>{f}</option>
          {/each}
        </select>
      </label>

      <hr class="border-border" />
      {@render header("Song-switch animation", "How the widget transitions when the playing song changes.", "switch-anim")}
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
            <InfoTip text="The speed curve of the animation , e.g. cubicOut eases out, backOut overshoots slightly." label="Easing" />
          </div>
          <select bind:value={v2.switchAnim.easing} class={inputCls}>
            {#each EASINGS as e (e)}
              <option value={e}>{e}</option>
            {/each}
          </select>
        </label>
      {/if}

      <hr class="border-border" />
      {@render header("When paused", "What the widget does when nothing is playing: show a paused label, or hide entirely.", "")}
      <Segmented
        bind:value={cfg.fields.pausedMode!}
        options={[
          { value: "label", label: "Show paused" },
          { value: "transparent", label: "Hide widget" },
        ]}
      />
      <input type="text" bind:value={cfg.fields.pausedText} placeholder="Paused" class={inputCls} />
    {/if}
  {/if}
</div>
