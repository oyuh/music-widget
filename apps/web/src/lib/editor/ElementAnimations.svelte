<script lang="ts">
  import {
    ANIMATION_EASINGS,
    ANIMATION_EFFECTS,
    ANIMATION_TRIGGERS,
    createAnimation,
    customEffectId,
    isLetterEffect,
    MAX_ELEMENT_ANIMATIONS,
  } from "$lib/animations";
  import { kindOf, type V2Animation, type V2AnimationTrigger } from "$lib/config";
  import type { EditorState } from "$lib/editor.svelte";
  import Select from "$lib/ui/Select.svelte";
  import Slider from "$lib/ui/Slider.svelte";
  import Toggle from "$lib/ui/Toggle.svelte";

  let { editor, id }: { editor: EditorState; id: string } = $props();

  const element = $derived(editor.el(id));
  const animations = $derived(element.animations ?? []);
  const kind = $derived(kindOf(id));
  const effects = $derived([
    ...ANIMATION_EFFECTS.filter((effect) => {
      if (effect.targets === "all") return true;
      if (effect.targets === "text") return ["title", "artist", "album", "duration"].includes(kind);
      return kind === "art" || kind === "background";
    }).map((effect) => ({ value: effect.value, label: effect.label })),
    ...(editor.config.v2?.customAnimations ?? []).map((definition) => ({
      value: customEffectId(definition.id),
      label: definition.name || "Untitled animation",
    })),
  ]);
  const exitEffects = $derived([{ value: "none", label: "None" }, ...effects]);
  const directions = [
    { value: "up", label: "Up" },
    { value: "down", label: "Down" },
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ] as const;

  const defaultTrigger = $derived<V2AnimationTrigger>(
    kind === "pause" ? "paused" : kind === "background" ? "playback" : "track-change",
  );

  function add() {
    if (animations.length >= MAX_ELEMENT_ANIMATIONS) return;
    element.animations = [...animations, createAnimation(defaultTrigger)];
  }

  function remove(index: number) {
    const next = animations.filter((_, itemIndex) => itemIndex !== index);
    if (next.length) element.animations = next;
    else delete element.animations;
  }

  function changeTrigger(animation: V2Animation, value: string) {
    animation.trigger = value as V2AnimationTrigger;
    if ((value === "playback" || value === "paused") && animation.exitEffect === "none") {
      animation.exitEffect = "fade";
    }
  }

  function preview(index: number) {
    window.dispatchEvent(new CustomEvent("mw:preview-animation", { detail: { id, slot: index } }));
  }

  function usesDirection(animation: V2Animation) {
    return [animation.effect, animation.exitEffect].some((value) =>
      ["slide", "tilt", "flip", "letter-rise"].includes(value),
    );
  }

  function isPaired(animation: V2Animation) {
    return animation.trigger === "playback" || animation.trigger === "paused";
  }
</script>

<div class="flex flex-col gap-2.5">
  {#each animations as animation, index (index)}
    <div class="rounded-md border border-border/70 bg-zinc-950/35">
      <div class="flex min-h-9 items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
        <span class="font-mono-ui text-xs tracking-wide text-muted-foreground uppercase">
          Motion {index + 1}
        </span>
        <button
          type="button"
          onclick={() => preview(index)}
          class="ml-auto min-h-11 px-1.5 text-xs text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
        >Preview</button>
        <button
          type="button"
          onclick={() => remove(index)}
          class="min-h-11 px-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-red-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary"
        >Remove</button>
      </div>

      <div class="flex flex-col gap-2.5 p-2.5">
        <label class="block">
          <span class="mb-1 block text-xs text-muted-foreground">Run when</span>
          <Select
            value={animation.trigger}
            options={ANIMATION_TRIGGERS}
            onValueChange={(value) => changeTrigger(animation, value)}
          />
        </label>

        <div class={isPaired(animation) ? "grid grid-cols-2 gap-2" : "block"}>
          <label class="block min-w-0">
            <span class="mb-1 block text-xs text-muted-foreground">
              {isPaired(animation) ? "Start effect" : "Effect"}
            </span>
            <Select bind:value={animation.effect} options={effects} />
          </label>

          {#if isPaired(animation)}
            <label class="block min-w-0">
              <span class="mb-1 block text-xs text-muted-foreground">End effect</span>
              <Select bind:value={animation.exitEffect} options={exitEffects} />
            </label>
          {/if}
        </div>

        <Slider
          bind:value={animation.durationMs}
          min={0}
          max={3000}
          step={10}
          label={isPaired(animation) ? "Start duration" : "Duration"}
          suffix="ms"
        />
        {#if isPaired(animation) && animation.exitEffect !== "none"}
          <Slider bind:value={animation.exitDurationMs} min={0} max={3000} step={10} label="End duration" suffix="ms" />
        {/if}

        <details class="group border-t border-border/60 pt-2">
          <summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary">
            <span class="flex-1">Timing and movement</span>
            <svg viewBox="0 0 12 12" class="h-3 w-3 transition-transform group-open:rotate-90" fill="none" aria-hidden="true">
              <path d="M4 2.5 8 6 4 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </summary>

          <div class="flex flex-col gap-2.5 pt-2">
            <Slider
              bind:value={animation.delayMs}
              min={0}
              max={2000}
              step={25}
              label={isPaired(animation) ? "Start delay" : "Delay"}
              suffix="ms"
            />
            <label class="block">
              <span class="mb-1 block text-xs text-muted-foreground">
                {isPaired(animation) ? "Start easing" : "Easing"}
              </span>
              <Select bind:value={animation.easing} options={ANIMATION_EASINGS} />
            </label>

            {#if isPaired(animation) && animation.exitEffect !== "none"}
              <Slider bind:value={animation.exitDelayMs} min={0} max={2000} step={25} label="End delay" suffix="ms" />
              <label class="block">
                <span class="mb-1 block text-xs text-muted-foreground">End easing</span>
                <Select bind:value={animation.exitEasing} options={ANIMATION_EASINGS} />
              </label>
            {/if}

            {#if usesDirection(animation)}
              <label class="block">
                <span class="mb-1 block text-xs text-muted-foreground">Direction</span>
                <Select bind:value={animation.direction} options={directions} />
              </label>
              <Slider bind:value={animation.distance} min={0} max={120} label="Distance" suffix="px" />
            {/if}

            {#if isLetterEffect(animation.effect) || isLetterEffect(animation.exitEffect)}
              <Slider bind:value={animation.staggerMs} min={0} max={150} label="Letter delay" suffix="ms" />
              <Toggle bind:checked={animation.reverseLetters} label="Reverse letter order" />
            {/if}
          </div>
        </details>
      </div>
    </div>
  {/each}

  {#if animations.length < MAX_ELEMENT_ANIMATIONS}
    <button
      type="button"
      onclick={add}
      class="min-h-11 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
    >
      {animations.length ? "Add second animation" : "Add animation"}
    </button>
  {:else}
    <p class="text-xs leading-snug text-muted-foreground">
      This element has both animation slots in use. Stack order follows the list above.
    </p>
  {/if}
</div>
