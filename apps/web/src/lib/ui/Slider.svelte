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
</script>

<label class="block">
  {#if label}
    <div class="mb-1 flex items-center justify-between text-xs">
      <span class="text-muted-foreground">{label}</span>
      <span class="font-mono text-foreground">{value}{suffix}</span>
    </div>
  {/if}
  <input type="range" {min} {max} {step} bind:value class="h-1.5 w-full cursor-pointer accent-primary" />
</label>
