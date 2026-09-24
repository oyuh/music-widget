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
    class="mw-switch-btn flex shrink-0 items-center text-left"
  >
    <span class="mw-switch" class:on={checked}><span class="mw-switch-thumb"></span></span>
  </button>
</div>
