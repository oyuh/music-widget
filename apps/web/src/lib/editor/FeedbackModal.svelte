<script lang="ts">
  import Segmented from "$lib/ui/Segmented.svelte";
  import { submitFeedback, markFeedbackSent, type FeedbackResult } from "$lib/usage";

  interface Props {
    open: boolean;
    /** Last.fm username from the editor, passed through for the alert opt-in. */
    lfmUser?: string;
    /** Called once a submission succeeds, so the parent can hide the button. */
    onSubmitted?: () => void;
  }
  let { open = $bindable(), lfmUser = "", onSubmitted }: Props = $props();

  type Platform = "twitch" | "youtube" | "kick" | "other";

  let name = $state("");
  let email = $state("");
  let handle = $state("");
  let platform = $state<Platform>("twitch");
  let good = $state("");
  let bad = $state("");
  let subscribe = $state(false);

  let sending = $state(false);
  let result = $state<FeedbackResult | null>(null);

  const resultMsg: Record<FeedbackResult, string> = {
    ok: "Thanks! Got your feedback.",
    empty: "Add a note in one of the boxes first.",
    needEmail: "Enter a valid email to get alerts.",
    invalid: "Something looked off. Double-check your entries.",
    rate: "Too many submissions. Give it a few minutes.",
    error: "Couldn't send. Try again later.",
  };

  function reset() {
    name = "";
    email = "";
    handle = "";
    platform = "twitch";
    good = "";
    bad = "";
    subscribe = false;
    result = null;
  }

  function close() {
    open = false;
  }

  async function send() {
    if (sending) return;
    sending = true;
    result = null;
    result = await submitFeedback({ name, email, handle, platform, good, bad, subscribe, lfmUser });
    sending = false;
    if (result === "ok") {
      // Remember it so the button hides for a week, and tell the parent now.
      markFeedbackSent();
      onSubmitted?.();
      // Show the thanks briefly, then clear + close.
      setTimeout(() => {
        if (result === "ok") {
          reset();
          close();
        }
      }, 1400);
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onclick={close}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 class="text-base font-semibold tracking-tight">Give feedback</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Tell me what's working and what isn't!
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          aria-label="Close"
          class="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div class="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 text-sm">
        <!-- Who (all optional) -->
        <div class="flex flex-col gap-1.5">
          <label for="fb-name" class="text-xs text-muted-foreground">Name <span class="opacity-60">(optional)</span></label>
          <input
            id="fb-name"
            type="text"
            bind:value={name}
            placeholder="What should I call you?"
            maxlength="80"
            spellcheck="false"
            class="w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="fb-email" class="text-xs text-muted-foreground">Email <span class="opacity-60">(optional)</span></label>
          <input
            id="fb-email"
            type="email"
            bind:value={email}
            placeholder="you@email.com"
            autocomplete="email"
            maxlength="254"
            spellcheck="false"
            class="w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5"
          />
          <label class="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              bind:checked={subscribe}
              class="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
            />
            <span>Email me about outages &amp; events!</span>
          </label>
        </div>

        <!-- Streaming handle + platform -->
        <div class="flex flex-col gap-1.5">
          <label for="fb-handle" class="text-xs text-muted-foreground">
            Streaming handle <span class="opacity-60">(optional)</span>
          </label>
          <input
            id="fb-handle"
            type="text"
            bind:value={handle}
            placeholder="your channel name"
            maxlength="80"
            spellcheck="false"
            class="w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5"
          />
          <Segmented
            bind:value={platform}
            options={[
              { value: "twitch", label: "Twitch" },
              { value: "youtube", label: "YouTube" },
              { value: "kick", label: "Kick" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>

        <!-- The two questions -->
        <div class="flex flex-col gap-1.5">
          <label for="fb-good" class="text-xs text-muted-foreground">What's working well?</label>
          <textarea
            id="fb-good"
            bind:value={good}
            rows="3"
            placeholder="The good stuff…"
            maxlength="2000"
            class="w-full resize-y rounded-md border border-border bg-zinc-800 px-2 py-1.5 leading-snug"
          ></textarea>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="fb-bad" class="text-xs text-muted-foreground">What could be better?</label>
          <textarea
            id="fb-bad"
            bind:value={bad}
            rows="3"
            placeholder="Bugs, missing features, anything that bugs you…"
            maxlength="2000"
            class="w-full resize-y rounded-md border border-border bg-zinc-800 px-2 py-1.5 leading-snug"
          ></textarea>
        </div>

        {#if result}
          <p class="text-xs {result === 'ok' ? 'text-green-400' : 'text-amber-500'}">{resultMsg[result]}</p>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-border p-4">
        <button
          type="button"
          onclick={close}
          class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={send}
          disabled={sending}
          class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </div>
  </div>
{/if}
