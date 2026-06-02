<script lang="ts">
  interface Props {
    value?: string;
    label?: string;
    /** Allow the special "accent" value (uses album-art / accent color). */
    allowAccent?: boolean;
  }
  let { value = $bindable("#ffffff"), label = "", allowAccent = false }: Props = $props();

  const isAccent = $derived(value === "accent");
  // Native <input type=color> only understands 6-digit hex.
  const pickerValue = $derived(isAccent ? "#1db954" : value.startsWith("#") ? value.slice(0, 7) : "#ffffff");
  // Preserve a trailing alpha pair (#rrggbbaa) when picking a new rgb.
  const alpha = $derived(!isAccent && value.length === 9 ? value.slice(7) : "");

  function onPick(e: Event) {
    value = (e.currentTarget as HTMLInputElement).value + alpha;
  }
</script>

<div class="block">
  {#if label}<div class="mb-1 text-xs text-muted-foreground">{label}</div>{/if}
  <div class="flex items-center gap-2">
    <input
      type="color"
      value={pickerValue}
      oninput={onPick}
      disabled={isAccent}
      class="h-7 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent disabled:opacity-40"
      aria-label="color picker"
    />
    <input
      type="text"
      bind:value
      spellcheck="false"
      class="min-w-0 flex-1 rounded-md border border-border bg-zinc-800 px-2 py-1 font-mono text-xs"
    />
    {#if allowAccent}
      <button
        type="button"
        onclick={() => (value = isAccent ? "#ffffff" : "accent")}
        title="Use accent / album-art color"
        class="shrink-0 rounded-md border px-2 py-1 text-xs {isAccent
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border hover:bg-muted'}"
      >
        auto
      </button>
    {/if}
  </div>
</div>
