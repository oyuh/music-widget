<script lang="ts">
  import { onMount } from "svelte";
  import { serviceStatus } from "$lib/status.svelte";
  import FeedbackModal from "$lib/editor/FeedbackModal.svelte";
  import { feedbackRecentlySent, fetchSiteUserCount } from "$lib/usage";

  interface Props {
    lfmUser?: string;
  }
  let { lfmUser = "" }: Props = $props();

  const commit = __APP_COMMIT__;
  const repo = "https://github.com/oyuh/applem-util";

  let feedbackOpen = $state(false);
  // Hide the button for a week after someone submits (checked on mount because
  // localStorage isn't available during the static prerender). See $lib/usage.
  let feedbackHidden = $state(false);
  // Distinct-user count, fetched once on load (server keeps it warm in memory,
  // so there's nothing to poll). null until it arrives or on failure; hidden then.
  let userCount = $state<number | null>(null);

  onMount(() => {
    feedbackHidden = feedbackRecentlySent();
    void fetchSiteUserCount().then((n) => (userCount = n));
    return serviceStatus.start();
  });

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
  // Your own IP's share of the server rate limit, from /api/usage. Quiet while
  // low, amber as it climbs; the throttled branch below takes over at a 429.
  const usageFrac = $derived(
    serviceStatus.usage && serviceStatus.usage.max > 0
      ? serviceStatus.usage.used / serviceStatus.usage.max
      : 0,
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

<!-- Feedback: opens a modal for free-form notes + an optional alert opt-in.
     Hidden for a week after a submission (feedbackHidden). -->
{#if !feedbackHidden}
  <button
    type="button"
    onclick={() => (feedbackOpen = true)}
    class="mb-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-foreground/90 transition hover:bg-muted"
  >
    <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8Z" />
    </svg>
    Give feedback!
  </button>
{/if}

<!-- Usage count: how many people have built a widget here. Hidden until the
     count loads (and when storage is off, so it never shows a bare "0"). -->
{#if userCount !== null}
  <div class="mb-2 flex items-center gap-1.5 text-foreground/80" title="Distinct Last.fm users who've used the widget">
    <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
    <span><span class="text-foreground">{userCount.toLocaleString()}</span>+ people use this</span>
  </div>
{/if}

<div class="flex items-center justify-between">
  <span class="flex items-center gap-1.5">
    <span class="h-1.5 w-1.5 rounded-full {dotColor}" title="Service status"></span>
    <span>{label}{serviceStatus.redis ? ` · cache ${serviceStatus.redis}` : ""}</span>
  </span>
  <!-- Your IP's live usage against the server rate limit: low-key when quiet,
       amber as it climbs, and "throttled" once a 429 has actually been seen. -->
  {#if serviceStatus.rateLimited}
    <span class="text-amber-500/80" title="You're being rate-limited. Ease off for a moment.">throttled</span>
  {:else if serviceStatus.usage}
    <span
      class={usageFrac >= 0.7 ? "text-amber-500/80" : "opacity-35"}
      title="Your IP's usage of the server API: {serviceStatus.usage.used}/{serviceStatus.usage.max} requests in the current {serviceStatus.usage.windowSeconds}s window."
    >
      {serviceStatus.usage.used}/{serviceStatus.usage.max}
    </span>
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

<FeedbackModal bind:open={feedbackOpen} {lfmUser} onSubmitted={() => (feedbackHidden = true)} />
