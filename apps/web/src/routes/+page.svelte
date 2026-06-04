<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import LeftRail from "$lib/editor/LeftRail.svelte";
  import Canvas from "$lib/editor/Canvas.svelte";
  import Inspector from "$lib/editor/Inspector.svelte";
  import { EditorState } from "$lib/editor.svelte";
  import { NowPlaying } from "$lib/nowplaying.svelte";
  import { resolveApiKey } from "$lib/lastfm-client";
  import { ensureGoogleFonts } from "$lib/fonts";
  import { isMobileDevice } from "$lib/device";
  import MobileGate from "$lib/MobileGate.svelte";

  // The editor needs a pointer + a wide screen — gate mobile to a simple page.
  // (The /w widget route is a separate page and stays usable everywhere.)
  const mobile = isMobileDevice();

  const editor = new EditorState();
  const np = new NowPlaying();

  // Colorful placeholder art so the canvas (and auto-from-art) has something
  // to show before a real track loads.
  const sampleArt =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#7c3aed'/><stop offset='0.55' stop-color='#db2777'/><stop offset='1' stop-color='#f59e0b'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/></svg>`,
    );

  onMount(() => {
    if (mobile) return; // no editor on mobile
    editor.load();
    editor.loadPresets();
    editor.initHistory();

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
  <title>Last.fm Music Widget</title>
</svelte:head>

{#if mobile}
  <MobileGate />
{:else}
  <div class="font-mono-ui grid h-screen grid-cols-[260px_1fr_320px] overflow-hidden bg-background text-foreground">
    <aside class="min-h-0 border-r border-border bg-sidebar">
      <LeftRail {editor} />
    </aside>

    <main class="min-h-0 overflow-hidden">
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

    <aside class="min-h-0 border-l border-border bg-sidebar">
      <Inspector {editor} />
    </aside>
  </div>
{/if}
