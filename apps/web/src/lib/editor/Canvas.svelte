<script lang="ts">
  import Widget from "$lib/Widget.svelte";
  import { TEXT_ELEMENTS, type EditorState, type ElementId } from "$lib/editor.svelte";

  interface Props {
    editor: EditorState;
    isLive?: boolean;
    isPaused?: boolean;
    percent?: number;
    progressMs?: number;
    durationMs?: number | null;
    title?: string;
    artist?: string;
    album?: string;
    art?: string;
  }

  let {
    editor,
    isLive = false,
    isPaused = false,
    percent = 30,
    progressMs = 60000,
    durationMs = 200000,
    title = "Song Title",
    artist = "Artist Name",
    album = "Album Name",
    art = "",
  }: Props = $props();

  let canvasEl = $state<HTMLDivElement | null>(null);
  let wrapperEl = $state<HTMLDivElement | null>(null);

  let selRect = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  let dragArt = $state(false);
  let artZone = $state<"left" | "right" | "top" | null>(null);

  const isText = (id: ElementId) => (TEXT_ELEMENTS as readonly string[]).includes(id);
  const selIsText = $derived(!!editor.selected && isText(editor.selected));

  // Track the selected element's box. Recomputes synchronously whenever the
  // selection or config changes (edits, drag) — getBoundingClientRect forces a
  // layout read so it's always accurate, with no rAF (works in background tabs).
  $effect(() => {
    const sel = editor.selected;
    JSON.stringify(editor.config); // deep dependency on any config change
    if (!sel || !wrapperEl) {
      selRect = null;
      return;
    }
    const el = wrapperEl.querySelector(`[data-el="${sel}"]`) as HTMLElement | null;
    if (!el) {
      selRect = null;
      return;
    }
    const wr = wrapperEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    selRect = { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height };
  });

  function bindDrag(onMove: (e: PointerEvent) => void) {
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      editor.save();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startTextDrag(e: PointerEvent, id: ElementId) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const offsets = editor.config.layout.textOffset!;
    const base = { ...offsets[id as keyof typeof offsets] };
    bindDrag((ev) => {
      const o = editor.config.layout.textOffset![id as keyof typeof offsets];
      o.x = Math.round(base.x + (ev.clientX - startX));
      o.y = Math.round(base.y + (ev.clientY - startY));
    });
  }

  function startArtDrag(e: PointerEvent) {
    e.preventDefault();
    dragArt = true;
    bindDrag((ev) => {
      if (!wrapperEl) return;
      const r = wrapperEl.getBoundingClientRect();
      const relX = ev.clientX - r.left;
      const relY = ev.clientY - r.top;
      const zone = relY < r.height * 0.38 ? "top" : relX < r.width / 2 ? "left" : "right";
      artZone = zone;
      editor.config.layout.artPosition = zone;
    });
    const cleanup = () => {
      dragArt = false;
      artZone = null;
      window.removeEventListener("pointerup", cleanup);
    };
    window.addEventListener("pointerup", cleanup);
  }

  function onCanvasDown(e: PointerEvent) {
    const node = (e.target as HTMLElement).closest("[data-el]") as HTMLElement | null;
    const id = node?.getAttribute("data-el") as ElementId | null;
    if (!id) {
      editor.select(null);
      return;
    }
    editor.select(id);
    if (isText(id)) startTextDrag(e, id);
    else if (id === "art") startArtDrag(e);
    else if (id === "progress") startProgressDrag(e);
  }

  function startProgressDrag(e: PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const base = { ...(editor.config.layout.progressOffset ?? { x: 0, y: 0 }) };
    bindDrag((ev) => {
      const o = editor.config.layout.progressOffset!;
      o.x = Math.round(base.x + (ev.clientX - startX));
      o.y = Math.round(base.y + (ev.clientY - startY));
    });
  }

  function startResize(e: PointerEvent, kind: "wh" | "w" | "h" | "art" | "text" | "progress") {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const L = editor.config.layout;
    const bw = L.w;
    const bh = L.h;
    const ba = L.artSize;
    const sel = editor.selected;
    const textKey = sel && isText(sel) ? (sel as "title" | "artist" | "album" | "duration") : null;
    const baseSize = textKey ? editor.config.theme.textSize![textKey] : 0;
    const progEl = wrapperEl?.querySelector('[data-el="progress"]') as HTMLElement | null;
    const baseProgW = L.progressWidth && L.progressWidth > 0 ? L.progressWidth : (progEl?.offsetWidth ?? 200);
    bindDrag((ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (kind === "wh" || kind === "w") L.w = Math.max(120, Math.round(bw + dx));
      if (kind === "wh" || kind === "h") L.h = Math.max(60, Math.round(bh + dy));
      if (kind === "art") L.artSize = Math.max(24, Math.round(ba + Math.max(dx, dy)));
      if (kind === "text" && textKey) {
        editor.config.theme.textSize![textKey] = Math.max(8, Math.min(120, Math.round(baseSize + Math.max(dx, dy) / 3)));
      }
      if (kind === "progress") L.progressWidth = Math.max(20, Math.round(baseProgW + dx));
    });
  }
