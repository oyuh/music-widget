<script lang="ts">
  import { onMount } from "svelte";
  import { serviceStatus } from "$lib/status.svelte";

  const commit = __APP_COMMIT__;
  const repo = "https://github.com/oyuh/applem-util";

  onMount(() => serviceStatus.start());

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
