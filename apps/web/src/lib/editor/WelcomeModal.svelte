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

  let dialogEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);

  // "Default" is whatever the editor already holds, so its tile previews exactly
  // what you get by not picking anything. Index 0 is therefore "leave it alone".
  const looks = $derived([{ name: "Default", config: editor.config }, ...PRESETS]);
  let selected = $state(0);

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

  // Picking a look and committing to it are separate now: the tiles only move
  // `selected`, and this is the single way out. No close button on purpose.
  function finish() {
    const user = name.trim();
    if (!user) {
      needName = true;
      inputEl?.focus();
      return;
    }
    editor.config.lfmUser = user;
    if (selected > 0) editor.applyPreset(looks[selected].config);
    editor.save();
    open = false;
  }

  // Since there's no Escape and no close button, Tab must not be able to walk
  // out into the editor behind the overlay and strand a keyboard user there.
  function trapTab(e: KeyboardEvent) {
    if (e.key !== "Tab" || !dialogEl) return;
    const f = [
      ...dialogEl.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (!f.length) return;
    const edge = e.shiftKey ? f[0] : f[f.length - 1];
    if (document.activeElement === edge) {
      e.preventDefault();
      (e.shiftKey ? f[f.length - 1] : f[0]).focus();
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
    <div
      bind:this={dialogEl}
      onkeydown={trapTab}
      class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
      tabindex="-1"
    >
      <div class="border-b border-border p-4">
        <h2 class="text-base font-semibold tracking-tight">Welcome!</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">Two things, then the editor is yours.</p>
      </div>

      <!-- Scrolls on its own so opening the Last.fm explainer can never push the
           Start editing button out of sight. -->
      <div class="flex min-h-0 flex-col gap-5 overflow-y-auto p-4">
        <section class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-2">
            <label for="welcome-user" class="font-mono-ui text-xs font-medium text-muted-foreground uppercase">
              1 · Last.fm username
            </label>
            <button
              type="button"
              onclick={() => (helpOpen = !helpOpen)}
              aria-expanded={helpOpen}
              class="text-xs text-primary hover:underline"
            >
              I don't have one!
            </button>
          </div>
          <p class="text-[11px] leading-snug text-muted-foreground">
            The widget reads what's playing from your Last.fm scrobbles.
          </p>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            id="welcome-user"
            bind:this={inputEl}
            type="text"
            bind:value={name}
            oninput={() => (needName = false)}
            onkeydown={(e) => e.key === "Enter" && finish()}
            placeholder="username"
            spellcheck="false"
            autofocus
            aria-invalid={needName}
            aria-describedby={needName ? "welcome-user-error" : undefined}
            class="w-full rounded-md border bg-zinc-800 px-2 py-1.5 {needName
              ? 'border-amber-500'
              : 'border-border'}"
          />
          {#if needName}
            <p id="welcome-user-error" role="alert" class="text-[11px] text-amber-500">
              Enter your Last.fm username first.
            </p>
          {/if}
          {#if helpOpen}
            <div transition:slide={{ duration: 180 }} class="flex flex-col gap-2 rounded-md border border-border p-2">
              <p class="text-[11px] leading-snug text-muted-foreground">
                Last.fm is a free account that logs every track you play, which is called scrobbling. Hook it up to
                Spotify, Apple Music or whatever you use once, and the widget reads your now-playing track from there.
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

          {#if editor.sessionName}
            <div class="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
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
              Profile set to private? Sign in
            </button>
            {#if signInError}
              <p class="text-[11px] text-amber-500">{signInError}</p>
            {/if}
          {/if}
        </section>

        <section class="flex flex-col gap-1.5">
          <div class="font-mono-ui text-xs font-medium text-muted-foreground uppercase">2 · Starting look</div>
          <p class="text-[11px] leading-snug text-muted-foreground">
            Just a starting point. Every color, font and position is editable after.
          </p>
          <!-- Selection only. Committing is the button in the footer, so a misclick
               here can't drop you into the editor before you meant to go. -->
          <div class="mt-1 grid grid-cols-3 gap-2">
            {#each looks as look, i (look.name)}
              <button
                type="button"
                onclick={() => (selected = i)}
                aria-pressed={selected === i}
                class="flex flex-col gap-1.5 rounded-md border p-1.5 pb-2 text-xs transition-colors {selected ===
                i
                  ? 'border-primary bg-muted'
                  : 'border-border hover:bg-muted/60'}"
              >
                <PresetThumb config={look.config} />
                <span class="w-full text-center {selected === i ? 'text-foreground' : 'text-muted-foreground'}">
                  {look.name}
                </span>
              </button>
            {/each}
          </div>
        </section>
      </div>

      <div class="border-t border-border p-4">
        <button
          type="button"
          onclick={finish}
          class="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Start editing
        </button>
      </div>
    </div>
  </div>
{/if}
