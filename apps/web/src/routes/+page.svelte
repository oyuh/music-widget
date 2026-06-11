<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { slide, fly } from "svelte/transition";
  import LeftRail from "$lib/editor/LeftRail.svelte";
  import Canvas from "$lib/editor/Canvas.svelte";
  import Inspector from "$lib/editor/Inspector.svelte";
  import { EditorState } from "$lib/editor.svelte";
  import { NowPlaying } from "$lib/nowplaying.svelte";
  import { resolveApiKey } from "$lib/lastfm-client";
  import { ensureGoogleFonts } from "$lib/fonts";
  import { isMobileDevice } from "$lib/device";
  import MobileGate from "$lib/MobileGate.svelte";
  import WelcomeModal from "$lib/editor/WelcomeModal.svelte";
  import { KEYWORDS_META } from "$lib/keywords";

  // The editor needs a pointer + a wide screen , gate mobile to a simple page.
  // (The /w widget route is a separate page and stays usable everywhere.)
  const mobile = isMobileDevice();

  const editor = new EditorState();
  const np = new NowPlaying();

  // Sidebar visibility + widths , persisted separately from the design config
  // so panel layout never dirties the widget / undo history.
  const PANELS_KEY = "mw:panels";
  const PANEL_DEFAULTS = { left: 260, right: 320 };
  const PANEL_MIN = 180;
  const PANEL_MAX = 460;
  // Dragging a panel below this fraction of its default width snaps it closed.
  const HIDE_AT = 0.15;

  function loadPanels() {
    const d = { left: true, leftW: PANEL_DEFAULTS.left, rightW: PANEL_DEFAULTS.right };
    if (typeof window === "undefined") return d;
    try {
      return { ...d, ...JSON.parse(localStorage.getItem(PANELS_KEY) ?? "{}") };
    } catch {
      return d;
    }
  }
  const panels = loadPanels();
  const clampW = (w: number) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, w));
  let leftOpen = $state(panels.left);
  // The inspector follows the selection (see the effect below), and nothing is
  // selected on load, so it always starts closed.
  let rightOpen = $state(false);
  let leftW = $state(clampW(panels.leftW));
  let rightW = $state(clampW(panels.rightW));
  let resizing = $state<"left" | "right" | null>(null);

  function savePanels() {
    try {
      localStorage.setItem(PANELS_KEY, JSON.stringify({ left: leftOpen, leftW, rightW }));
    } catch {
      /* ignore */
    }
  }

  function setPanelOpen(side: "left" | "right", open: boolean) {
    // Reopen at the default width unless the panel was wider before it was
    // hidden , a panel squeezed below the default shouldn't come back squeezed.
    if (side === "left") {
      if (open && !leftOpen) leftW = Math.max(leftW, PANEL_DEFAULTS.left);
      leftOpen = open;
    } else {
      if (open && !rightOpen) rightW = Math.max(rightW, PANEL_DEFAULTS.right);
      rightOpen = open;
    }
  }

  function togglePanel(side: "left" | "right") {
    setPanelOpen(side, side === "left" ? !leftOpen : !rightOpen);
    savePanels();
  }

  function startPanelResize(side: "left" | "right", e: PointerEvent) {
    e.preventDefault(); // don't start a text selection in the sidebar
    resizing = side;
    document.body.style.cursor = "col-resize";
    const move = (ev: PointerEvent) => {
      const raw = side === "left" ? ev.clientX : window.innerWidth - ev.clientX;
      if (raw < PANEL_DEFAULTS[side] * HIDE_AT) {
        end();
        togglePanel(side); // dragged (nearly) shut , snap closed
        return;
      }
      if (side === "left") leftW = clampW(raw);
      else rightW = clampW(raw);
    };
    const end = () => {
      resizing = null;
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      savePanels();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  // The inspector OPENS to follow a selection but never auto-closes: clicking
  // off an element keeps the panel up (it falls back to widget-level settings).
  // Closing is explicit , the header toggle or dragging the panel shut. untrack
  // keeps the panel state out of this effect's dependencies, so only the
  // selection changing reruns it (a width drag must not re-trigger it).
  //
  // Opening waits for pointer release: selecting an element also starts a drag,
  // and the panel sliding open mid-drag reflows the canvas under the cursor.
  // The cleanup drops a still-pending listener if the selection changes again
  // (or clears) before the button is released.
  $effect(() => {
    if (mobile) return;
    if (!editor.selected) return;
    const onUp = () =>
      untrack(() => {
        if (editor.selected) setPanelOpen("right", true);
      });
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  });

  // Colorful placeholder art so the canvas (and auto-from-art) has something
  // to show before a real track loads.
  const sampleArt =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#7c3aed'/><stop offset='0.55' stop-color='#db2777'/><stop offset='1' stop-color='#f59e0b'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/></svg>`,
    );

  // First-visit onboarding: anyone without a Last.fm username yet (covers both
  // brand-new visitors and connected-session users, whose name auto-fills on load).
  let welcomeOpen = $state(false);

  onMount(() => {
    if (mobile) return; // no editor on mobile
    editor.load();
    editor.loadPresets();
    editor.initHistory();
    if (!(editor.config.lfmUser ?? "").trim()) welcomeOpen = true;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextField =
        (target instanceof HTMLInputElement &&
          ["text", "search", "url", "email", "password", "number", "tel", "range"].includes(target.type)) ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;
      if (isTextField) return; // let inputs (incl. focused sliders) keep their native keys

      // Arrow keys nudge the selected element (Shift = bigger step). When an
      // axis is snapped, the nudge adjusts the snap offset so the anchored
      // relationship is preserved.
      if (e.key.startsWith("Arrow") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const sel = editor.selected;
        if (!sel || sel === "background" || !editor.config.v2) return;
        e.preventDefault();
        const el = editor.config.v2.elements[sel];
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowUp") el.snapY ? (el.snapY.offset -= step) : (el.y -= step);
        else if (e.key === "ArrowDown") el.snapY ? (el.snapY.offset += step) : (el.y += step);
        else if (e.key === "ArrowLeft") el.snapX ? (el.snapX.offset -= step) : (el.x -= step);
        else if (e.key === "ArrowRight") el.snapX ? (el.snapX.offset += step) : (el.x += step);
        editor.save();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        editor.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  onDestroy(() => np.destroy());

  // Live preview from the configured user (falls back to the sample below).
  $effect(() => {
    if (mobile) return;
    np.setSource(editor.config.lfmUser ?? "", editor.config.sessionKey ?? null, resolveApiKey(editor.config.apiKey));
  });

  // Keep Google Fonts in sync with the design.
  $effect(() => {
    if (mobile) return;
    ensureGoogleFonts(editor.config);
  });

  // Autosave to localStorage (debounced).
  let saveTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    if (mobile) return;
    JSON.stringify(editor.config); // establish a deep dependency
    editor.dirty = true; // enable undo immediately; cleared when the commit settles
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      editor.commitIfChanged();
      editor.save();
    }, 350);
  });

  const isPlaceholder = (u?: string) => !!u && /2a96cbd8b46e442fc41c2b86b821562f/i.test(u);
  const hasLive = $derived(!!np.track);
  const liveArt = $derived.by(() => {
    const imgs = np.track?.image ?? [];
    for (let i = imgs.length - 1; i >= 0; i--) {
      const u = imgs[i]?.["#text"] ?? "";
      if (u && !isPlaceholder(u)) return u;
    }
    return "";
  });

  const dTitle = $derived(hasLive ? (np.track!.name ?? "—") : "Song Title");
  const dArtist = $derived(hasLive ? (np.track!.artist?.["#text"] ?? "—") : "Artist Name");
  const dAlbum = $derived(hasLive ? (np.track!.album?.["#text"] ?? "") : "Album Name");
  const dArt = $derived(hasLive ? liveArt : sampleArt);
