<script lang="ts">
  // The load above redirects, so this only renders if that never ran.
  import { onMount } from "svelte";
  onMount(() => window.location.replace("/wiki/privacy"));
</script>

<svelte:head><title>Redirecting…</title><meta name="robots" content="noindex" /></svelte:head>

<p style="margin:4rem auto;max-width:32rem;padding:0 1rem;font:14px/1.7 system-ui,sans-serif">
  This page moved to <a href="/wiki/privacy">/wiki/privacy</a>.
</p>
