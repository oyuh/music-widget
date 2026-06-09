<script lang="ts">
  import { submitContact, isValidEmail, type ContactResult } from "$lib/usage";

  const year = new Date().getFullYear();
  const source = "https://github.com/oyuh/music-widget";
  const about = "https://lawsonhart.me/";

  let email = $state("");
  let sending = $state(false);
  let result = $state<ContactResult | null>(null);
  const canSend = $derived(isValidEmail(email) && !sending);

  const resultMsg: Record<ContactResult, string> = {
    ok: "Got it , I'll email you. See you on desktop!",
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

<main class="flex min-h-[100dvh] w-full items-center justify-center px-4 py-10">
  <div class="w-full max-w-xl text-card-foreground">
    <!-- header -->
    <div class="flex items-center justify-between px-6 py-4">
      <span class="font-pixel text-lg tracking-tight">fast.jamlog.lol</span>
      <span class="inline-flex items-center gap-2 font-mono-ui text-xs text-muted-foreground">
        <span class="size-2 animate-pulse rounded-full bg-amber-500"></span>
        desktop only
      </span>
    </div>

    <!-- body -->
    <div class="space-y-6 px-6 py-8">
      <p class="font-mono-ui text-sm leading-relaxed text-muted-foreground">
        The widget editor needs a mouse and a wider screen, so it only runs on a computer.
        Drop your email and I'll remind you to set it up when you're back at your desk
        (only about that and outages , nothing else).
      </p>

      <!-- email capture -->
      <div class="space-y-2">
        <div class="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            bind:value={email}
            onkeydown={(e) => e.key === "Enter" && send()}
            placeholder="you@email.com"
            autocomplete="email"
            spellcheck="false"
            class="min-w-0 flex-1 rounded-lg border border-border bg-input px-4 py-3 font-mono-ui text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onclick={send}
            disabled={!canSend}
            class="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-mono-ui text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
          >
            {sending ? "sending…" : "email me"}
            <span class="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
        {#if result}
          <p class="font-mono-ui text-xs {result === 'ok' ? 'text-green-400' : 'text-amber-500'}">
            {resultMsg[result]}
          </p>
        {/if}
      </div>

      <!-- links -->
      <div class="flex flex-col gap-3 sm:flex-row">
        <a
          href={about}
          target="_blank"
          rel="noopener noreferrer"
          class="group inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-mono-ui text-sm text-foreground transition-colors hover:bg-accent"
        >
          learn about me!
          <span class="transition-transform group-hover:translate-x-0.5">→</span>
        </a>
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-mono-ui text-sm text-foreground transition-colors hover:bg-accent"
        >
          the source
        </a>
      </div>
    </div>

    <!-- footer -->
    <div class="px-6 py-4">
      <p class="font-mono-ui text-[11px] leading-relaxed text-muted-foreground">
        <span class="text-foreground">Last.fm now-playing overlay.</span>
        Build your widget on a desktop, then drop it into OBS or your stream.
      </p>
      <p class="mt-3 font-mono-ui text-[11px] text-muted-foreground">
        © {year} Lawson Hart · made with ❤︎
      </p>
    </div>
  </div>
</main>
