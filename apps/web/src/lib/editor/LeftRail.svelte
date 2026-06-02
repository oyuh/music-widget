<script lang="ts">
  import { ELEMENTS, type EditorState } from "$lib/editor.svelte";
  import { PRESETS } from "$lib/presets";

  interface Props {
    editor: EditorState;
    connected?: boolean;
  }
  let { editor, connected = false }: Props = $props();

  let copied = $state(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Recomputes whenever the config changes (exportHash reads it).
  const shareUrl = $derived(`${origin}/w#${editor.exportHash()}`);

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* ignore */
    }
  }

  function connect() {
    const key = import.meta.env.VITE_LFM_KEY;
    const cb = import.meta.env.VITE_LFM_CALLBACK || `${origin}/callback`;
    if (!key) return;
    editor.save();
    window.location.href = `https://www.last.fm/api/auth/?api_key=${key}&cb=${encodeURIComponent(cb)}`;
  }

  function onUserInput() {
    editor.config.sessionKey = null; // public lookups when typing a username
    editor.save();
  }
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
  <div>
    <div class="text-base font-semibold tracking-tight">Music Widget</div>
    <div class="text-xs text-muted-foreground">Last.fm now-playing overlay</div>
  </div>

  <!-- Last.fm account -->
  <section class="flex flex-col gap-2">
    <div class="text-xs font-medium text-muted-foreground uppercase">Last.fm</div>
    <input
      type="text"
      placeholder="username"
      bind:value={editor.config.lfmUser}
      oninput={onUserInput}
      spellcheck="false"
      class="w-full rounded-md border border-border bg-background px-2 py-1.5"
    />
    <button
      type="button"
      onclick={connect}
      class="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
    >
      {connected ? "✓ Connected (private profiles)" : "Connect for private profile"}
    </button>
  </section>

  <!-- Share -->
  <section class="flex flex-col gap-2">
    <div class="text-xs font-medium text-muted-foreground uppercase">Share</div>
    <div class="flex gap-2">
      <button
        type="button"
        onclick={copyShare}
        class="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        {copied ? "Copied!" : "Copy widget URL"}
      </button>
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener"
        class="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
      >
        Open ↗
      </a>
    </div>
    <p class="text-[11px] leading-snug text-muted-foreground">
      Add this URL as an OBS Browser Source.
    </p>
  </section>

  <!-- Presets -->
  <section class="flex flex-col gap-2">
    <div class="text-xs font-medium text-muted-foreground uppercase">Presets</div>
    <div class="grid grid-cols-2 gap-2">
      {#each PRESETS as p (p.name)}
        <button
          type="button"
          onclick={() => editor.applyPreset(p.config)}
          class="rounded-md border border-border px-2 py-2 text-xs hover:bg-muted"
        >
          {p.name}
        </button>
      {/each}
    </div>
    <button
      type="button"
      onclick={() => editor.reset()}
      class="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
    >
      Reset to default
    </button>
  </section>

  <!-- Element list -->
  <section class="flex flex-col gap-1">
    <div class="text-xs font-medium text-muted-foreground uppercase">Elements</div>
    {#each ELEMENTS as el (el.id)}
      <button
        type="button"
        onclick={() => editor.select(el.id)}
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors {editor.selected ===
        el.id
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'}"
      >
        <span class="w-4 text-center opacity-70">{el.icon}</span>
        <span>{el.label}</span>
      </button>
    {/each}
  </section>
</div>
