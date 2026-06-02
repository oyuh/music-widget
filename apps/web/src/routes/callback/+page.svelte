<script lang="ts">
  import { onMount } from "svelte";

  let msg = $state("Finishing sign-in…");
  let failed = $state(false);

  onMount(async () => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      failed = true;
      msg = "Missing token. Open the editor and use “Connect”.";
      return;
    }
    try {
      const r = await fetch("/api/lastfm/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await r.json()) as { name?: string; key?: string; error?: string };
      if (!r.ok || data.error || !data.key) throw new Error(data.error || `Failed (${r.status})`);

      localStorage.setItem("lfm_session_name", data.name ?? "");
      localStorage.setItem("lfm_session_key", data.key);
      msg = `Connected as ${data.name}. Redirecting…`;
      setTimeout(() => window.location.replace("/"), 800);
    } catch (e) {
      failed = true;
      msg = `Auth failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  });
</script>

<svelte:head>
  <title>Connecting…</title>
</svelte:head>

<main class="grid min-h-screen place-items-center p-6 text-center">
  <div class="max-w-sm">
    <h1 class="text-2xl font-semibold tracking-tight">Last.fm</h1>
    <p class="mt-2 {failed ? 'text-destructive' : 'text-muted-foreground'}">{msg}</p>
    {#if failed}
      <a href="/" class="mt-4 inline-block text-sm text-primary underline underline-offset-4">Back to editor</a>
    {/if}
  </div>
</main>
