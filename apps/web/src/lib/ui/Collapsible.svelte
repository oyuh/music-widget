<script lang="ts">
  import type { Snippet } from "svelte";
  interface Props {
    title: string;
    open?: boolean;
    /** Optional right-aligned badge (e.g. a count). */
    badge?: string;
    children?: Snippet;
  }
  let { title, open = $bindable(false), badge, children }: Props = $props();
</script>

<section class="overflow-hidden rounded-md border border-border/60 bg-zinc-900/40">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    class="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
  >
    <span class="font-pixel text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
    <span class="flex items-center gap-2">
      {#if badge}<span class="text-[11px] text-muted-foreground tabular-nums">{badge}</span>{/if}
      <svg
        class="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 {open ? 'rotate-90' : ''}"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 2.5 L8 6 L4 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </button>
  {#if open}
    <div class="flex flex-col gap-2 border-t border-border/50 px-2.5 pt-2.5 pb-2.5">
      {@render children?.()}
    </div>
  {/if}
</section>
