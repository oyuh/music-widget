<script lang="ts">
  import { slide } from "svelte/transition";
  import { PRESETS } from "$lib/presets";
  import { getUsedFonts } from "$lib/config";
  import { googleFontsHrefFor } from "$lib/fonts";
  import PresetThumb from "./PresetThumb.svelte";
  import type { EditorState } from "$lib/editor.svelte";

  interface Props {
    open: boolean;
    editor: EditorState;
  }
  let { open = $bindable(), editor }: Props = $props();

  let name = $state("");
  let needName = $state(false);
  let helpOpen = $state(false);

  // Prefill the username when a connected session (or a saved name from before
  // a sign-in round-trip) already knows it.
  $effect(() => {
    if (open && !name && editor.config.lfmUser) name = editor.config.lfmUser;
  });

  // Same Last.fm auth redirect as the sidebar's Connect button. The flag tells
  // +page.svelte the sign-in started mid-onboarding, so /callback bounces back
  // into this modal (with a ✓) instead of the standalone success dialog.
  let signInError = $state("");
  function signIn() {
    const key = import.meta.env.VITE_LFM_KEY;
    const cb = import.meta.env.VITE_LFM_CALLBACK || `${window.location.origin}/callback`;
    if (!key) {
      // Dev builds without a .env have no key; don't leave the click dead-silent.
      signInError = "Sign-in isn't configured in this build (VITE_LFM_KEY is missing).";
      return;
    }
    if (name.trim()) editor.config.lfmUser = name.trim();
    editor.save();
    try {
      sessionStorage.setItem("mw:welcome-signin", "1");
    } catch {
      /* ignore */
    }
    window.location.href = `https://www.last.fm/api/auth/?api_key=${key}&cb=${encodeURIComponent(cb)}`;
  }

  // Wrong-account escape hatch. When the username was auto-filled from the
  // session (not typed), clear it too so the wrong name doesn't linger.
  function signOut() {
    const fromSession = editor.config.lfmUser === editor.sessionName;
    editor.disconnect();
    if (fromSession) {
      editor.config.lfmUser = "";
      name = "";
      editor.save();
    }
  }

  // The preset thumbnails render with their real typography, so lazily add one
  // stylesheet link for the fonts the presets use (separate from the managed
  // per-config link, which would drop these on the next config change).
  $effect(() => {
    if (!open) return;
    const id = "mw-preset-fonts";
    if (document.getElementById(id)) return;
    const families = [...new Set(PRESETS.flatMap((p) => getUsedFonts(p.config)))];
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = googleFontsHrefFor(families);
    document.head.appendChild(link);
  });

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
        {#if editor.sessionName}
          <div
            class="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
          >
            <span class="flex min-w-0 items-center gap-1.5 text-green-400">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span class="truncate">Signed in as {editor.sessionName}</span>
            </span>
            <button
              type="button"
              onclick={signOut}
              class="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        {:else}
          <button
            type="button"
            onclick={signIn}
            class="cursor-pointer rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Sign into your private profile!
          </button>
          {#if signInError}
            <p class="text-[11px] text-amber-500">{signInError}</p>
          {/if}
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
              class="flex flex-col gap-1.5 rounded-md border border-border p-1.5 pb-2 text-xs hover:bg-muted"
            >
              <PresetThumb config={p.config} />
              <span class="w-full text-center">{p.name}</span>
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
