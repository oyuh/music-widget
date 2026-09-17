<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";
  import Icon from "$lib/ui/Icon.svelte";
  import { tip } from "$lib/ui/tooltip.svelte";
  import "./wiki.css";

  let { data, children } = $props();

  // Search lives in the top bar and drops its results underneath, so the rail
  // stays a table of contents instead of swapping between two jobs.
  let query = $state("");
  let searchOpen = $state(false);
  let menuOpen = $state(false);
  // Icon-only rail, remembered between visits. Read after mount so the
  // prerendered HTML and the first client render agree.
  let railCollapsed = $state(false);

  const RAIL_KEY = "mw:wikiRail";
  const SUPPORT = [
    { label: "Buy me a coffee", icon: "coffee", href: "https://buymeacoffee.com/lawsonhart" },
    { label: "Ko-fi", icon: "heart", href: "https://ko-fi.com/lawsonhart" },
  ];

  const results = $derived(data.pages.filter((item) =>
    query.trim().toLowerCase().split(/\s+/).every((word) => `${item.title} ${item.label} ${item.search}`.toLowerCase().includes(word))));
  const showResults = $derived(searchOpen && query.trim().length > 0);
  const here = $derived(page.url.pathname.replace(/\/$/, ""));

  onMount(() => {
    try {
      railCollapsed = localStorage.getItem(RAIL_KEY) === "1";
    } catch { /* private mode, stay expanded */ }
  });

  function clearSearch() {
    query = "";
    searchOpen = false;
    document.getElementById("wiki-search")?.focus();
  }

  function toggleRail() {
    railCollapsed = !railCollapsed;
    try {
      localStorage.setItem(RAIL_KEY, railCollapsed ? "1" : "0");
    } catch { /* nothing worth failing over */ }
  }

  // A click anywhere else, or Escape, puts the results away.
  $effect(() => {
    if (!showResults) return;
    const away = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".wiki-search")) searchOpen = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { searchOpen = false; query = ""; }
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", escape);
    };
  });

  afterNavigate(() => { menuOpen = false; query = ""; searchOpen = false; });
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

<div class="wiki-shell" class:rail-collapsed={railCollapsed}>
  <a class="wiki-skip" href="#wiki-content">Skip to content</a>

  <header class="wiki-header">
    <div class="wiki-header-left">
      <button
        class="wiki-rail-toggle"
        onclick={toggleRail}
        aria-pressed={railCollapsed}
        aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        use:tip={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <Icon name="sidebar" class="wiki-icon" />
      </button>
      <div class="wiki-brand">
        <strong>fast.Jamlog.lol</strong>
        <span>Widget documentation</span>
      </div>
    </div>

    <div class="wiki-search" role="search">
      <label class="wiki-visually-hidden" for="wiki-search">Search the wiki</label>
      <Icon name="search" class="wiki-icon wiki-search-icon" />
      <input
        id="wiki-search"
        type="search"
        bind:value={query}
        onfocus={() => searchOpen = true}
        oninput={() => searchOpen = true}
        placeholder="Search the wiki…"
        autocomplete="off"
      />
      {#if query}
        <button class="wiki-search-clear" onclick={clearSearch} aria-label="Clear search">
          <Icon name="close" class="wiki-icon" />
        </button>
      {/if}
      {#if showResults}
        <div class="wiki-search-results">
          <p class="wiki-search-count" role="status">{results.length} {results.length === 1 ? "page" : "pages"} found</p>
          {#if results.length}
            <nav aria-label="Search results">
              {#each results as item}
                <a class="wiki-result" href={item.href}>
                  <span><Icon name={item.icon} class="wiki-icon" />{item.label}</span>
                  <small>{item.description}</small>
                </a>
              {/each}
            </nav>
          {:else}
            <p class="wiki-muted">Nothing matched. Try "OBS", "album art", or "CSS".</p>
          {/if}
        </div>
      {/if}
    </div>

    <nav class="wiki-header-nav" aria-label="Site navigation">
      <a class="wiki-button" href="https://github.com/oyuh/music-widget" target="_blank" rel="noopener noreferrer">
        <Icon name="code" class="wiki-icon" />GitHub
      </a>
      <a class="wiki-button wiki-button-primary" href="/">
        <Icon name="layout" class="wiki-icon" />Open editor
      </a>
      <button class="wiki-menu" onclick={() => menuOpen = !menuOpen} aria-expanded={menuOpen} aria-controls="wiki-sidebar">
        <Icon name={menuOpen ? "close" : "menu"} class="wiki-icon" />{menuOpen ? "Close" : "Menu"}
      </button>
    </nav>
  </header>

  <div class="wiki-grid">
    <aside id="wiki-sidebar" class:open={menuOpen} class="wiki-sidebar">
      <div class="wiki-rail-scroll">
        <nav aria-label="Wiki navigation">
          {#each data.groups as group}
            <p class="wiki-nav-group">{group}</p>
            {#each data.pages.filter((item) => item.group === group) as item}
              <a
                href={item.href}
                aria-current={here === item.href ? "page" : undefined}
                use:tip={railCollapsed ? item.label : ""}
              >
                <Icon name={item.icon} class="wiki-icon" /><span>{item.label}</span>
              </a>
            {/each}
          {/each}
        </nav>
      </div>

      <div class="wiki-rail-foot">
        <p class="wiki-nav-group">Support</p>
        <nav aria-label="Support the project">
          {#each SUPPORT as link}
            <a href={link.href} target="_blank" rel="noopener noreferrer" use:tip={railCollapsed ? link.label : ""}>
              <Icon name={link.icon} class="wiki-icon" /><span>{link.label}</span>
            </a>
          {/each}
        </nav>
      </div>
    </aside>

    <main id="wiki-content" tabindex="-1">{@render children()}</main>
  </div>
</div>
