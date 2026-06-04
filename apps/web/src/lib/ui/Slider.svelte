<script lang="ts">
  interface Props {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    suffix?: string;
  }
  let { value = $bindable(0), min = 0, max = 100, step = 1, label = "", suffix = "" }: Props = $props();

  const pct = $derived(max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0);

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

<label class="block">
  {#if label || suffix}
    <div class="mb-1 flex items-center justify-between gap-2 text-xs">
      <span class="text-muted-foreground">{label}</span>
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
  <input type="range" {min} {max} {step} bind:value class="mw-range" style="--pct:{pct}%" />
</label>

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
