<script lang="ts">
  interface Props {
    /** Explanatory text shown in the tooltip. */
    text: string;
    /** Optional diagram key (see tip-diagrams.ts) rendered above the text. */
    diagram?: string;
    /** Used for the accessible label of the trigger. */
    label?: string;
  }
  let { text, diagram, label }: Props = $props();

  let icon = $state<HTMLButtonElement | null>(null);
  let open = $state(false);
  let x = $state(0);
  let y = $state(0);

  const TW = 248; // tooltip width
  // The diagram markup is a few KB of authored SVG that most tooltips never
  // show, and the legal pages never show at all, so it's its own chunk fetched
  // on first hover. Layout doesn't wait on it: `diagram` (the key) is enough to
  // reserve the space, so the card is placed the same either way.
  let svg = $state<string | undefined>(undefined);
  let loadedFor: string | undefined;
  async function loadDiagram() {
    if (!diagram || loadedFor === diagram) return;
    loadedFor = diagram;
    const mod = await import("./tip-diagrams");
    if (loadedFor === diagram) svg = mod.TIP_DIAGRAMS[diagram];
  }
  // Fixed positioning so the card floats above the inspector's overflow. The
  // sidebar lives on the right, so prefer opening to the LEFT of the icon.
  function place() {
    if (!icon) return;
    const r = icon.getBoundingClientRect();
    let left = r.left - TW - 10;
    if (left < 8) left = Math.min(window.innerWidth - TW - 8, r.right + 10);
    x = Math.max(8, left);
    const h = diagram ? 190 : 96;
    y = Math.max(8, Math.min(r.top - 4, window.innerHeight - h - 8));
  }

  function show() {
    void loadDiagram();
    place();
    open = true;
  }
  function hide() {
    open = false;
  }
  // Portal to <body> so the tooltip isn't clipped by the scrolling inspector.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
  $effect(() => {
    if (!open) return;
    const reflow = () => place();
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    return () => {
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
    };
  });
</script>

<button
  type="button"
  bind:this={icon}
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
  onclick={(e) => {
    // It's a help affordance, not a control, so don't let the click toggle a
    // sibling setting or submit anything. Showing is handled by hover/focus.
    e.preventDefault();
    e.stopPropagation();
  }}
  aria-label={label ? `Help: ${label}` : "Help"}
  class="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground"
>
  <!-- Drawn rather than typed: a "?" glyph never centers in a 16px box (font
       ascender/descender push it off), an SVG path always does. -->
  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9.1 8.4a3 3 0 0 1 5.8 1c0 2-3 2.7-3 4" />
    <path d="M12 16.8h.01" />
  </svg>
</button>

{#if open}
  <div
    use:portal
    role="tooltip"
    class="font-mono-ui pointer-events-none fixed z-[120] w-[248px] rounded-lg border border-border bg-card p-2.5 text-card-foreground shadow-xl"
    style="left:{x}px;top:{y}px"
  >
    {#if diagram}
      <div class="mb-2 overflow-hidden rounded-md border border-border bg-zinc-900/60 p-1">
        {#if svg}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
          {@html svg}
        {:else}
          <!-- Same 220x110 box the diagram fills, so nothing shifts when it lands. -->
          <div class="aspect-[2/1] w-full"></div>
        {/if}
      </div>
    {/if}
    <p class="text-[11px] leading-snug text-muted-foreground">{text}</p>
  </div>
{/if}
