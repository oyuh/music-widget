<script lang="ts">
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";
  import "./wiki.css";

  let { data, children } = $props();
  let query = $state("");
  let menuOpen = $state(false);
  const groups = ["Start here", "Build your widget", "Help"];
  const results = $derived(data.pages.filter((item) =>
    query.trim().toLowerCase().split(/\s+/).every((word) => `${item.title} ${item.label} ${item.search}`.toLowerCase().includes(word))));
  afterNavigate(() => { menuOpen = false; query = ""; });
</script>

<svelte:head>
  <meta name="theme-color" content="#111111" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Jamlog wiki" />
  <meta property="og:image" content="https://fast.jamlog.lol/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="wiki-shell">
  <a class="wiki-skip" href="#wiki-content">Skip to content</a>
  <header class="wiki-header">
    <a class="wiki-brand" href="/wiki"><strong>fast.Jamlog.lol</strong><span>Last.fm now-playing wiki</span></a>
    <nav aria-label="Site navigation">
      <a href="https://github.com/oyuh/music-widget" class="wiki-source">GitHub ↗</a>
      <a href="/" class="wiki-editor-link">Open editor →</a>
      <button class="wiki-menu" onclick={() => menuOpen = !menuOpen} aria-expanded={menuOpen} aria-controls="wiki-sidebar">{menuOpen ? "Close" : "Menu"}</button>
    </nav>
  </header>
  <div class="wiki-grid">
    <aside id="wiki-sidebar" class:open={menuOpen} class="wiki-sidebar">
      <label for="wiki-search" class="wiki-eyebrow">Find an answer</label>
      <div class="wiki-search-field">
        <input id="wiki-search" type="search" bind:value={query} placeholder="Search the wiki…" />
      </div>
      {#if query.trim()}
        <p class="wiki-search-count" role="status">{results.length} {results.length === 1 ? "page" : "pages"} found</p>
        <nav aria-label="Search results">
          {#each results as item}<a class="wiki-result" href={item.href}>{item.label}<small>{item.description}</small></a>{/each}
        </nav>
        {#if !results.length}<p class="wiki-muted">Try "OBS", "album art", or "CSS".</p>{/if}
        <button class="wiki-clear" onclick={() => query = ""}>Clear search</button>
      {:else}
        <nav aria-label="Wiki navigation">
          {#each groups as group}
            <p class="wiki-nav-group">{group}</p>
            {#each data.pages.filter((item) => item.group === group) as item}
              <a href={item.href} aria-current={page.url.pathname.replace(/\/$/, "") === item.href ? "page" : undefined}>
                {item.label}{#if item.slug === "playground"}<span aria-hidden="true">↗</span>{/if}
              </a>
            {/each}
          {/each}
        </nav>
      {/if}
      <div class="wiki-sidebar-note"><span class="wiki-eyebrow">Made for your stream</span><p>Last.fm music.<br />Your own design.</p><a href="/wiki/getting-started">Set up your first widget →</a></div>
    </aside>
    <main id="wiki-content" tabindex="-1">{@render children()}</main>
  </div>
</div>
