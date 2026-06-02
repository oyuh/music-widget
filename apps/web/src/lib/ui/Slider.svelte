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
</script>

<label class="block">
  {#if label}
    <div class="mb-1 flex items-center justify-between text-xs">
      <span class="text-muted-foreground">{label}</span>
      <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground tabular-nums">{value}{suffix}</span>
    </div>
  {/if}
  <input type="range" {min} {max} {step} bind:value class="mw-range" style="--pct:{pct}%" />
</label>
