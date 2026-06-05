<script lang="ts" generics="T extends string">
  import InfoTip from "./InfoTip.svelte";
  interface Props {
    value?: T;
    options: { value: T; label: string }[];
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
        class="flex-1 px-2 py-1 text-xs transition-colors {value === o.value
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'}"
      >
        {o.label}
      </button>
    {/each}
  </div>
</div>
