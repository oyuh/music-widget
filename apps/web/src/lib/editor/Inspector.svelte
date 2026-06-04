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

<div class="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
  <div class="text-base font-semibold tracking-tight">
    {sel ? labelOf[sel] : "Widget"}
  </div>

  {#if !sel || !E}
    <p class="text-xs text-muted-foreground">Click an element on the canvas to edit it.</p>
  {:else}
    {#if !isBg}
      <Toggle bind:checked={E.visible} label="Visible" />
    {/if}

    <!-- ===== Position ===== -->
    {#if !isBg}
      <div>
        <div class="mb-1 text-xs font-medium text-muted-foreground uppercase">Position</div>
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
          <Slider bind:value={E.x} min={-200} max={900} label="X" suffix="px" />
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
        <p class="mt-1 text-[11px] text-muted-foreground">Hold Shift while dragging on the canvas to snap to other elements.</p>
        <Slider bind:value={E.z} min={0} max={20} label="Layer (front/back)" />
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
            <span class="text-muted-foreground">Width</span>
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
      <ColorInput bind:value={E.color} label="Color" allowAccent />
      <Segmented
        bind:value={E.anchor}
        label="Anchor"
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ]}
      />
      <Slider bind:value={cfg.theme.textSize![tel]} min={8} max={72} label="Font size" suffix="px" />

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
        <select bind:value={cfg.theme.textFont![tel]} class={inputCls}>
          <option value={undefined}>Default (global)</option>
          {#each GOOGLE_FONTS as f (f)}
            <option value={f}>{f}</option>
          {/each}
        </select>
      </label>

      <hr class="border-border" />
      <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Scrolling</div>
      <Toggle bind:checked={E.scroll.enabled} label="Scroll when it overflows" />
      {#if E.scroll.enabled}
        <Segmented
          bind:value={E.scroll.direction}
          label="Direction"
          options={[
            { value: "left", label: "Left" },
            { value: "right", label: "Right" },
            { value: "bounce", label: "Bounce" },
          ]}
        />
        <Slider bind:value={E.scroll.speedPxPerSec} min={0} max={120} label="Speed" suffix="px/s" />
        <Slider bind:value={E.scroll.gapPx} min={0} max={120} label="Gap" suffix="px" />
      {/if}

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
      {/if}
    {:else if isArt}
      <hr class="border-border" />
      <Slider bind:value={E.radius} min={0} max={100} label="Corner radius" suffix="px" />
    {:else if isProgress}
      <hr class="border-border" />
      <ColorInput bind:value={E.color} label="Fill color" allowAccent />
      <Slider bind:value={E.radius} min={0} max={30} label="Corner radius" suffix="px" />
    {/if}

    <!-- ===== Drop shadow (every element) ===== -->
    <hr class="border-border" />
    <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Drop shadow</div>
    <Toggle bind:checked={E.shadow.enabled} label="Enable" />
    {#if E.shadow.enabled}
      <Slider bind:value={E.shadow.blur} min={0} max={40} label="Blur" suffix="px" />
      <Slider bind:value={E.shadow.intensity} min={0} max={100} label="Intensity" suffix="%" />
      <div class="grid grid-cols-2 gap-2">
        <Slider bind:value={E.shadow.offsetX} min={-20} max={20} label="Offset X" suffix="px" />
        <Slider bind:value={E.shadow.offsetY} min={-20} max={20} label="Offset Y" suffix="px" />
      </div>
      <Toggle bind:checked={E.shadow.useOppositeColor} label="Auto contrast color" />
      {#if !E.shadow.useOppositeColor}
        <ColorInput bind:value={E.shadow.customColor!} label="Shadow color" />
      {/if}
    {/if}

    <!-- ===== Background / widget-wide ===== -->
    {#if isBg}
      <hr class="border-border" />
      <Segmented
        bind:value={E.fill}
        label="Background"
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
      {:else if E.fill === "art"}
        <Slider bind:value={E.fillOpacity} min={0} max={100} label="Opacity" suffix="%" />
        <p class="text-[11px] text-muted-foreground">A blurred album cover scaled to the widget width fills the background.</p>
      {/if}
      <Slider bind:value={E.radius} min={0} max={64} label="Corner radius" suffix="px" />

      <hr class="border-border" />
      <ColorInput bind:value={cfg.theme.accent} label="Accent color" />
      <Toggle bind:checked={cfg.theme.autoFromArt} label="Auto color from album art" />
      <ColorInput bind:value={cfg.fallbackAccent!} label="Fallback accent" />

      <hr class="border-border" />
      <label class="block">
        <div class="mb-1 text-xs text-muted-foreground">Global font</div>
        <select bind:value={cfg.theme.font} class={inputCls}>
          {#each GOOGLE_FONTS as f (f)}
            <option value={f}>{f}</option>
          {/each}
        </select>
      </label>

      <hr class="border-border" />
      <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Song-switch animation</div>
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
          <div class="mb-1 text-xs text-muted-foreground">Easing</div>
          <select bind:value={v2.switchAnim.easing} class={inputCls}>
            {#each EASINGS as e (e)}
              <option value={e}>{e}</option>
            {/each}
          </select>
        </label>
      {/if}

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
    {/if}
  {/if}
</div>
