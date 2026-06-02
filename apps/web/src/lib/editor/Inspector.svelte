<script lang="ts">
  import Slider from "$lib/ui/Slider.svelte";
  import ColorInput from "$lib/ui/ColorInput.svelte";
  import Toggle from "$lib/ui/Toggle.svelte";
  import Segmented from "$lib/ui/Segmented.svelte";
  import { GOOGLE_FONTS } from "$lib/google-fonts";
  import { TEXT_ELEMENTS, type EditorState, type ElementId } from "$lib/editor.svelte";

  interface Props {
    editor: EditorState;
  }
  let { editor }: Props = $props();

  const cfg = $derived(editor.config);
  const sel = $derived(editor.selected);
  const isTextSel = $derived(!!sel && (TEXT_ELEMENTS as readonly string[]).includes(sel));
  const tel = $derived(sel as "title" | "artist" | "album" | "duration");

  const labelOf: Record<ElementId, string> = {
    background: "Background & widget",
    art: "Album art",
    title: "Title",
    artist: "Artist",
    album: "Album",
    progress: "Progress bar",
    duration: "Duration",
  };

  const inputCls = "w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5 text-sm";
  const selectCls = inputCls;
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
  <div class="text-base font-semibold tracking-tight">
    {sel ? labelOf[sel] : "Widget"}
  </div>

  {#if isTextSel}
    <!-- ===== Text element ===== -->
    <Toggle bind:checked={cfg.fields[tel]} label="Visible" />
    <ColorInput bind:value={cfg.theme.text[tel]} label="Color" allowAccent />
    <Slider bind:value={cfg.theme.textSize![tel]} min={8} max={72} label="Size" suffix="px" />

    <div>
      <div class="mb-1 text-xs text-muted-foreground">Style</div>
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
      options={[
        { value: "none", label: "Aa" },
        { value: "uppercase", label: "AA" },
        { value: "lowercase", label: "aa" },
      ]}
    />

    <label class="block">
      <div class="mb-1 text-xs text-muted-foreground">Font</div>
      <select bind:value={cfg.theme.textFont![tel]} class={selectCls}>
        <option value={undefined}>Default (global)</option>
        {#each GOOGLE_FONTS as f (f)}
          <option value={f}>{f}</option>
        {/each}
      </select>
    </label>

    <div class="grid grid-cols-2 gap-2">
      <Slider bind:value={cfg.layout.textOffset![tel].x} min={-150} max={150} label="Nudge X" suffix="px" />
      <Slider bind:value={cfg.layout.textOffset![tel].y} min={-100} max={100} label="Nudge Y" suffix="px" />
    </div>

    {#if tel === "duration"}
      <hr class="border-border" />
      <Segmented
        bind:value={cfg.fields.durationFormat!}
        label="Format"
        options={[
          { value: "elapsed", label: "0:42" },
          { value: "remaining", label: "-2:18" },
          { value: "both", label: "0:42/3:00" },
        ]}
      />
      <Toggle bind:checked={cfg.fields.showDurationOnProgress!} label="Show under progress bar" />
      <Toggle bind:checked={cfg.fields.showDurationAsText!} label="Show as standalone text" />
    {/if}
  {:else if sel === "art"}
    <!-- ===== Album art ===== -->
    <Toggle bind:checked={cfg.layout.showArt} label="Show album art" />
    <Slider bind:value={cfg.layout.artSize} min={24} max={200} label="Size" suffix="px" />
    <Segmented
      bind:value={cfg.layout.artPosition}
      label="Position"
      options={[
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
        { value: "top", label: "Top" },
      ]}
    />
    <Slider bind:value={cfg.layout.artRadius!} min={0} max={100} label="Corner radius" suffix="px" />
  {:else if sel === "progress"}
    <!-- ===== Progress bar ===== -->
    <Toggle bind:checked={cfg.fields.progress} label="Show progress bar" />
    <Slider bind:value={cfg.layout.progressWidth!} min={0} max={600} label="Width (0 = full)" suffix="px" />
    <div class="grid grid-cols-2 gap-2">
      <Slider bind:value={cfg.layout.progressOffset!.x} min={-200} max={200} label="Nudge X" suffix="px" />
      <Slider bind:value={cfg.layout.progressOffset!.y} min={-100} max={100} label="Nudge Y" suffix="px" />
    </div>
    <Toggle bind:checked={cfg.fields.duration!} label="Track duration" />
    <Toggle bind:checked={cfg.fields.showDurationOnProgress!} label="Show duration under bar" />
  {:else}
    <!-- ===== Background / widget-wide ===== -->
    <div class="grid grid-cols-2 gap-2">
      <Slider bind:value={cfg.layout.w} min={120} max={800} label="Width" suffix="px" />
      <Slider bind:value={cfg.layout.h} min={60} max={400} label="Height" suffix="px" />
    </div>
    <Toggle bind:checked={cfg.theme.bgEnabled!} label="Background fill" />
    <ColorInput bind:value={cfg.theme.bg} label="Background color" />
    <Slider bind:value={cfg.layout.backgroundRadius!} min={0} max={64} label="Corner radius" suffix="px" />

    <hr class="border-border" />
    <ColorInput bind:value={cfg.theme.accent} label="Accent color" />
    <Toggle bind:checked={cfg.theme.autoFromArt} label="Auto color from album art" />
    <ColorInput bind:value={cfg.fallbackAccent!} label="Fallback accent" />

    <hr class="border-border" />
    <label class="block">
      <div class="mb-1 text-xs text-muted-foreground">Global font</div>
      <select bind:value={cfg.theme.font} class={selectCls}>
        {#each GOOGLE_FONTS as f (f)}
          <option value={f}>{f}</option>
        {/each}
      </select>
    </label>
    <Segmented
      bind:value={cfg.layout.align}
      label="Text align"
      options={[
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ]}
    />
    <Slider bind:value={cfg.layout.textGap!} min={0} max={24} label="Row gap" suffix="px" />

    <hr class="border-border" />
    <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Marquee</div>
    <Slider bind:value={cfg.marquee!.speedPxPerSec} min={0} max={120} label="Speed" suffix="px/s" />
    <Slider bind:value={cfg.marquee!.gapPx} min={0} max={120} label="Gap" suffix="px" />
    <Slider bind:value={cfg.layout.scrollTriggerWidth} min={60} max={400} label="Scroll trigger width" suffix="px" />

    <hr class="border-border" />
    <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">When paused</div>
    <Segmented
      bind:value={cfg.fields.pausedMode!}
      options={[
        { value: "label", label: "Show paused" },
        { value: "transparent", label: "Hide widget" },
      ]}
    />
    <input type="text" bind:value={cfg.fields.pausedText} placeholder="Paused" class={inputCls} />

    <hr class="border-border" />
    <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Drop shadow</div>
    <Toggle bind:checked={cfg.theme.dropShadow!.enabled} label="Enable" />
    {#if cfg.theme.dropShadow!.enabled}
      <Slider bind:value={cfg.theme.dropShadow!.blur} min={0} max={40} label="Blur" suffix="px" />
      <Slider bind:value={cfg.theme.dropShadow!.intensity} min={0} max={100} label="Intensity" suffix="%" />
      <div class="grid grid-cols-2 gap-2">
        <Slider bind:value={cfg.theme.dropShadow!.offsetX} min={-20} max={20} label="Offset X" suffix="px" />
        <Slider bind:value={cfg.theme.dropShadow!.offsetY} min={-20} max={20} label="Offset Y" suffix="px" />
      </div>
      <Toggle bind:checked={cfg.theme.dropShadow!.useOppositeColor} label="Auto contrast color" />
      {#if !cfg.theme.dropShadow!.useOppositeColor}
        <ColorInput bind:value={cfg.theme.dropShadow!.customColor!} label="Shadow color" />
      {/if}
      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Toggle bind:checked={cfg.theme.dropShadow!.targets.text} label="Text" />
        <Toggle bind:checked={cfg.theme.dropShadow!.targets.albumArt} label="Art" />
        <Toggle bind:checked={cfg.theme.dropShadow!.targets.progressBar} label="Bar" />
        <Toggle bind:checked={cfg.theme.dropShadow!.targets.background} label="Background" />
      </div>
    {/if}
  {/if}
</div>
