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
<div class="mt-1 opacity-55">
  <a href="{repo}/commit/{commit}" target="_blank" rel="noopener noreferrer" class="hover:text-foreground">
    build {commit}
  </a>
</div>
