<script lang="ts">
  import Collapsible from "$lib/ui/Collapsible.svelte";
  import { CREDITS, creditUrl } from "$lib/credits";

  // Rendered straight from $lib/credits.ts, the same data the editor tooltips
  // use. Adding a credit there adds it here, no second list to keep in sync.
  const ICONS_FOR: Record<string, string> = {
    fallbackArt: "image",
    outline: "outline",
    instances: "layout",
    accentBrightness: "palette",
  };

  const entries = Object.entries(CREDITS);
  const open = $state<Record<string, boolean>>(
    Object.fromEntries(entries.map(([id], i) => [id, i === 0])),
  );

  const p = "text-sm leading-relaxed text-muted-foreground";
</script>

<svelte:head>
  <title>Credits | Jamlog</title>
  <meta name="description" content="Features of the Jamlog widget that exist because someone asked for them, and what shipped." />
</svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Credits</h1>
<p class="font-mono-ui mt-1 text-xs text-muted-foreground">{entries.length} suggestions shipped</p>

<p class="{p} mt-4 mb-6">
  A good chunk of this editor exists because someone wrote in through Give feedback and asked for it. Here's who asked
  for what, in their words, and what actually shipped. The same names show up on the tooltip for each setting.
</p>

<div class="flex flex-col gap-2">
  {#each entries as [id, credit] (id)}
    {@const url = creditUrl(credit)}
    <Collapsible title={credit.setting ?? id} icon={ICONS_FOR[id] ?? "sparkles"} badge={credit.name} bind:open={open[id]}>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        Suggested by
        {#if url}
          <a href={url} target="_blank" rel="noopener noreferrer" class="text-foreground underline underline-offset-4">
            {credit.name}
          </a>
        {:else}
          <span class="text-foreground">{credit.name}</span>
        {/if}
      </div>

      {#if credit.asked}
        <blockquote class="border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground italic">
          {credit.asked}
        </blockquote>
      {/if}

      {#if credit.shipped}
        <div>
          <div class="font-mono-ui mb-1 text-[10px] tracking-wide text-muted-foreground/70 uppercase">What shipped</div>
          <p class={p}>{credit.shipped}</p>
        </div>
      {/if}
    </Collapsible>
  {/each}
</div>

<div class="mt-6 rounded-lg border border-border bg-card p-4">
  <p class="mb-1 text-sm font-medium">Want your name on this page?</p>
  <p class={p}>
    Open the editor and hit Give feedback in the bottom left. Ideas that ship get credited here and in the tooltip for
    the setting they became.
  </p>
</div>
