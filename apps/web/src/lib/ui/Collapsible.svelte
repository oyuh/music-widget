<script lang="ts">
  import type { Snippet } from "svelte";
  import InfoTip from "./InfoTip.svelte";
  import { ICONS } from "./icons";
  import type { Credit } from "$lib/credits";

  interface Props {
    title: string;
    open?: boolean;
    /** Optional right-aligned badge (e.g. a count). */
    badge?: string;
    /** Optional icon key (see icons.ts) shown before the title. */
    icon?: string;
    /** Optional InfoTip next to the title, same args as InfoTip itself. */
    hint?: string;
    diagram?: string;
    credit?: Credit;
    children?: Snippet;
  }
  let { title, open = $bindable(false), badge, icon, hint, diagram, credit, children }: Props = $props();
</script>

<section class="overflow-hidden rounded-md border border-border/60 bg-zinc-900/40">
  <!-- The InfoTip is a button of its own, so it sits beside the toggle rather
       than nested inside it. -->
  <div class="flex items-center">
    <button
      type="button"
      onclick={() => (open = !open)}
      aria-expanded={open}
      class="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
    >
      <span class="flex min-w-0 items-center gap-1.5 font-mono-ui text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {#if icon && ICONS[icon]}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html ICONS[icon]}</svg>
        {/if}
        <span class="truncate">{title}</span>
      </span>
      <span class="flex shrink-0 items-center gap-2">
        {#if badge}<span class="text-[11px] tabular-nums text-muted-foreground">{badge}</span>{/if}
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
    {#if hint}
      <!-- Reads as its own segment of the header: divider, hover state, the lot.
           There's nothing to click, it just answers to the pointer. -->
      <span class="flex items-center self-stretch border-l border-border/60 px-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
        <InfoTip text={hint} {diagram} label={title} {credit} />
      </span>
    {/if}
  </div>
  {#if open}
    <div class="flex flex-col gap-2 border-t border-border/50 px-2.5 pt-2.5 pb-2.5">
      {@render children?.()}
    </div>
  {/if}
</section>
