<script lang="ts">
  import { onMount } from "svelte";
  import { serviceStatus } from "$lib/status.svelte";
  import FeedbackModal from "$lib/editor/FeedbackModal.svelte";
  import { feedbackRecentlySent } from "$lib/usage";

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

  onMount(() => {
    feedbackHidden = feedbackRecentlySent();
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

<div class="flex items-center justify-between">
  <span class="flex items-center gap-1.5">
    <span class="h-1.5 w-1.5 rounded-full {dotColor}" title="Service status"></span>
    <span>{label}{serviceStatus.redis ? ` · cache ${serviceStatus.redis}` : ""}</span>
  </span>
  <!-- Subtle abuse indicator: low-key when healthy, amber when throttled. -->
  {#if serviceStatus.rateLimited}
    <span class="text-amber-500/80" title="You're being rate-limited , ease off for a moment.">throttled</span>
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