</script>

<svelte:head>
  <title>Last.fm Now Playing Widget — Free Music Overlay for OBS & Twitch</title>
  <meta name="keywords" content={KEYWORDS_META} />
</svelte:head>

<!-- Screen-reader / crawler copy: the editor UI itself has almost no indexable
     text, so this gives the page a semantic h1 + summary without altering the visuals. -->
<h1 class="sr-only">Last.fm Now Playing Widget — free music overlay for OBS, Twitch and YouTube streams</h1>
<p class="sr-only">
  Build a now-playing widget in a drag-and-drop editor and show the song you're listening to on
  stream. Works as an OBS, Streamlabs or XSplit browser source, with album art, artist, title and a
  live progress bar. Powered by Last.fm — scrobble from Spotify, Apple Music, YouTube Music and
  more. Free, no account, no watermark.
</p>

{#if mobile}
  <MobileGate />
{:else}
  <div class="font-mono-ui relative flex h-screen overflow-hidden bg-background text-foreground">
    <WelcomeModal bind:open={welcomeOpen} {editor} />
    {#if leftOpen}
      <aside
        transition:slide={{ axis: "x", duration: 220 }}
        class="relative min-h-0 shrink-0 border-r border-border bg-sidebar"
        style="width:{leftW}px"
      >
        <!-- Fixed-width inner box so content doesn't reflow while the panel slides -->
        <div class="relative h-full" style="width:{leftW}px">
          <button
            onclick={() => togglePanel("left")}
            title="Hide sidebar"
            aria-label="Hide left sidebar"
            class="absolute top-2.5 right-2 z-10 rounded-md border border-border p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" />
            </svg>
          </button>
          <LeftRail {editor} />
        </div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onpointerdown={(e) => startPanelResize("left", e)}
          title="Drag to resize. Drag all the way in to hide."
          class="absolute inset-y-0 -right-px z-20 w-1.5 cursor-col-resize transition-colors hover:bg-ring/50 {resizing === 'left' ? 'bg-ring/50' : ''}"
        ></div>
      </aside>
    {/if}

    <main class="min-h-0 min-w-0 flex-1 overflow-hidden">
      <Canvas
        {editor}
        isLive={hasLive ? np.isLive : true}
        isPaused={hasLive ? np.isPaused : false}
        percent={hasLive ? np.percent : 35}
        progressMs={hasLive ? np.progressMs : 63000}
        durationMs={hasLive ? np.durationMs : 180000}
        title={dTitle}
        artist={dArtist}
        album={dAlbum}
        art={dArt}
      />
    </main>

    {#if rightOpen}
      <aside
        transition:slide={{ axis: "x", duration: 220 }}
        class="relative min-h-0 shrink-0 border-l border-border bg-sidebar"
        style="width:{rightW}px"
      >
        <div class="relative ml-auto h-full" style="width:{rightW}px">
          <button
            onclick={() => togglePanel("right")}
            title="Hide sidebar"
            aria-label="Hide right sidebar"
            class="absolute top-2.5 right-2 z-10 rounded-md border border-border p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" />
            </svg>
          </button>
          <Inspector {editor} />
        </div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onpointerdown={(e) => startPanelResize("right", e)}
          title="Drag to resize. Drag all the way in to hide."
          class="absolute inset-y-0 -left-px z-20 w-1.5 cursor-col-resize transition-colors hover:bg-ring/50 {resizing === 'right' ? 'bg-ring/50' : ''}"
        ></div>
      </aside>
    {/if}

    <!-- Restore tabs: hang off the page edge while a sidebar is hidden -->
    {#if !leftOpen}
      <button
        transition:fly={{ x: -16, duration: 180, delay: 120 }}
        onclick={() => togglePanel("left")}
        title="Show sidebar"
        aria-label="Show left sidebar"
        class="absolute top-1/2 left-0 z-40 -translate-y-1/2 rounded-r-md border border-l-0 border-border bg-card px-0.5 py-3 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" />
        </svg>
      </button>
    {/if}
    {#if !rightOpen}
      <button
        transition:fly={{ x: 16, duration: 180, delay: 120 }}
        onclick={() => togglePanel("right")}
        title="Show sidebar"
        aria-label="Show right sidebar"
        class="absolute top-1/2 right-0 z-40 -translate-y-1/2 rounded-l-md border border-r-0 border-border bg-card px-0.5 py-3 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" />
        </svg>
      </button>
    {/if}
  </div>
{/if}
