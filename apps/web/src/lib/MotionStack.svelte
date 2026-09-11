<script lang="ts">
  import type { Snippet } from "svelte";
  import { motion, visibilityExitMs, type MotionState } from "./animations";
  import type { V2Animation, V2CustomAnimation } from "./config";

  interface Props {
    id: string;
    animations?: V2Animation[];
    customAnimations?: V2CustomAnimation[];
    state: MotionState;
    shown?: boolean;
    visibilityTrigger?: "playback" | "paused";
    fill?: boolean;
    children: Snippet;
  }

  let {
    id,
    animations = [],
    customAnimations,
    state: motionState,
    shown = true,
    visibilityTrigger,
    fill = true,
    children,
  }: Props = $props();

  const first = $derived(animations[0]);
  const second = $derived(animations[1]);
  const layerStyle = $derived(
    fill
      ? "display:block;width:100%;height:100%;transform-origin:center"
      : "display:inline-block;max-width:100%;transform-origin:center",
  );

  // Keep a conditionally visible element around long enough to finish its exit.
  // A timeout is only cleanup. A new state clears it and makes the latest state
  // authoritative, so rapid play/pause changes cannot leave the node hidden.
  let hidden = $state(false);
  let initialized = $state(false);
  const concealed = $derived(initialized ? hidden : !shown);
  $effect(() => {
    const visible = shown;
    if (!initialized) {
      initialized = true;
      hidden = !visible;
      return;
    }
    if (visible) {
      hidden = false;
      return;
    }
    const wait = visibilityTrigger ? visibilityExitMs(animations, visibilityTrigger) : 0;
    if (!wait || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hidden = true;
      return;
    }
    const timer = setTimeout(() => (hidden = true), wait);
    return () => clearTimeout(timer);
  });
</script>

<div
  class="mw-motion-stack"
  style="{layerStyle};visibility:{concealed ? 'hidden' : 'visible'}"
  aria-hidden={concealed}
>
  {#if first}
    <div
      class="mw-motion-layer"
      style={layerStyle}
      data-motion-slot="1"
      use:motion={{ id, slot: 0, animation: first, customAnimations, state: motionState }}
    >
      {#if second}
        <div
          class="mw-motion-layer"
          style={layerStyle}
          data-motion-slot="2"
          use:motion={{ id, slot: 1, animation: second, customAnimations, state: motionState }}
        >
          {@render children()}
        </div>
      {:else}
        {@render children()}
      {/if}
    </div>
  {:else}
    {@render children()}
  {/if}
</div>
