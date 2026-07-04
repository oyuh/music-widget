<script module lang="ts">
  export type AuthResult = { ok: boolean; name?: string; error?: string };
</script>

<script lang="ts">
  interface Props {
    result: AuthResult | null;
  }
  let { result = $bindable() }: Props = $props();
</script>

<!-- Post-sign-in confirmation, shown on the editor after /callback bounces
     back. Sits above the welcome modal (z-50) so a failed sign-in message
     isn't buried under onboarding. -->
{#if result}
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="presentation">
    <div
      class="w-full max-w-sm rounded-lg border border-border bg-card p-4 text-card-foreground"
      role="dialog"
      aria-modal="true"
      aria-label={result.ok ? "Signed in" : "Sign-in failed"}
      tabindex="-1"
    >
      <div class="flex items-center gap-2.5">
        {#if result.ok}
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
            <svg viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h2 class="text-base font-semibold tracking-tight">You're signed in!</h2>
        {:else}
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
            <svg viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </span>
          <h2 class="text-base font-semibold tracking-tight">Sign-in failed</h2>
        {/if}
      </div>

      <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
        {#if result.ok}
          Connected to Last.fm{#if result.name}&nbsp;as <span class="font-medium text-foreground">{result.name}</span>{/if}.
          The widget can now read your listening even if your profile is private.
        {:else}
          {result.error || "Something went wrong."} You can try again with “Connect” in the sidebar.
        {/if}
      </p>

      <button
        type="button"
        onclick={() => (result = null)}
        class="mt-3 w-full rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        {result.ok ? "Let's go" : "Close"}
      </button>
    </div>
  </div>
{/if}
