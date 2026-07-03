<script lang="ts">
  import { TIP_DIAGRAMS } from "./tip-diagrams";

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
  const svg = $derived(diagram ? TIP_DIAGRAMS[diagram] : undefined);

  // Fixed positioning so the card floats above the inspector's overflow. The
  // sidebar lives on the right, so prefer opening to the LEFT of the icon.
  function place() {
    if (!icon) return;
    const r = icon.getBoundingClientRect();
    let left = r.left - TW - 10;
    if (left < 8) left = Math.min(window.innerWidth - TW - 8, r.right + 10);
    x = Math.max(8, left);
    const h = svg ? 190 : 96;
    y = Math.max(8, Math.min(r.top - 4, window.innerHeight - h - 8));
  }
  function show() {
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
  class="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-border text-[9px] leading-none text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
>
  ?
</button>

{#if open}
  <div
    use:portal
    role="tooltip"
    class="font-mono-ui pointer-events-none fixed z-[120] w-[248px] rounded-lg border border-border bg-card p-2.5 text-card-foreground shadow-xl"
    style="left:{x}px;top:{y}px"
  >
    {#if svg}
      <div class="mb-2 overflow-hidden rounded-md border border-border bg-zinc-900/60 p-1">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
        {@html svg}
      </div>
    {/if}
    <p class="text-[11px] leading-snug text-muted-foreground">{text}</p>
  </div>
{/if}
