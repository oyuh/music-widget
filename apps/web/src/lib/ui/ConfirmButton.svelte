<script lang="ts">
  import type { Snippet } from "svelte";
  import { tip } from "./tooltip.svelte";
  interface Props {
    label?: string;
    confirmLabel?: string;
    title?: string;
    /** Tooltip while armed. Says what the second click will actually do. */
    confirmTitle?: string;
    class?: string;
    /** How the button looks once armed. Defaults to the amber "are you sure" ring. */
    armedClass?: string;
    /** Icon buttons render this instead of the labels; it's told whether it's armed. */
    children?: Snippet<[boolean]>;
    onconfirm: () => void;
  }
  let {
    label = "",
    confirmLabel = "Sure?",
    title = "",
    confirmTitle = "Click again to confirm",
    class: cls = "",
    armedClass = "ring-1 ring-amber-400 text-amber-300",
    children,
    onconfirm,
  }: Props = $props();

  let armed = $state(false);
  let timer: ReturnType<typeof setTimeout>;

  function click() {
    if (armed) {
      armed = false;
      clearTimeout(timer);
      onconfirm();
    } else {
      armed = true;
      clearTimeout(timer);
      timer = setTimeout(() => (armed = false), 2500);
    }
  }
</script>

<button type="button" use:tip={armed ? confirmTitle : title} onclick={click} class="{cls} {armed ? armedClass : ''}">
  {#if children}
    {@render children(armed)}
  {:else}
    {armed ? confirmLabel : label}
  {/if}
</button>
