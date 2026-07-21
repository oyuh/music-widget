<script lang="ts">
  import Toggle from "$lib/ui/Toggle.svelte";
  import type { EditorState } from "$lib/editor.svelte";

  interface Props {
    open: boolean;
    editor: EditorState;
  }
  let { open = $bindable(), editor }: Props = $props();

  const active = $derived(!!editor.config.experimental?.enabled);

  // The toggle is a draft until Confirm: opening the modal re-seeds it from the
  // real setting, so cancelling out leaves everything exactly as it was.
  let pending = $state(false);
  $effect(() => {
    if (open) pending = active;
  });

  function confirm() {
    // The CSS itself is kept when switching off, so flipping back on restores
    // whatever was written before.
    editor.config.experimental = {
      enabled: pending,
      css: editor.config.experimental?.css ?? "",
    };
    editor.save();
    open = false;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onclick={() => (open = false)}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-center gap-2">
        <span class="rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-500/90 uppercase">
          Experimental
        </span>
        <h2 class="text-base font-semibold tracking-tight">Custom CSS</h2>
      </div>

      <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
        Turns on a Custom CSS panel in the sidebar with your widget's styles in it, to add to, remove
        or rewrite however you want. Everything the normal settings do is an inline style, so they
        keep winning over your CSS unless a rule says <code>!important</code>.
      </p>
      <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
        It's easy to break your own widget in here. Switching this off puts it back exactly how it
        was and keeps your CSS around for later.
      </p>

      <div class="mt-3 rounded-md border border-border bg-zinc-800/60 px-3 py-2.5">
        <Toggle bind:checked={pending} label="Enable custom CSS" />
      </div>

      <div class="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onclick={() => (open = false)}
          class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={confirm}
          disabled={pending === active}
          class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {pending === active ? "Confirm" : pending ? "Turn it on" : "Turn it off"}
        </button>
      </div>
    </div>
  </div>
{/if}
