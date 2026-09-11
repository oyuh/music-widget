<script lang="ts" generics="T extends string">
  interface Props {
    value?: T;
    options: readonly { value: T; label: string }[];
    ariaLabel?: string;
    disabled?: boolean;
    onValueChange?: (value: T) => void;
  }

  let {
    value = $bindable(),
    options,
    ariaLabel = "",
    disabled = false,
    onValueChange,
  }: Props = $props();

  const selectedLabel = $derived(options.find((option) => option.value === value)?.label ?? String(value ?? ""));

  function change(event: Event) {
    value = (event.currentTarget as HTMLSelectElement).value as T;
    onValueChange?.(value);
  }
</script>

<div class="group relative flex min-h-11 w-full items-center">
  <select
    value={value}
    onchange={change}
    {disabled}
    aria-label={ariaLabel || undefined}
    class="peer absolute inset-0 z-10 h-11 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
  >
    {#each options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  <div
    class="pointer-events-none flex h-8 w-full items-center gap-2 rounded-md border border-border bg-zinc-800 px-2.5 text-sm text-foreground transition-colors group-hover:border-border/90 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-disabled:opacity-40"
    aria-hidden="true"
  >
    <span class="min-w-0 flex-1 truncate">{selectedLabel}</span>
    <svg viewBox="0 0 12 12" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" fill="none">
      <path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>
</div>
