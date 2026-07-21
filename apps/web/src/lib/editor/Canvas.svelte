<script lang="ts">
  import { fly, slide } from "svelte/transition";
  import Widget from "$lib/Widget.svelte";
  import ColorInput from "$lib/ui/ColorInput.svelte";
  import ExperimentalModal from "$lib/editor/ExperimentalModal.svelte";
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

  // Simulate the paused/stopped state so the pause symbol (and hide-widget behavior)
  // can be previewed and positioned. The manual toggle is a plain on/off; selecting
  // the pause element forces it on transiently (so you can see/drag it) WITHOUT
  // latching the toggle, so deselecting returns the preview to the real play state.
  let simPaused = $state(false);
  const pauseSelectable = $derived((editor.config.fields.pausedMode ?? "label") === "label");
  const previewPaused = $derived(
    isPaused || simPaused || (editor.selected === "pause" && pauseSelectable),
  );

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
    // Offsets at drag start: snapped axes move by re-deriving the offset from
    // these each event, so there's no incremental rounding drift.
    const el0 = editor.el(id);
    const baseOffX = el0.snapX?.offset ?? 0;
    const baseOffY = el0.snapY?.offset ?? 0;
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

        // Dragging never severs an existing snap (that's the Inspector's Unsnap
        // button): an actively snapped axis follows the pointer by adjusting its
        // snap offset (same as arrow-key nudging), so snaps that depend on this
        // element and the art-failure fallback keep working. An axis whose snap
        // is inactive (hidden anchor) renders at its free coordinate, so move
        // that instead. Shift-snaps found above are committed on drop.
        if (editor.snapActive(id, "x")) el.snapX!.offset = Math.round(baseOffX + (x - base.x));
        else el.x = Math.round(x);
        if (editor.snapActive(id, "y")) el.snapY!.offset = Math.round(baseOffY + (y - base.y));
        else el.y = Math.round(y);
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
  // Backdrop + pause-preview controls hide behind a chevron toggle next to the zoom box.
  let controlsOpen = $state(false);
  function randomBg() {
    canvasBg = `hsl(${Math.floor(Math.random() * 360)} 70% 50%)`;
  }
  const stop = (e: PointerEvent) => e.stopPropagation();
  const bdBtn = "flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 transition hover:bg-muted hover:text-foreground";
  const bdActive = "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground";

  // ---- experimental features ----
  let experimentalOpen = $state(false);
  const experimentalOn = $derived(!!editor.config.experimental?.enabled);

  // ---- footer: community / support links ----
  const LINKS = {
    discord: "https://discordapp.com/users/527167786200465418",
    github: "https://github.com/oyuh/music-widget",
    bmac: "https://buymeacoffee.com/lawsonhart",
    kofi: "https://ko-fi.com/lawsonhart",
  };
  let supportOpen = $state(false);
  // The support button alternates its label between the two tip jars.
  let showKofi = $state(false);
  $effect(() => {
    const t = setInterval(() => (showKofi = !showKofi), 2000);
    return () => clearInterval(t);
  });
  // Any pointerdown outside the support button/menu closes the menu.
  $effect(() => {
    if (!supportOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-support]")) supportOpen = false;
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  });
  const ftBtn =
    "flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground/70 shadow-sm transition hover:bg-muted hover:text-foreground";

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

  <!-- Editing hint -->
  <div
    class="font-pixel absolute top-3 left-1/2 z-20 flex max-w-[55%] -translate-x-1/2 cursor-default items-center gap-2 text-[11px] text-muted-foreground transition-opacity duration-200 {controlsOpen
      ? 'pointer-events-none opacity-0'
      : ''}"
  >
    <span class="flex items-center gap-1" title="Click an element to select it">
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="m13 13 6 6" />
      </svg>
      select
    </span>
    <span>·</span>
    <span class="flex items-center gap-1" title="Drag an element to move it">
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 9 2 12l3 3" /><path d="m9 5 3-3 3 3" /><path d="m15 19-3 3-3-3" /><path d="m19 9 3 3-3 3" /><path d="M2 12h20" /><path d="M12 2v20" />
      </svg>
      drag
    </span>
    <span>·</span>
    <span class="flex items-center gap-1" title="Hold Shift while dragging to snap to other elements">
      <b>Shift</b>
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15" /><path d="m5 8 4 4" /><path d="m12 15 4 4" />
      </svg>
      snap
    </span>
    <span>·</span>
    <span class="flex items-center gap-1" title="Drag a handle to resize">
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="m21 3-7 7" /><path d="m3 21 7-7" />
      </svg>
      resize
    </span>
  </div>

  <!-- Top-right controls: zoom always visible; backdrop + pause preview tuck behind a chevron toggle -->
  <div class="absolute top-3 right-3 z-30 flex items-center gap-1.5">
    {#if controlsOpen}
      <div
        transition:slide={{ axis: "x", duration: 220 }}
        class="flex items-center gap-0.5 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-sm"
      >
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
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="flex items-center" onpointerdown={stop}>
          <ColorInput compact label="Custom backdrop color" bind:value={canvasBg} />
        </div>
        <span class="mx-0.5 h-5 w-px bg-border"></span>
        <!-- Preview the paused state (shows the pause symbol / hide-widget behavior) -->
        <button
          onpointerdown={stop}
          onclick={() => (simPaused = !simPaused)}
          title="Preview how the widget looks when paused / stopped"
          aria-label="Paused preview"
          class="{bdBtn} {previewPaused ? bdActive : ''}"
        >
          <svg viewBox="0 0 16 16" class="h-4 w-4" fill="currentColor" aria-hidden="true">
            <rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" />
          </svg>
        </button>
        <span class="mx-0.5 h-5 w-px bg-border"></span>
        <!-- Experimental features (custom CSS); the modal is the on/off switch -->
        <button
          onpointerdown={stop}
          onclick={() => (experimentalOpen = true)}
          title="Experimental features"
          aria-label="Experimental features"
          class="{bdBtn} {experimentalOn ? 'text-amber-500 hover:text-amber-500' : ''}"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 2v7.31l-5.42 8.13A2 2 0 0 0 6.24 20.5h11.52a2 2 0 0 0 1.66-3.06L14 9.31V2" />
            <path d="M8.5 2h7" /><path d="M7 15h10" />
          </svg>
        </button>
      </div>
    {/if}

    <button
      onpointerdown={stop}
      onclick={() => (controlsOpen = !controlsOpen)}
      title={controlsOpen ? "Hide canvas controls" : "Show canvas controls"}
      aria-label={controlsOpen ? "Hide canvas controls" : "Show canvas controls"}
      aria-expanded={controlsOpen}
      class="rounded-md border border-border bg-card p-1 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
    >
      {#if controlsOpen}
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" />
        </svg>
      {/if}
    </button>

    <!-- Zoom controls -->
    <div class="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-sm">
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
  </div>

  <div bind:this={zoomAreaEl} class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
    <div bind:this={wrapperEl} class="relative" style="transform:scale({zoom});transform-origin:center">
      <Widget
        cfg={editor.config}
        {isLive}
        isPaused={previewPaused}
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

  <footer class="font-pixel relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
    <!-- Connect blurb, stuck to the left / sidebar side -->
    <div class="min-w-0">
      <div class="mt-0.5">
        <a class="underline hover:text-foreground" href="https://lawsonhart.me/" target="_blank" rel="noopener noreferrer">Made by Lawson Hart</a>
        |
        <a class="underline hover:text-foreground" href="https://www.last.fm/about/trackmymusic" target="_blank" rel="noopener noreferrer">How to set up scrobbling</a>
      </div>
      <div class="opacity-75">Not affiliated with Last.fm, Spotify, or Apple · respect artwork &amp; content copyright.</div>
    </div>

    <!-- <div class="hidden text-center lg:block">
      <div>Jamlog was created and is ran by <a
          class="underline hover:text-foreground"
          href="https://lawsonhart.me"
          target="_blank"
          rel="noopener noreferrer">Lawson Hart</a
        >.</div>
      <div class="opacity-75">Not affiliated with Last.fm, Spotify, or Apple · respect artwork &amp; content copyright.</div>
    </div> -->

    <!-- Community / support buttons, stuck to the right / inspector side -->
    <div class="flex shrink-0 items-center gap-1.5" data-support>
      <a href={LINKS.discord} target="_blank" rel="noopener noreferrer" title="Discord" onpointerdown={stop} class={ftBtn}>
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
        Discord
      </a>
      <a href={LINKS.github} target="_blank" rel="noopener noreferrer" title="GitHub" onpointerdown={stop} class={ftBtn}>
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
        GitHub
      </a>
      <div class="relative">
        <button
          onpointerdown={stop}
          onclick={() => (supportOpen = !supportOpen)}
          title="Support Jamlog"
          aria-haspopup="menu"
          aria-expanded={supportOpen}
          class={ftBtn}
        >
          <!-- Both labels share a grid cell so the button width never jumps -->
          <span class="grid justify-items-center">
            <span class="col-start-1 row-start-1 flex items-center gap-1.5 transition-opacity duration-300 {showKofi ? 'opacity-0' : 'opacity-100'}">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10 2v2" /><path d="M14 2v2" /><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /><path d="M6 2v2" />
              </svg>
              Buy me a coffee
            </span>
            <span class="col-start-1 row-start-1 flex items-center gap-1.5 transition-opacity duration-300 {showKofi ? 'opacity-100' : 'opacity-0'}">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              Ko-fi
            </span>
          </span>
        </button>
        {#if supportOpen}
          <div
            transition:fly={{ y: 4, duration: 150 }}
            role="menu"
            class="absolute right-0 bottom-full z-40 mb-1.5 flex w-44 flex-col gap-0.5 rounded-lg border border-border bg-card p-1 text-foreground/80 shadow-md"
          >
            <a
              role="menuitem"
              href={LINKS.bmac}
              target="_blank"
              rel="noopener noreferrer"
              onpointerdown={stop}
              onclick={() => (supportOpen = false)}
              class="flex items-center gap-1.5 rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10 2v2" /><path d="M14 2v2" /><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /><path d="M6 2v2" />
              </svg>
              Buy me a coffee
            </a>
            <a
              role="menuitem"
              href={LINKS.kofi}
              target="_blank"
              rel="noopener noreferrer"
              onpointerdown={stop}
              onclick={() => (supportOpen = false)}
              class="flex items-center gap-1.5 rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              Ko-fi
            </a>
          </div>
        {/if}
      </div>
    </div>
  </footer>
</div>

<!-- Sibling of the canvas so clicks in the modal don't reach the deselect handler -->
<ExperimentalModal bind:open={experimentalOpen} {editor} />
