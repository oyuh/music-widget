<script lang="ts">
  import type { Snippet } from "svelte";
  import { tip } from "./tooltip.svelte";

  interface Props {
    /** The definition, shown on hover. */
    def: string;
    /** Optional page to read more on. Without it the term is hover-only. */
    href?: string;
    children: Snippet;
  }
  let { def, href = "", children }: Props = $props();

  const cls =
    "cursor-help text-foreground underline decoration-dotted decoration-muted-foreground underline-offset-4 transition-colors hover:decoration-foreground";
</script>

{#if href}
  <a {href} target="_blank" rel="noopener noreferrer" use:tip={def} class={cls}>{@render children()}</a>
{:else}
  <span use:tip={def} class={cls}>{@render children()}</span>
{/if}
