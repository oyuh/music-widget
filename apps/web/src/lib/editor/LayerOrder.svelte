<script lang="ts">
  import { ELEMENTS, labelFor, LayerDrag, type EditorState, type ElementId } from "$lib/editor.svelte";
  import { kindOf } from "$lib/config";
  import { ICONS } from "$lib/ui/icons";
  import { tip } from "$lib/ui/tooltip.svelte";
  import { tick } from "svelte";

  interface Props {
    editor: EditorState;
    /** The element whose panel this sits in; its row is highlighted. */
    current: ElementId;
  }
  let { editor, current }: Props = $props();

  // Same list as the sidebar: front to back, with the frame pinned underneath.
  const KIND = Object.fromEntries(ELEMENTS.map((k) => [k.id, k]));
  const layers = $derived(editor.layerOrder);
  const drag = new LayerDrag();

  // Moving a row re-parents its node, which drops focus off the button that was
  // just pressed, so put it back once the list has re-rendered.
  async function step(id: ElementId, by: -1 | 1, dir: "up" | "down") {
    editor.moveLayer(id, layers.indexOf(id) + by);
    await tick();
    const row = document.querySelector(`[data-layer-row="${id}"]`);
    // Hitting the top or bottom disables that arrow, so fall back to the other one.
    (row?.querySelector<HTMLElement>(`[data-step="${dir}"]:not(:disabled)`) ?? row?.querySelector<HTMLElement>("button:not(:disabled)"))?.focus();
  }

  const stepCls =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";
</script>

{#snippet icon(name: string)}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html ICONS[name]}</svg>
{/snippet}

<p class="text-[11px] leading-snug text-muted-foreground">Front to back. Drag a row or use the arrows.</p>
<div role="list" aria-label="Layers, front to back" class="flex flex-col gap-0.5">
  {#each [...layers, "background"] as id, i (id)}
    {@const pinned = id === "background"}
    <div
      data-layer-row={id}
      role="listitem"
      draggable={!pinned}
      ondragstart={(e) => drag.start(e, id)}
      ondragover={(e) => drag.over(e, i, layers.length)}
      ondrop={(e) => drag.drop(e, editor)}
      ondragend={() => drag.end()}
      class="relative flex items-center gap-1.5 rounded-md py-0.5 pr-0.5 pl-1.5 {id === current
        ? 'bg-primary/15 text-foreground ring-1 ring-primary/60 ring-inset'
        : 'text-muted-foreground'} {pinned ? '' : 'cursor-grab active:cursor-grabbing'} {drag.dragId === id ? 'opacity-40' : ''}"
    >
      {#if drag.dropAt === i && drag.dragId}
        <span class="pointer-events-none absolute inset-x-1 -top-[2px] h-0.5 bg-brand-400"></span>
      {/if}
      <span class="shrink-0 {pinned ? 'opacity-0' : 'opacity-60'}">{@render icon("grip")}</span>
      <span class="w-4 shrink-0 text-center text-xs opacity-70">{KIND[kindOf(id)].icon}</span>
      <span class="min-w-0 flex-1 truncate text-xs">{labelFor(id)}</span>
      {#if pinned}
        <span class="pr-1.5 text-[10px] opacity-60" use:tip={"The frame holds everything else, so it always sits at the back."}>always back</span>
      {:else}
        <button type="button" data-step="up" class={stepCls} disabled={i === 0} onclick={() => step(id, -1, "up")} aria-label="Move {labelFor(id)} forward">
          {@render icon("chevronUp")}
        </button>
        <button type="button" data-step="down" class={stepCls} disabled={i === layers.length - 1} onclick={() => step(id, 1, "down")} aria-label="Move {labelFor(id)} back">
          {@render icon("chevronDown")}
        </button>
      {/if}
    </div>
  {/each}
</div>
