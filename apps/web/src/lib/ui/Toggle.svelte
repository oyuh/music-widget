<script lang="ts">
  import InfoTip from "./InfoTip.svelte";
  interface Props {
    checked?: boolean;
    label?: string;
    hint?: string;
    diagram?: string;
  }
  let { checked = $bindable(false), label = "", hint = "", diagram = "" }: Props = $props();
</script>

<div class="flex w-full items-center justify-between gap-3">
  <span class="flex items-center gap-1 text-sm">
    {#if label}{label}{/if}
    {#if hint}<InfoTip text={hint} diagram={diagram || undefined} {label} />{/if}
  </span>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onclick={() => (checked = !checked)}
    class="flex shrink-0 items-center text-left"
  >
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
</div>
