<script lang="ts">
  import { untrack } from "svelte";
  import type { EditorState } from "$lib/editor.svelte";
  import Collapsible from "$lib/ui/Collapsible.svelte";

  // Everything account-ish behind the lock button: signing in so a private
  // profile's scrobbles are readable, and bringing your own Last.fm API key.
  interface Props {
    open: boolean;
    editor: EditorState;
  }
  let { open = $bindable(), editor }: Props = $props();

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const canSignIn = !!import.meta.env.VITE_LFM_KEY;

  // Seeded once: the modal mounts fresh each time it opens.
  let byokKey = $state(untrack(() => editor.config.apiKey ?? ""));
  // Most people never need a key, so it stays folded unless one is already set.
  let keyOpen = $state(untrack(() => !!editor.config.apiKey));
  const keyChanged = $derived(byokKey.trim() !== (editor.config.apiKey ?? ""));

  function close() {
    open = false;
  }

  function connect() {
    const key = import.meta.env.VITE_LFM_KEY;
    const cb = import.meta.env.VITE_LFM_CALLBACK || `${origin}/callback`;
    if (!key) return;
    editor.save();
    window.location.href = `https://www.last.fm/api/auth/?api_key=${key}&cb=${encodeURIComponent(cb)}`;
  }

  function saveKey() {
    editor.config.apiKey = byokKey.trim() || null;
    editor.save();
    close();
  }

  function removeKey() {
    editor.config.apiKey = null;
    byokKey = "";
    editor.save();
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  const btn =
    "min-h-11 rounded-md border border-border px-3 text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
  const btnPrimary =
    "min-h-11 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40";
</script>

<svelte:window onkeydown={(e) => open && e.key === "Escape" && close()} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onclick={close} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground outline-none"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-title"
      tabindex="-1"
      use:focusOnMount
    >
      <div class="flex items-start justify-between gap-3">
        <h2 id="account-title" class="text-base font-semibold tracking-tight">Last.fm access</h2>
        <button
          type="button"
          onclick={close}
          aria-label="Close"
          class="-mt-1 -mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <!-- Private profile -->
      <section class="mt-2">
        <h3 class="font-mono-ui text-xs font-medium text-muted-foreground uppercase">Private profile</h3>
        <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
          If your Last.fm listening history is hidden, sign in so the widget can still read what you're playing.
        </p>
        {#if editor.sessionName}
          <div class="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3 text-xs">
            <span class="truncate">Signed in as <span class="text-blue-400">{editor.sessionName}</span></span>
            <button
              type="button"
              onclick={() => editor.disconnect()}
              class="shrink-0 rounded px-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Disconnect
            </button>
          </div>
        {:else}
          <button type="button" onclick={connect} disabled={!canSignIn} class="{btnPrimary} mt-2 w-full">
            Sign in with Last.fm
          </button>
          {#if !canSignIn}
            <p class="mt-1 text-[11px] text-muted-foreground">Sign-in isn't set up on this server.</p>
          {/if}
        {/if}
      </section>

      <!-- Bring your own key: folded away, since it's rarely needed. -->
      <div class="mt-4">
        <Collapsible title="Your own API key" bind:open={keyOpen} badge={editor.config.apiKey ? "in use" : undefined}>
          <p class="text-xs leading-relaxed text-muted-foreground">
            Optional. Last.fm counts requests against the key making them, so your own key gives your widget its own
            budget. Worth it if you see rate-limit warnings.
          </p>
          <ol class="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>
              Open
              <a
                class="text-blue-400 underline-offset-4 hover:underline"
                href="https://www.last.fm/api/account/create"
                target="_blank"
                rel="noopener noreferrer">last.fm/api/account/create</a
              >
              while logged in.
            </li>
            <li>Give it any name, like "my widget". No callback URL needed.</li>
            <li>Copy the <strong class="text-foreground">API key</strong> and paste it below.</li>
          </ol>
          <label for="byok-key" class="sr-only">Last.fm API key</label>
          <input
            id="byok-key"
            type="text"
            bind:value={byokKey}
            placeholder="paste your API key"
            spellcheck="false"
            autocomplete="off"
            onkeydown={(e) => e.key === "Enter" && keyChanged && saveKey()}
            class="h-9 w-full rounded-md border border-border bg-zinc-800 px-2.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />
          <p class="text-[11px] text-amber-500/80">Your key is saved in the widget link, so keep that link private.</p>
          <div class="flex items-center justify-between gap-2">
            {#if editor.config.apiKey}
              <button type="button" onclick={removeKey} class="{btn} text-muted-foreground">Remove key</button>
            {:else}
              <span></span>
            {/if}
            <button type="button" onclick={saveKey} disabled={!keyChanged} class={btnPrimary}>Save key</button>
          </div>
        </Collapsible>
      </div>
    </div>
  </div>
{/if}
