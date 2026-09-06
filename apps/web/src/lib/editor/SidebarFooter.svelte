<script lang="ts">
  import { tip } from "$lib/ui/tooltip.svelte";
  import { onMount } from "svelte";
  import { serviceStatus } from "$lib/status.svelte";
  import { feedbackRecentlySent, fetchSiteUserCount } from "$lib/usage";

  interface Props {
    lfmUser?: string;
  }
  let { lfmUser = "" }: Props = $props();

  // Version is what people see; the exact build sha lives in the tooltip and the
  // link target, so a bug report can still be pinned to one commit.
  const commit = __APP_COMMIT__;
  const version = __APP_VERSION__;
  const repo = "https://github.com/oyuh/music-widget";

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

  // One line, one signal. The backend's health, Last.fm's health, and whether
  // this client is being throttled all collapse into a single dot + message:
  // the worst of the three wins, so there's never more than one thing to read.
  const status = $derived.by(() => {
    const s = serviceStatus;
    if (s.state === "offline") return { dot: "bg-red-500", label: "Server offline" };
    if (s.lastfm === "down") return { dot: "bg-red-500", label: "Last.fm down" };
    if (s.lastfm === "key-suspended") return { dot: "bg-red-500", label: "Last.fm key suspended" };
    if (s.state === "checking" || s.lastfm === "unknown") return { dot: "bg-zinc-500", label: "Checking…" };
    if (s.state === "degraded") return { dot: "bg-amber-500", label: "Degraded" };
    if (s.rateLimited || s.lastfm === "rate-limited") return { dot: "bg-amber-500", label: "Rate limited" };
    return { dot: "bg-green-500", label: "Operational" };
  });
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
  <div class="mb-2 flex items-center gap-1.5 text-foreground/80" use:tip={"Distinct Last.fm users who've used the widget"}>
    <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
    <span><span class="text-foreground">{userCount.toLocaleString()}</span>+ people use this</span>
  </div>
{/if}

<div class="flex items-center gap-1.5">
  <span class="h-1.5 w-1.5 shrink-0 rounded-full {status.dot}" use:tip={"Service status"}></span>
  <span>{status.label}</span>
</div>
<div class="mt-1 flex items-center opacity-70">
  <a
    href="{repo}/commit/{commit}"
    target="_blank"
    rel="noopener noreferrer"
    class="hover:text-foreground"
    use:tip={"View this build on GitHub"}
  >
    v{version} · build {commit}
  </a>
</div>

{#if feedbackOpen}
  {#await import("$lib/editor/FeedbackModal.svelte") then M}
    <M.default bind:open={feedbackOpen} {lfmUser} onSubmitted={() => (feedbackHidden = true)} />
  {/await}
{/if}
