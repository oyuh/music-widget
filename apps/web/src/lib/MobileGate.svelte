<script lang="ts">
  import { submitContact, isValidEmail, type ContactResult } from "$lib/usage";

  const repo = "https://github.com/oyuh/applem-util";
  const personalSite = "https://github.com/oyuh";

  let email = $state("");
  let sending = $state(false);
  let result = $state<ContactResult | null>(null);
  const canSend = $derived(isValidEmail(email) && !sending);

  const resultMsg: Record<ContactResult, string> = {
    ok: "Got it , we'll email you. See you on desktop!",
    invalid: "Enter a valid email address.",
    rate: "Too many tries , give it a few minutes.",
    error: "Couldn't save , try again later.",
  };

  async function send() {
    if (!canSend) return;
    sending = true;
    result = null;
    result = await submitContact(email, "");
    sending = false;
    if (result === "ok") email = "";
  }
</script>

<div class="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-6 py-12 text-foreground">
  <div class="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl">
    <div class="font-pixel text-xs tracking-wide text-muted-foreground uppercase">fast.Jamlog.lol</div>
    <h1 class="mt-2 text-xl font-semibold tracking-tight">Desktop only , for now</h1>
    <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
      The widget editor needs a mouse and a wider screen, so it only works on a computer. Drop your email
      and we'll remind you to set it up when you're back at your desk (we'll only email about that and outages).
    </p>

    <div class="mt-4 flex flex-col gap-2">
      <div class="flex gap-2">
        <input
          type="email"
          bind:value={email}
          onkeydown={(e) => e.key === "Enter" && send()}
          placeholder="you@email.com"
          autocomplete="email"
          spellcheck="false"
          class="min-w-0 flex-1 rounded-md border border-border bg-zinc-800 px-3 py-2 text-sm text-foreground"
        />
        <button
          type="button"
          onclick={send}
          disabled={!canSend}
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {sending ? "…" : "Email me"}
        </button>
      </div>
      {#if result}
        <p class="text-xs {result === 'ok' ? 'text-green-400' : 'text-amber-500'}">{resultMsg[result]}</p>
      {/if}
    </div>

    <div class="mt-5 flex items-center gap-4 border-t border-border pt-4 text-sm">
      <a href={repo} target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground">
        View source ↗
      </a>
      <a href={personalSite} target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground">
        My site ↗
      </a>
    </div>
  </div>

  <p class="font-pixel text-[11px] text-muted-foreground">Last.fm now-playing overlay</p>
</div>
