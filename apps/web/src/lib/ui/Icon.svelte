<script lang="ts">
  import { ICONS } from "./icons";

  interface Props {
    /** Key from icons.ts. An unknown key renders nothing. */
    name: string;
    /** Sizing/color classes for the svg itself. */
    class?: string;
  }
  let { name, class: cls = "" }: Props = $props();
</script>

{#if ICONS[name]}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
  <svg viewBox="0 0 24 24" class={cls} fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html ICONS[name]}</svg>
{/if}
