<script lang="ts" generics="T extends string">
  import InfoTip from "./InfoTip.svelte";
  import { ICONS } from "./icons";
  interface Props {
    value?: T;
    /** `icon` is an optional key into icons.ts, drawn before the label. */
    options: { value: T; label: string; icon?: string }[];
    label?: string;
    hint?: string;
    diagram?: string;
  }
  let { value = $bindable(), options, label = "", hint = "", diagram = "" }: Props = $props();
</script>

<div class="block">
  {#if label || hint}
    <div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      {#if hint}<InfoTip text={hint} diagram={diagram || undefined} {label} />{/if}
    </div>
  {/if}
  <div class="flex overflow-hidden rounded-md border border-border">
    {#each options as o (o.value)}
      <button
        type="button"
        onclick={() => (value = o.value)}
        class="flex flex-1 items-center justify-center gap-1.5 px-2 py-1 text-xs transition-colors {o.icon ? 'min-h-9' : ''} {value === o.value
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'}"
      >
        {#if o.icon && ICONS[o.icon]}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html ICONS[o.icon]}</svg>
        {/if}
        {o.label}
      </button>
    {/each}
  </div>
</div>