</script>

<div
  bind:this={canvasEl}
  class="canvas-checker relative flex h-full w-full flex-col overflow-hidden select-none"
  onpointerdown={onCanvasDown}
  role="application"
  aria-label="Widget canvas"
>
  <!-- Undo / redo toolbar -->
  <div class="absolute top-3 left-3 z-30 flex gap-1">
    <button
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => editor.undo()}
      disabled={!editor.canUndo}
      title="Undo (Ctrl+Z)"
      aria-label="Undo"
      class="rounded-md border border-border bg-card px-2.5 py-1 text-sm shadow-sm transition hover:bg-muted disabled:opacity-40"
    >
      ↶
    </button>
    <button
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => editor.redo()}
      disabled={!editor.canRedo}
      title="Redo (Ctrl+Shift+Z)"
      aria-label="Redo"
      class="rounded-md border border-border bg-card px-2.5 py-1 text-sm shadow-sm transition hover:bg-muted disabled:opacity-40"
    >
      ↷
    </button>
  </div>

  <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
    <div bind:this={wrapperEl} class="relative">
    <Widget
      cfg={editor.config}
      {isLive}
      {isPaused}
      {percent}
      {progressMs}
      {durationMs}
      {title}
      {artist}
      {album}
      {art}
      preview
    />

    <!-- Art drop-zone hints -->
    {#if dragArt}
      {#each ["left", "right", "top"] as z (z)}
        <div
          class="pointer-events-none absolute rounded-md border-2 border-dashed transition-colors {artZone === z
            ? 'border-blue-400 bg-blue-400/10'
            : 'border-white/30'}"
          style={z === "top"
            ? "left:0;top:0;right:0;height:38%"
            : z === "left"
              ? "left:0;top:38%;width:50%;bottom:0"
              : "right:0;top:38%;width:50%;bottom:0"}
        ></div>
      {/each}
    {/if}

    <!-- Selection outline + handles -->
    {#if selRect}
      <div
        class="pointer-events-none absolute z-10"
        style="left:{selRect.x - 1}px;top:{selRect.y - 1}px;width:{selRect.w + 2}px;height:{selRect.h +
          2}px;border:2px solid #3b82f6;border-radius:4px"
      ></div>

      {#if editor.selected === "background"}
        <!-- widget resize handles -->
        <button
          aria-label="resize width and height"
          class="absolute z-20 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w - 5}px;top:{selRect.y + selRect.h - 5}px"
          onpointerdown={(e) => startResize(e, "wh")}
        ></button>
        <button
          aria-label="resize width"
          class="absolute z-20 h-3 w-3 cursor-ew-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w - 5}px;top:{selRect.y + selRect.h / 2 - 5}px"
          onpointerdown={(e) => startResize(e, "w")}
        ></button>
        <button
          aria-label="resize height"
          class="absolute z-20 h-3 w-3 cursor-ns-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w / 2 - 5}px;top:{selRect.y + selRect.h - 5}px"
          onpointerdown={(e) => startResize(e, "h")}
        ></button>
      {:else if editor.selected === "art"}
        <button
          aria-label="resize album art"
          class="absolute z-20 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w - 5}px;top:{selRect.y + selRect.h - 5}px"
          onpointerdown={(e) => startResize(e, "art")}
        ></button>
      {:else if selIsText}
        <button
          aria-label="resize text size"
          title="Drag to resize text"
          class="absolute z-20 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w - 5}px;top:{selRect.y + selRect.h - 5}px"
          onpointerdown={(e) => startResize(e, "text")}
        ></button>
      {:else if editor.selected === "progress"}
        <button
          aria-label="resize progress width"
          title="Drag to resize progress bar width"
          class="absolute z-20 h-3 w-3 cursor-ew-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w - 5}px;top:{selRect.y + selRect.h / 2 - 5}px"
          onpointerdown={(e) => startResize(e, "progress")}
        ></button>
      {/if}
    {/if}
    </div>
  </div>

  <footer
    class="font-pixel shrink-0 px-4 py-2.5 text-center text-[11px] leading-relaxed text-muted-foreground"
  >
    <div>Click an element to select · drag text/art to move · drag a handle to resize.</div>
    <div class="mt-1">
      Needs a free
      <a class="underline hover:text-foreground" href="https://www.last.fm/join" target="_blank" rel="noopener noreferrer"
        >Last.fm</a
      >
      account — connect your music service (Spotify, Apple Music, etc.) under
      <a
        class="underline hover:text-foreground"
        href="https://www.last.fm/settings/applications"
        target="_blank"
        rel="noopener noreferrer">Last.fm → Applications</a
      >
      so it scrobbles what you play, then enter your username in the sidebar.
    </div>
    <div class="mt-1 opacity-75">
      Album art and track data belong to their respective owners. Not affiliated with or endorsed by Last.fm, Spotify, or
      Apple — respect artwork &amp; content copyright.
    </div>
  </footer>
</div>
