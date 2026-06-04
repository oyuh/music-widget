<script lang="ts">
  import Widget from "$lib/Widget.svelte";
  import ColorInput from "$lib/ui/ColorInput.svelte";
  import { type EditorState, type ElementId } from "$lib/editor.svelte";
  import { V2_ELEMENT_IDS, type V2Edge } from "$lib/config";

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

  let wrapperEl = $state<HTMLDivElement | null>(null);
  let selRect = $state<{ x: number; y: number; w: number; h: number } | null>(null);

  // Snap guides shown while shift-dragging.
  let guideX = $state<number | null>(null);
  let guideY = $state<number | null>(null);

  const SNAP_PX = 8;

  type Box = { x: number; y: number; w: number; h: number };

  /** Selected element box in wrapper-local (unscaled) coords. */
  $effect(() => {
    const sel = editor.selected;
    JSON.stringify(editor.config); // deep dependency on any config change
    if (!sel || !wrapperEl) {
      selRect = null;
      return;
    }
    selRect = localBox(sel);
  });

  function localBox(id: ElementId): Box | null {
    if (!wrapperEl) return null;
    const node = wrapperEl.querySelector(`[data-el="${id}"]`) as HTMLElement | null;
    if (!node) return null;
    const wr = wrapperEl.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    return { x: (r.left - wr.left) / zoom, y: (r.top - wr.top) / zoom, w: r.width / zoom, h: r.height / zoom };
  }

  const edgeVal = (b: Box, edge: V2Edge, axis: "x" | "y") => {
    const base = axis === "x" ? b.x : b.y;
    const len = axis === "x" ? b.w : b.h;
    return base + (edge === "start" ? 0 : edge === "center" ? len / 2 : len);
  };

  type SnapCand = { to: ElementId; myEdge: V2Edge; toEdge: V2Edge; diff: number; guide: number } | null;

  /** Nearest edge alignment of the dragged element's edges to any other element. */
  function findSnap(axis: "x" | "y", dEdges: Record<V2Edge, number>, excludeId: ElementId): SnapCand {
    let best: SnapCand = null;
    let bestAbs = SNAP_PX;
    const edges: V2Edge[] = ["start", "center", "end"];
    for (const aid of V2_ELEMENT_IDS) {
      if (aid === excludeId || !editor.el(aid).visible) continue;
      const box = localBox(aid);
      if (!box) continue;
      for (const toEdge of edges) {
        const aVal = edgeVal(box, toEdge, axis);
        for (const myEdge of edges) {
          const diff = aVal - dEdges[myEdge];
          if (Math.abs(diff) < bestAbs) {
            bestAbs = Math.abs(diff);
            best = { to: aid, myEdge, toEdge, diff, guide: aVal };
          }
        }
      }
    }
    return best;
  }

  function bindDrag(onMove: (e: PointerEvent) => void, onEnd?: () => void) {
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onEnd?.();
      guideX = null;
      guideY = null;
      editor.save();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startDrag(e: PointerEvent, id: ElementId) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const base = localBox(id);
    if (!base) return;
    const z = zoom;
    let pendingX: SnapCand = null;
    let pendingY: SnapCand = null;

    bindDrag(
      (ev) => {
        const el = editor.el(id);
        let x = base.x + (ev.clientX - startX) / z;
        let y = base.y + (ev.clientY - startY) / z;
        pendingX = null;
        pendingY = null;
        guideX = null;
        guideY = null;

        if (ev.shiftKey) {
          const sx = findSnap("x", { start: x, center: x + base.w / 2, end: x + base.w }, id);
          if (sx) {
            x += sx.diff;
            pendingX = sx;
            guideX = sx.guide;
          }
          const sy = findSnap("y", { start: y, center: y + base.h / 2, end: y + base.h }, id);
          if (sy) {
            y += sy.diff;
            pendingY = sy;
            guideY = sy.guide;
          }
        }

        // Move freely during the drag; snaps (if any) are committed on drop.
        el.snapX = null;
        el.snapY = null;
        el.x = Math.round(x);
        el.y = Math.round(y);
      },
      () => commitSnaps(id, pendingX, pendingY),
    );
  }

  function commitSnaps(id: ElementId, px: SnapCand, py: SnapCand) {
    if (px) {
      const box = localBox(id);
      const a = localBox(px.to);
      if (box && a) {
        const offset = Math.round(edgeVal(box, px.myEdge, "x") - edgeVal(a, px.toEdge, "x"));
        editor.setSnap(id, "x", { to: px.to, myEdge: px.myEdge, toEdge: px.toEdge, offset });
      }
    }
    if (py) {
      const box = localBox(id);
      const a = localBox(py.to);
      if (box && a) {
        const offset = Math.round(edgeVal(box, py.myEdge, "y") - edgeVal(a, py.toEdge, "y"));
        editor.setSnap(id, "y", { to: py.to, myEdge: py.myEdge, toEdge: py.toEdge, offset });
      }
    }
  }

  function onCanvasDown(e: PointerEvent) {
    const node = (e.target as HTMLElement).closest("[data-el]") as HTMLElement | null;
    const id = node?.getAttribute("data-el") as ElementId | null;
    if (!id) {
      editor.select(null);
      return;
    }
    editor.select(id);
    if (id !== "background") startDrag(e, id);
  }

  // ---- resize ----
  function startResize(e: PointerEvent, kind: "br" | "r" | "b") {
    e.preventDefault();
    e.stopPropagation();
    const id = editor.selected;
    if (!id) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const dom = localBox(id);
    const el = editor.el(id);
    const baseW = el.w ?? dom?.w ?? 0;
    const baseH = el.h ?? dom?.h ?? 0;
    const minW = id === "background" ? 120 : 16;
    const minH = id === "background" ? 60 : 8;
    const z = zoom;
    bindDrag((ev) => {
      const dx = (ev.clientX - startX) / z;
      const dy = (ev.clientY - startY) / z;
      if (kind === "br" || kind === "r") editor.el(id).w = Math.max(minW, Math.round(baseW + dx));
      if (kind === "br" || kind === "b") editor.el(id).h = Math.max(minH, Math.round(baseH + dy));
    });
  }

  // ---- preview backdrop ----
  let canvasBg = $state("checker");
  function randomBg() {
    canvasBg = `hsl(${Math.floor(Math.random() * 360)} 70% 50%)`;
  }
  const stop = (e: PointerEvent) => e.stopPropagation();
  const bdBtn = "flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 transition hover:bg-muted hover:text-foreground";
  const bdActive = "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground";

  // ---- zoom ----
  let zoom = $state(1);
  let zoomAreaEl = $state<HTMLDivElement | null>(null);
  function setZoom(z: number) {
    zoom = Math.min(4, Math.max(0.5, Math.round(z * 100) / 100));
  }
  $effect(() => {
    const el = zoomAreaEl;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });
