<script lang="ts">
  interface Props {
    checked?: boolean;
    label?: string;
  }
  let { checked = $bindable(false), label = "" }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  onclick={() => (checked = !checked)}
  class="flex w-full items-center justify-between gap-3 text-left"
>
  {#if label}<span class="text-sm">{label}</span>{/if}
  <span
    class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors {checked
      ? 'bg-green-500'
      : 'bg-zinc-600'}"
  >
    <span
      class="inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-1 ring-black/20 transition-transform {checked
        ? 'translate-x-4'
        : 'translate-x-0.5'}"
    ></span>
  </span>
</button>
