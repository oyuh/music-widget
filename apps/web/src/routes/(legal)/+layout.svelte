<script lang="ts">
  import { page } from "$app/state";

  // No header bar, no footer: just the page, with the two controls that are
  // actually useful here sitting inline above the content.
  let { children } = $props();

  // Both pages, reachable from each other.
  const TABS = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ];
  const here = $derived(page.url.pathname);
  const tab = "rounded-md px-2.5 py-1 transition-colors";
  const tabOn = "bg-muted text-foreground";
  const tabOff = "text-muted-foreground hover:text-foreground";
</script>

<div class="min-h-screen bg-background text-foreground">
  <div class="mx-auto w-full max-w-2xl px-5 py-8">
    <div class="font-mono-ui mb-8 flex items-center justify-between gap-3 text-xs">
      <a href="/" class="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
        </svg>
        Back to the editor
      </a>

      <div class="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
        {#each TABS as t (t.href)}
          <a href={t.href} class="{tab} {here.startsWith(t.href) ? tabOn : tabOff}">{t.label}</a>
        {/each}
      </div>
    </div>

    {@render children()}
  </div>
</div>
