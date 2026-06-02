<script lang="ts">
  // Placeholder editor shell — the visual canvas editor lands in the next step.
  const lfmKey = import.meta.env.VITE_LFM_KEY ? "set" : "missing";
</script>

<svelte:head>
  <title>Music Widget — Editor</title>
</svelte:head>

<main class="min-h-screen grid place-items-center p-8">
  <div class="max-w-md w-full rounded-xl border border-border bg-card text-card-foreground p-8 shadow-lg">
    <h1 class="text-2xl font-semibold tracking-tight">Music Widget</h1>
    <p class="mt-2 text-muted-foreground">
      SvelteKit shell is live. The visual editor (canvas + drag + inspector) is being built next.
    </p>
    <div class="mt-6 flex flex-col gap-2 text-sm">
      <div class="flex items-center justify-between rounded-md bg-muted px-3 py-2">
        <span class="text-muted-foreground">VITE_LFM_KEY</span>
        <span class="font-mono">{lfmKey}</span>
      </div>
      <a class="text-primary underline underline-offset-4" href="/w">/w — standalone widget</a>
      <a class="text-primary underline underline-offset-4" href="/callback">/callback — auth return</a>
    </div>
  </div>
</main>
