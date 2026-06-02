<script lang="ts" generics="T extends string">
  interface Props {
    value?: T;
    options: { value: T; label: string }[];
    label?: string;
  }
  let { value = $bindable(), options, label = "" }: Props = $props();
</script>

<div class="block">
  {#if label}<div class="mb-1 text-xs text-muted-foreground">{label}</div>{/if}
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
