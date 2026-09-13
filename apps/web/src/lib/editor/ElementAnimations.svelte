<script lang="ts">
  import {
    ANIMATION_EASINGS,
    ANIMATION_EFFECTS,
    ANIMATION_TRIGGERS,
    customEffectId,
    isLetterEffect,
    setAnimationEffect,
  } from "$lib/animations";
  import { kindOf, type V2Animation, type V2AnimationTrigger } from "$lib/config";
  import type { EditorState } from "$lib/editor.svelte";
  import { ANIMATION_TRIGGER_ICONS, ICONS } from "$lib/ui/icons";
  import Select from "$lib/ui/Select.svelte";
  import Slider from "$lib/ui/Slider.svelte";
  import { tip } from "$lib/ui/tooltip.svelte";
  import Toggle from "$lib/ui/Toggle.svelte";

  let { editor, id }: { editor: EditorState; id: string } = $props();

  const element = $derived(editor.el(id));
  const animations = $derived(element.animations ?? []);
  const kind = $derived(kindOf(id));
  const effects = $derived([
    { value: "none", label: "None" },
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
  const directions = [
    { value: "up", label: "Up" },
    { value: "down", label: "Down" },
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ] as const;
  function animationFor(trigger: V2AnimationTrigger) {
    return animations.find((animation) => animation.trigger === trigger);
  }

  function setEffect(trigger: V2AnimationTrigger, effect: string) {
    const next = setAnimationEffect(animations, trigger, effect);
    if (next) element.animations = next;
    else delete element.animations;
  }

  function preview(trigger: V2AnimationTrigger) {
    const slot = animations.findIndex((animation) => animation.trigger === trigger);
    if (slot < 0) return;
    window.dispatchEvent(new CustomEvent("mw:preview-animation", { detail: { id, slot } }));
  }

  function usesDirection(animation: V2Animation) {
    return [animation.effect, animation.exitEffect].some((value) =>
      ["slide", "tilt", "flip", "letter-rise"].includes(value),
    );
  }

  function isPaired(animation: V2Animation) {
    return animation.trigger === "playback" || animation.trigger === "paused";
  }

  function returnLabel(trigger: V2AnimationTrigger) {
    return trigger === "playback" ? "Stop effect" : "Resume effect";
  }

  function effectLabel(animation: V2Animation | undefined) {
    if (!animation) return "None";
    return effects.find((effect) => effect.value === animation.effect)?.label ?? "None";
  }
</script>

<div class="divide-y divide-border/60 overflow-hidden rounded-md border border-border/70 bg-zinc-950/25">
  {#each ANIMATION_TRIGGERS as trigger (trigger.value)}
    {@const animation = animationFor(trigger.value)}
    <details class="group">
      <summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 px-2.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
        <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
          {@html ANIMATION_TRIGGER_ICONS[trigger.value]}
        </svg>
        <span class="min-w-0 flex-1 truncate font-medium text-foreground">{trigger.label}</span>
        <span class="max-w-24 truncate text-[11px] {animation ? 'text-primary' : 'text-muted-foreground/70'}">
          {effectLabel(animation)}
        </span>
        <svg viewBox="0 0 12 12" class="h-3 w-3 shrink-0 transition-transform group-open:rotate-90" fill="none" aria-hidden="true">
          <path d="M4 2.5 8 6 4 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </summary>

      <div class="flex flex-col gap-2.5 border-t border-border/60 px-2.5 py-2.5">
        <div class="flex items-end gap-2">
          <label class="min-w-0 flex-1">
            <span class="mb-1 block text-xs text-muted-foreground">Effect</span>
            <Select
              value={animation?.effect ?? "none"}
              options={effects}
              ariaLabel={`${trigger.label} effect`}
              onValueChange={(value) => setEffect(trigger.value, value)}
            />
          </label>
          {#if animation}
            <button
              type="button"
              use:tip={"Preview animation"}
              onclick={() => preview(trigger.value)}
              aria-label={`Preview ${trigger.label} animation`}
              class="mb-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
                {@html ICONS.eye}
              </svg>
            </button>
          {/if}
        </div>

        {#if animation}
          <div class="flex flex-col gap-2.5">
            <Slider bind:value={animation.durationMs} min={0} max={3000} step={10} label="Duration" suffix="ms" />
            <Slider bind:value={animation.delayMs} min={0} max={2000} step={25} label="Delay" suffix="ms" />
            <label class="block">
              <span class="mb-1 block text-xs text-muted-foreground">Easing</span>
              <Select bind:value={animation.easing} options={ANIMATION_EASINGS} />
            </label>

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

            {#if isPaired(animation)}
              <div class="mt-1 flex items-center gap-2">
                <span class="font-mono-ui text-[10px] tracking-wide text-muted-foreground/70 uppercase">Return</span>
                <hr class="flex-1 border-border/60" />
              </div>
              <label class="block">
                <span class="mb-1 block text-xs text-muted-foreground">{returnLabel(animation.trigger)}</span>
                <Select bind:value={animation.exitEffect} options={effects} />
              </label>
              {#if animation.exitEffect !== "none"}
                <Slider bind:value={animation.exitDurationMs} min={0} max={3000} step={10} label="Return duration" suffix="ms" />
                <Slider bind:value={animation.exitDelayMs} min={0} max={2000} step={25} label="Return delay" suffix="ms" />
                <label class="block">
                  <span class="mb-1 block text-xs text-muted-foreground">Return easing</span>
                  <Select bind:value={animation.exitEasing} options={ANIMATION_EASINGS} />
                </label>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    </details>
  {/each}
</div>
