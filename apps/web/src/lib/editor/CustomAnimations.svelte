<script lang="ts">
  import Collapsible from "$lib/ui/Collapsible.svelte";
  import ConfirmButton from "$lib/ui/ConfirmButton.svelte";
  import Select from "$lib/ui/Select.svelte";
  import VisualFrameEditor from "$lib/editor/VisualFrameEditor.svelte";
  import type { EditorState } from "$lib/editor.svelte";
  import {
    cssKeyframeBlock,
    cssKeyframeName,
    CUSTOM_ANIMATION_SOURCE_MAX,
    CUSTOM_ANIMATION_TOTAL_MAX,
    DEFAULT_VISUAL_FROM,
    DEFAULT_VISUAL_TO,
    MAX_CUSTOM_ANIMATIONS,
    visualKeyframes,
  } from "$lib/animations";
  import type { V2CustomAnimation, V2VisualAnimationFrame } from "$lib/config";

  let { editor }: { editor: EditorState } = $props();
  let open = $state(false);
  let codeOpen = $state(false);
  let expandedId = $state<string | null>(null);
  let activeFrames = $state<Record<string, "from" | "to">>({});
  const definitions = $derived(editor.config.v2?.customAnimations ?? []);
  const sourceSize = $derived(definitions.reduce((sum, definition) => sum + definition.source.length, 0));
  const atCountLimit = $derived(definitions.length >= MAX_CUSTOM_ANIMATIONS);
  const atSourceLimit = $derived(sourceSize >= CUSTOM_ANIMATION_TOTAL_MAX);

  type VisualPreset = {
    label: string;
    from: V2VisualAnimationFrame;
    to: V2VisualAnimationFrame;
  };

  const reveal = (from: Partial<V2VisualAnimationFrame>): VisualPreset => ({
    label: "",
    from: { ...DEFAULT_VISUAL_FROM, ...from },
    to: { ...DEFAULT_VISUAL_TO },
  });

  const VISUAL_PRESETS: Record<string, VisualPreset> = {
    reveal: { ...reveal({}), label: "Soft reveal" },
    fade: { ...reveal({ y: 0, scale: 100 }), label: "Fade" },
    rise: { ...reveal({ y: 28, scale: 100 }), label: "Rise" },
    pop: { ...reveal({ y: 0, scale: 78 }), label: "Pop" },
    blur: { ...reveal({ y: 0, scale: 100, blur: 14 }), label: "Focus" },
    spin: { ...reveal({ y: 0, scale: 88, rotate: -90 }), label: "Spin in" },
  };
  const visualPresetOptions = [
    { value: "", label: "Choose a starting point…" },
    ...Object.entries(VISUAL_PRESETS).map(([value, preset]) => ({ value, label: preset.label })),
  ];

  function add(type: "visual" | "css" | "js") {
    const id = editor.addCustomAnimation(type);
    if (!id) return;
    open = true;
    codeOpen = type !== "visual";
    expandedId = id;
    activeFrames[id] = "from";
  }

  function saveName(definition: V2CustomAnimation, value: string) {
    definition.name = value.slice(0, 32);
    editor.save();
  }

  function saveSource(definition: V2CustomAnimation, value: string) {
    const usedByOthers = definitions.reduce(
      (sum, other) => sum + (other.id === definition.id ? 0 : other.source.length),
      0,
    );
    const max = Math.min(CUSTOM_ANIMATION_SOURCE_MAX, CUSTOM_ANIMATION_TOTAL_MAX - usedByOthers);
    definition.source = value.slice(0, Math.max(0, max));
    editor.save();
  }

  function applyPreset(definition: V2CustomAnimation, key: string) {
    const preset = VISUAL_PRESETS[key];
    if (!preset) return;
    definition.from = { ...preset.from };
    definition.to = { ...preset.to };
    editor.save();
  }

  function preview(definition: V2CustomAnimation, event: MouseEvent) {
    const target = event.currentTarget instanceof HTMLElement
      ? event.currentTarget.querySelector<HTMLElement>("[data-visual-preview]")
      : null;
    const frames = visualKeyframes(definition);
    if (!target || !frames || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    target.getAnimations().forEach((animation) => animation.cancel());
    target.animate(frames, {
      duration: 650,
      easing: "cubic-bezier(.16,1,.3,1)",
    });
  }
</script>

<Collapsible
  title="Custom animations"
  icon="sparkles"
  bind:open
  badge={definitions.length ? `${definitions.length}/${MAX_CUSTOM_ANIMATIONS}` : undefined}
  hint="Build a reusable effect with visual controls, then pick it from any element's Animations panel. CSS and JavaScript remain available under custom code."
>
  <button
    type="button"
    onclick={() => add("visual")}
    disabled={atCountLimit}
    class="min-h-11 w-full rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
  >
    New animation
  </button>

  <details bind:open={codeOpen} class="group border-t border-border/60 pt-1">
    <summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-primary">
      <span class="flex-1">Use custom code</span>
      <svg viewBox="0 0 12 12" class="h-3 w-3 transition-transform group-open:rotate-90" fill="none" aria-hidden="true">
        <path d="M4 2.5 8 6 4 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </summary>
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button
        type="button"
        onclick={() => add("css")}
        disabled={atCountLimit || atSourceLimit}
        class="min-h-11 rounded-md border border-border px-2 py-1.5 text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add CSS
      </button>
      <button
        type="button"
        onclick={() => add("js")}
        disabled={atCountLimit || atSourceLimit}
        class="min-h-11 rounded-md border border-border px-2 py-1.5 text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add JavaScript
      </button>
    </div>
  </details>

  {#if atCountLimit}
    <p class="text-xs leading-snug text-muted-foreground">
      This widget has all {MAX_CUSTOM_ANIMATIONS} custom animation slots in use.
    </p>
  {:else if atSourceLimit}
    <p class="text-xs leading-snug text-muted-foreground">
      Custom code has reached its {CUSTOM_ANIMATION_TOTAL_MAX}-character limit. Visual animations are still available.
    </p>
  {/if}

  {#each definitions as definition (definition.id)}
    <details
      open={expandedId === definition.id}
      ontoggle={(event) => {
        if (event.currentTarget.open) expandedId = definition.id;
        else if (expandedId === definition.id) expandedId = null;
      }}
      class="group rounded-md border border-border/70 bg-zinc-950/35"
    >
      <summary
        class="flex min-h-11 cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-xs focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span class="min-w-0 flex-1 truncate font-medium">{definition.name || "Untitled animation"}</span>
        <span class="font-mono text-xs text-muted-foreground uppercase">{definition.type}</span>
        <svg viewBox="0 0 12 12" class="h-3 w-3 text-muted-foreground transition-transform group-open:rotate-90" fill="none" aria-hidden="true">
          <path d="M4 2.5 8 6 4 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </summary>

      <div class="flex flex-col gap-2.5 border-t border-border/60 p-2.5">
        <label class="block">
          <span class="mb-1 block text-xs text-muted-foreground">Name</span>
          <input
            value={definition.name}
            oninput={(event) => saveName(definition, event.currentTarget.value)}
            maxlength="32"
            class="w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>

        {#if definition.type === "visual" && definition.from && definition.to}
          <label class="block">
            <span class="mb-1 block text-xs text-muted-foreground">Preset</span>
            <Select
              value=""
              options={visualPresetOptions}
              ariaLabel="Preset"
              onValueChange={(value) => applyPreset(definition, value)}
            />
          </label>

          <button
            type="button"
            onclick={(event) => preview(definition, event)}
            class="group/preview flex min-h-14 w-full items-center gap-3 rounded-md border border-border bg-zinc-900 px-3 py-2 text-left transition-colors hover:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Preview ${definition.name || "animation"}`}
          >
            <span
              data-visual-preview
              class="flex h-9 w-12 shrink-0 items-center justify-center rounded border border-primary/70 bg-zinc-800 font-mono-ui text-xs font-semibold text-primary"
            >Aa</span>
            <span class="min-w-0 flex-1 text-sm font-medium text-foreground">Preview effect</span>
            <span class="text-xs text-primary underline-offset-4 group-hover/preview:underline">Play</span>
          </button>

          <div>
            <div class="mb-2 flex overflow-hidden rounded-md border border-border" role="group" aria-label="Keyframe to edit">
              <button
                type="button"
                onclick={() => (activeFrames[definition.id] = "from")}
                aria-pressed={(activeFrames[definition.id] ?? "from") === "from"}
                class="min-h-11 flex-1 px-2 py-1 text-xs transition-colors {(activeFrames[definition.id] ?? 'from') === 'from'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'}"
              >
                Start
              </button>
              <button
                type="button"
                onclick={() => (activeFrames[definition.id] = "to")}
                aria-pressed={activeFrames[definition.id] === "to"}
                class="min-h-11 flex-1 border-l border-border px-2 py-1 text-xs transition-colors {activeFrames[definition.id] === 'to'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'}"
              >
                End
              </button>
            </div>

            {#if (activeFrames[definition.id] ?? "from") === "from"}
              <VisualFrameEditor frame={definition.from} />
            {:else}
              <VisualFrameEditor frame={definition.to} />
            {/if}
          </div>

          <p class="text-xs leading-snug text-muted-foreground">
            The element moves from Start to End. End effects play the same motion in reverse.
          </p>
        {:else}
          <label class="block">
            <span class="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{definition.type === "css" ? "@keyframes rule" : "Keyframe function body"}</span>
              <span class="font-mono tabular-nums">{definition.source.length}/{CUSTOM_ANIMATION_SOURCE_MAX}</span>
            </span>
            <textarea
              value={definition.source}
              oninput={(event) => saveSource(definition, event.currentTarget.value)}
              rows="9"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              class="w-full resize-y rounded-md border border-border bg-zinc-800 px-2 py-1.5 font-mono text-xs leading-relaxed focus-visible:ring-2 focus-visible:ring-primary"
            ></textarea>
          </label>

          {#if definition.type === "css"}
            <p class="text-xs leading-snug {cssKeyframeBlock(definition.source) ? 'text-muted-foreground' : 'text-amber-400'}">
              {cssKeyframeBlock(definition.source)
                ? `Uses @keyframes ${cssKeyframeName(definition.source)}.`
                : "Add one complete @keyframes rule before applying this effect."}
            </p>
          {:else}
            <p class="text-xs leading-snug text-muted-foreground">
              Return an array of 2-32 keyframes. Scripts run in an isolated worker and may set opacity, transform, filter,
              and offset. They cannot reach the widget DOM.
            </p>
          {/if}
        {/if}

        <div class="flex justify-end border-t border-border/60 pt-1">
          <ConfirmButton
            label="Delete"
            confirmLabel="Delete?"
            class="min-h-11 rounded-md px-2.5 py-1 text-xs text-red-400 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
            onconfirm={() => editor.removeCustomAnimation(definition.id)}
          />
        </div>
      </div>
    </details>
  {/each}

  {#if definitions.length === 0}
    <p class="text-xs leading-snug text-muted-foreground">
      Create a reusable effect here, then apply it from an element's Animations panel.
    </p>
  {/if}
</Collapsible>

<style>
  @media (prefers-reduced-motion: reduce) {
    :global([data-visual-preview]) {
      animation: none !important;
    }
  }
</style>
