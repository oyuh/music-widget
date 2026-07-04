<script lang="ts">
  import { onMount } from "svelte";

  // Unknown routes and render errors have nothing to show in a URL-is-the-app
  // SPA, so every error page just bounces home. replace() keeps the dead URL
  // out of history so Back doesn't loop.
  onMount(() => {
    window.location.replace("/");
  });
</script>

<svelte:head>
  <title>Redirecting…</title>
</svelte:head>
