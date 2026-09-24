<script lang="ts">
  import InfoTip from "./InfoTip.svelte";
  interface Props {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    suffix?: string;
    hint?: string;
    diagram?: string;
  }
  let { value = $bindable(0), min = 0, max = 100, step = 1, label = "", suffix = "", hint = "", diagram = "" }: Props = $props();

  const THUMB = 18; // px, matches .mw-slider-thumb
  const SNAP_PX = 6; // how close the pointer must get to a round value before it catches

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const toStep = (n: number) => clamp(min + Math.round((n - min) / step) * step);

  // Shift-drag and Shift+arrow interval: a 1/2/5 round number giving ~20 stops.
  const interval = $derived.by(() => {
    const raw = (max - min) / 20;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const n = raw / mag;
    return Math.max(step, (n < 2 ? 1 : n < 4 ? 2 : n < 8 ? 5 : 10) * mag);
  });

  let track: HTMLDivElement;
  let thumb: HTMLSpanElement;
  let dragging = $state(false);
  let raw = $state(0); // unrounded pointer value, so the thumb glides between steps
  // Each round value catches the thumb once per drag. Once the pointer pulls
  // out of its zone it goes into `used` and stops catching until the next drag.
  let held: number | null = null;
  const used = new Set<number>();

  const shown = $derived(dragging ? raw : value);
  const frac = $derived(max > min ? Math.max(0, Math.min(1, (shown - min) / (max - min))) : 0);

  function pulse() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    thumb.animate([{ transform: "scale(1.2)" }, { transform: "scale(1)" }], { duration: 160, easing: "ease-out" });
  }

  function fromPointer(e: PointerEvent) {
    const r = track.getBoundingClientRect();
    const w = r.width - THUMB;
    let v = min + Math.max(0, Math.min(1, (e.clientX - r.left - THUMB / 2) / w)) * (max - min);
    if (e.shiftKey) {
      v = clamp(Math.round(v / interval) * interval);
    } else {
      const zone = (SNAP_PX / w) * (max - min);
      const target = clamp(Math.round(v / (interval * 5)) * interval * 5);
      if (held !== null && Math.abs(v - held) > zone) {
        used.add(held);
        held = null;
      }
      if (held === null && !used.has(target) && Math.abs(v - target) <= zone) {
        held = target;
        pulse();
      }
      if (held !== null) v = held;
    }
    raw = v;
    value = toStep(v);
  }

  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    track.setPointerCapture(e.pointerId);
    track.focus();
    used.clear();
    held = null;
    dragging = true;
    fromPointer(e);
  }

  function onSliderKey(e: KeyboardEvent) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp" ? 1
      : e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown" ? -1 : 0;
    if (dir) {
      // Shift / PageUp jump to the next interval line, not interval-from-here.
      value = e.shiftKey || e.key.startsWith("Page")
        ? clamp(dir > 0 ? Math.floor(value / interval) * interval + interval : Math.ceil(value / interval) * interval - interval)
        : toStep(value + dir * step);
    } else if (e.key === "Home") value = min;
    else if (e.key === "End") value = max;
    else return;
    e.preventDefault();
  }

  // Commit the typed value on blur / Enter (clamped). We deliberately don't clamp
  // on every keystroke so you can type e.g. "16" even when min is 8.
  function commit(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const n = Number(el.value);
    value = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
    el.value = String(value);
  }
  function onKey(e: KeyboardEvent) {
    // Keep typing/shortcut keys inside the field (don't bubble to global handlers).
    e.stopPropagation();
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
  }
</script>

<div class="block">
  {#if label || suffix}
    <div class="mb-1 flex items-center justify-between gap-2 text-xs">
      <span class="flex items-center gap-1 text-muted-foreground">
        {label}
        {#if hint}<InfoTip text={hint} diagram={diagram || undefined} {label} />{/if}
      </span>
      <div class="flex items-center gap-0.5 rounded bg-muted px-1 py-0.5 focus-within:ring-1 focus-within:ring-primary">
        <input
          type="number"
          {min}
          {max}
          {step}
          value={value}
          onchange={commit}
          onkeydown={onKey}
          aria-label={label || "value"}
          class="mw-num w-10 bg-transparent text-right font-mono text-[11px] text-foreground tabular-nums outline-none"
        />
        {#if suffix}<span class="font-mono text-[11px] text-muted-foreground">{suffix}</span>{/if}
      </div>
    </div>
  {/if}
  <div
    bind:this={track}
    role="slider"
    tabindex="0"
    aria-label={label || "value"}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    aria-valuetext={suffix ? `${value}${suffix}` : undefined}
    class="mw-slider"
    class:dragging
    style="--f:{frac}"
    onpointerdown={onDown}
    onpointermove={(e) => dragging && fromPointer(e)}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
    onkeydown={onSliderKey}
  >
    <span class="mw-slider-fill"></span>
    <span class="mw-slider-thumb" bind:this={thumb}></span>
  </div>
</div>

<style>
  /* Hide the spin buttons so the editable number reads like a value pill. */
  .mw-num::-webkit-outer-spin-button,
  .mw-num::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .mw-num {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