</script>

<div
  class="relative flex h-full w-full flex-col overflow-hidden select-none {canvasBg === 'checker' ? 'canvas-checker' : ''}"
  style={canvasBg === "checker" ? "" : `background:${canvasBg}`}
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

  <!-- Preview backdrop controls -->
  <div class="absolute top-3 right-3 z-30 flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-sm">
    <button onpointerdown={stop} onclick={() => (canvasBg = "checker")} title="Checkerboard" aria-label="Checkerboard backdrop" class="{bdBtn} {canvasBg === 'checker' ? bdActive : ''}">
      <svg viewBox="0 0 16 16" class="h-4 w-4" aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.2" />
        <rect x="1.5" y="1.5" width="6.5" height="6.5" fill="currentColor" opacity="0.85" />
        <rect x="8" y="8" width="6.5" height="6.5" fill="currentColor" opacity="0.85" />
      </svg>
    </button>
    <button onpointerdown={stop} onclick={() => (canvasBg = "#000000")} title="Black" aria-label="Black backdrop" class="{bdBtn} {canvasBg === '#000000' ? bdActive : ''}">
      <svg viewBox="0 0 16 16" class="h-4 w-4" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="currentColor" /></svg>
    </button>
    <button onpointerdown={stop} onclick={() => (canvasBg = "#ffffff")} title="White" aria-label="White backdrop" class="{bdBtn} {canvasBg === '#ffffff' ? bdActive : ''}">
      <svg viewBox="0 0 16 16" class="h-4 w-4" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
    </button>
    <button onpointerdown={stop} onclick={randomBg} title="Random color" aria-label="Random backdrop" class={bdBtn}>
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="m4 4 5 5" />
      </svg>
    </button>
    <span class="mx-0.5 h-5 w-px bg-border"></span>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="flex items-center" onpointerdown={stop}>
      <ColorInput compact label="Custom backdrop color" bind:value={canvasBg} />
    </div>
  </div>

  <!-- Zoom controls -->
  <div class="absolute top-[4.25rem] right-3 z-30 flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-sm">
    <button onpointerdown={stop} onclick={() => setZoom(zoom - 0.25)} title="Zoom out" aria-label="Zoom out" class={bdBtn}>
      <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3.5 8h9" /></svg>
    </button>
    <button onpointerdown={stop} onclick={() => setZoom(1)} title="Reset zoom (scroll over the preview to zoom)" aria-label="Reset zoom" class="min-w-[3rem] rounded-md px-1.5 py-1 text-center text-xs tabular-nums text-foreground/80 transition hover:bg-muted hover:text-foreground">
      {Math.round(zoom * 100)}%
    </button>
    <button onpointerdown={stop} onclick={() => setZoom(zoom + 0.25)} title="Zoom in" aria-label="Zoom in" class={bdBtn}>
      <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" /></svg>
    </button>
  </div>

  <div bind:this={zoomAreaEl} class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
    <div bind:this={wrapperEl} class="relative" style="transform:scale({zoom});transform-origin:center">
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

      <!-- Snap guides (shift-drag) -->
      {#if guideX != null}
        <div class="pointer-events-none absolute top-0 bottom-0 z-30" style="left:{guideX}px;width:1px;background:#22d3ee"></div>
      {/if}
      {#if guideY != null}
        <div class="pointer-events-none absolute right-0 left-0 z-30" style="top:{guideY}px;height:1px;background:#22d3ee"></div>
      {/if}

      <!-- Selection outline + resize handles -->
      {#if selRect}
        <div
          class="pointer-events-none absolute z-10"
          style="left:{selRect.x - 1}px;top:{selRect.y - 1}px;width:{selRect.w + 2}px;height:{selRect.h +
            2}px;border:2px solid #3b82f6;border-radius:4px"
        ></div>

        <!-- bottom-right (w+h) -->
        <button
          aria-label="resize width and height"
          title="Drag to resize"
          class="absolute z-20 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w - 5}px;top:{selRect.y + selRect.h - 5}px"
          onpointerdown={(e) => startResize(e, "br")}
        ></button>
        <!-- right-middle (width) -->
        <button
          aria-label="resize width"
          title="Drag to resize width"
          class="absolute z-20 h-3 w-3 cursor-ew-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w - 5}px;top:{selRect.y + selRect.h / 2 - 5}px"
          onpointerdown={(e) => startResize(e, "r")}
        ></button>
        <!-- bottom-middle (height) -->
        <button
          aria-label="resize height"
          title="Drag to resize height"
          class="absolute z-20 h-3 w-3 cursor-ns-resize rounded-sm border border-white bg-blue-500"
          style="left:{selRect.x + selRect.w / 2 - 5}px;top:{selRect.y + selRect.h - 5}px"
          onpointerdown={(e) => startResize(e, "b")}
        ></button>
      {/if}
    </div>
  </div>

  <footer class="font-pixel shrink-0 px-4 py-2.5 text-center text-[11px] leading-relaxed text-muted-foreground">
    <div>Jamlog was created and is ran by <a
        class="underline hover:text-foreground"
        href="https://lawsonhart.me"
        target="_blank"
        rel="noopener noreferrer">Lawson Hart</a
      >.</div>
    <div>Click an element to select · drag to move · hold <b>Shift</b> while dragging to snap to other elements · drag a handle to resize.</div>
    <div class="mt-1">
      Connect your music service (Spotify, Apple Music, etc.) under
      <a
        class="underline hover:text-foreground"
        href="https://www.last.fm/settings/applications"
        target="_blank"
        rel="noopener noreferrer">Last.fm → Applications</a
      >
      so it scrobbles what you play, then enter your username in the sidebar. Not affiliated with or endorsed by Last.fm, Spotify, or
      Apple, respect artwork &amp; content copyright.
    </div>
    <div class="mt-1 opacity-75">
    </div>
  </footer>
</div>
