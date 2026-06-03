<script lang="ts">
  import { onMount } from "svelte";
  import { serviceStatus } from "$lib/status.svelte";
  import { submitContact, isValidEmail, type ContactResult } from "$lib/usage";

  interface Props {
    lfmUser?: string;
  }
  let { lfmUser = "" }: Props = $props();

  const commit = __APP_COMMIT__;
  const repo = "https://github.com/oyuh/applem-util";

  onMount(() => serviceStatus.start());

  // ---- Contact form ----
  let email = $state("");
  let sending = $state(false);
  let result = $state<ContactResult | null>(null);
  const canSend = $derived(isValidEmail(email) && !sending);

  const resultMsg: Record<ContactResult, string> = {
    ok: "Thanks! We'll only email about outages.",
    invalid: "Enter a valid email address.",
    rate: "Too many tries — give it a few minutes.",
    error: "Couldn't save — try again later.",
  };

  async function send() {
    if (!canSend) return;
    sending = true;
    result = null;
    result = await submitContact(email, lfmUser);
    sending = false;
    if (result === "ok") email = "";
  }

  const dotColor = $derived(
    serviceStatus.state === "operational"
      ? "bg-green-500"
      : serviceStatus.state === "degraded"
        ? "bg-amber-500"
        : serviceStatus.state === "offline"
          ? "bg-red-500"
          : "bg-zinc-500",
  );
  const label = $derived(
    serviceStatus.state === "operational"
      ? "Operational"
      : serviceStatus.state === "degraded"
        ? "Degraded"
        : serviceStatus.state === "offline"
          ? "Offline"
          : "Checking…",
  );

  const lfmDot = $derived(
    serviceStatus.lastfm === "ok"
      ? "bg-green-500"
      : serviceStatus.lastfm === "rate-limited"
        ? "bg-amber-500"
        : serviceStatus.lastfm === "unknown"
          ? "bg-zinc-500"
          : "bg-red-500",
  );
  const lfmLabel = $derived(
    serviceStatus.lastfm === "ok"
      ? "Last.fm OK"
      : serviceStatus.lastfm === "rate-limited"
        ? "Last.fm busy"
        : serviceStatus.lastfm === "key-suspended"
          ? "Last.fm key suspended"
          : serviceStatus.lastfm === "down"
            ? "Last.fm down"
            : "Last.fm …",
  );
</script>

<!-- Contact: email us so we can warn you about outages (linked to your username). -->
<section class="mb-3 flex flex-col gap-1.5 border-b border-border pb-3">
  <div class="font-medium text-foreground/80">Contact</div>
  <p class="leading-snug opacity-70">Get more info about my services and the uptime of this service!</p>
  <div class="flex gap-1.5">
    <input
      type="email"
      bind:value={email}
      onkeydown={(e) => e.key === "Enter" && send()}
      placeholder="you@email.com"
      autocomplete="email"
      spellcheck="false"
      class="min-w-0 flex-1 rounded-md border border-border bg-zinc-800 px-2 py-1 text-[11px] text-foreground"
    />
    <button
      type="button"
      onclick={send}
      disabled={!canSend}
      class="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-40"
    >
      {sending ? "…" : "Notify me"}
    </button>
  </div>
  {#if result}
    <p class="text-[11px] {result === 'ok' ? 'text-green-400' : 'text-amber-500'}">{resultMsg[result]}</p>
  {/if}
</section>

<div class="flex items-center justify-between">
  <span class="flex items-center gap-1.5">
    <span class="h-1.5 w-1.5 rounded-full {dotColor}" title="Service status"></span>
    <span>{label}{serviceStatus.redis ? ` · cache ${serviceStatus.redis}` : ""}</span>
  </span>
  <!-- Subtle abuse indicator: low-key when healthy, amber when throttled. -->
  {#if serviceStatus.rateLimited}
    <span class="text-amber-500/80" title="You're being rate-limited — ease off for a moment.">throttled</span>
  {:else}
    <span class="opacity-35" title="Usage looks healthy.">ok</span>
  {/if}
</div>
<div class="mt-1 flex items-center justify-between opacity-70">
  <span class="flex items-center gap-1.5" title="Last.fm API status">
    <span class="h-1.5 w-1.5 rounded-full {lfmDot}"></span>
    <span>{lfmLabel}</span>
  </span>
  <a href="{repo}/commit/{commit}" target="_blank" rel="noopener noreferrer" class="hover:text-foreground">
    build {commit}
  </a>
</div>
