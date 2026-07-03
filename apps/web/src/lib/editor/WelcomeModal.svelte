<script lang="ts">
  import { slide } from "svelte/transition";
  import { PRESETS } from "$lib/presets";
  import type { EditorState } from "$lib/editor.svelte";

  interface Props {
    open: boolean;
    editor: EditorState;
  }
  let { open = $bindable(), editor }: Props = $props();

  let name = $state("");
  let needName = $state(false);
  let helpOpen = $state(false);

  // No close button on purpose: the only way out is picking a preset (or the
  // stay-default text), and both require a Last.fm username first.
  function finish(preset?: (typeof PRESETS)[number]) {
    const user = name.trim();
    if (!user) {
      needName = true;
      return;
    }
    editor.config.lfmUser = user;
    if (preset) editor.applyPreset(preset.config);
    editor.save();
    open = false;
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
    <div
      class="w-full max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
      tabindex="-1"
    >
      <h2 class="text-base font-semibold tracking-tight">Welcome!</h2>
      <p class="mt-1 text-xs text-muted-foreground">
        Enter your Last.fm username and pick a preset to get started.
      </p>

      <div class="mt-3 flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <label for="welcome-user" class="font-pixel text-xs text-muted-foreground">Last.fm username</label>
          <button
            type="button"
            onclick={() => (helpOpen = !helpOpen)}
            class="text-xs text-primary hover:underline"
          >
            I don't have one!
          </button>
        </div>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="welcome-user"
          type="text"
          bind:value={name}
          oninput={() => (needName = false)}
          onkeydown={(e) => e.key === "Enter" && finish()}
          placeholder="username"
          spellcheck="false"
          autofocus
          class="w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5"
        />
        {#if needName}
          <p class="text-[11px] text-amber-500">Enter your Last.fm username first.</p>
        {/if}
        {#if helpOpen}
          <div transition:slide={{ duration: 180 }} class="flex flex-col gap-2 rounded-md border border-border p-2">
            <p class="text-[11px] leading-snug text-muted-foreground">
              Last.fm is free and keeps a running log of what you listen to (that's called
              "scrobbling"). The widget reads your now-playing track from there.
            </p>
            <div class="flex gap-2">
              <a
                href="https://www.last.fm/join"
                target="_blank"
                rel="noopener noreferrer"
                class="flex-1 rounded-md bg-primary px-2 py-1.5 text-center text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Sign up for Last.fm
              </a>
              <a
                href="https://www.last.fm/about/trackmymusic"
                target="_blank"
                rel="noopener noreferrer"
                class="flex-1 rounded-md border border-border px-2 py-1.5 text-center text-xs hover:bg-muted"
              >
                How to set up scrobbling →
              </a>
            </div>
          </div>
        {/if}
      </div>

      <div class="mt-3 flex flex-col gap-2">
        <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Pick a preset</div>
        <div class="grid grid-cols-2 gap-2">
          {#each PRESETS as p (p.name)}
            <button
              type="button"
              onclick={() => finish(p)}
              class="rounded-md border border-border px-2 py-2 text-xs hover:bg-muted"
            >
              {p.name}
            </button>
          {/each}
        </div>
        <!-- Deliberately plain text, not a button -->
        <span
          role="button"
          tabindex="0"
          onclick={() => finish()}
          onkeydown={(e) => e.key === "Enter" && finish()}
          class="cursor-pointer self-center text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          or stay with the default
        </span>
      </div>
    </div>
  </div>
{/if}
